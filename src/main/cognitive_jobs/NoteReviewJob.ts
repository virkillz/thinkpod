import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import type { CognitiveJobContext, JobResult } from './ProcessNewFilesJob.js'
import type { LearningFileName } from '../agent_vault/AgentVaultManager.js'
import { LearningFileManager, OpenQuestion } from '../agent_vault/LearningFileManager.js'

// ── Raw learning note parser ───────────────────────────────────────────────

interface RawLearningNote {
  sourcePath: string
  processedAt: number
  findings: Record<string, string[]>         // categoryId → bullet strings
  openQuestions: RawQuestion[]
}

interface RawQuestion {
  text: string
  search_method: 'internal_vault' | 'web' | 'ask_human'
}

function parseRawLearningNote(content: string, filePath: string): RawLearningNote | null {
  const lines = content.split('\n')
  let sourcePath = ''
  let processedAt = 0
  let inFrontmatter = false
  let frontmatterDone = false
  let currentCategory: string | null = null
  let currentLabel = ''
  const findings: Record<string, string[]> = {}
  const openQuestions: RawQuestion[] = []

  for (const line of lines) {
    if (!frontmatterDone) {
      if (line.trim() === '---') {
        if (!inFrontmatter) { inFrontmatter = true; continue }
        frontmatterDone = true; continue
      }
      if (inFrontmatter) {
        const m = line.match(/^(\w+):\s*(.+)$/)
        if (m) {
          if (m[1] === 'source') sourcePath = m[2].trim()
          if (m[1] === 'processed_at') processedAt = new Date(m[2].trim()).getTime()
        }
      }
      continue
    }

    // Section header: ## [categoryId] Label
    const headerMatch = line.match(/^## \[(\w+)\] (.+)$/)
    if (headerMatch) {
      currentCategory = headerMatch[1]
      currentLabel = headerMatch[2]
      if (!findings[currentCategory]) findings[currentCategory] = []
      void currentLabel
      continue
    }

    if (!currentCategory) continue

    if (currentCategory === 'open_questions') {
      // - [ ] question text [search: method]
      const qMatch = line.match(/^- \[ \] (.+?) \[search: (internal_vault|web|ask_human)\]$/)
      if (qMatch) {
        openQuestions.push({
          text: qMatch[1].trim(),
          search_method: qMatch[2] as RawQuestion['search_method'],
        })
      }
    } else {
      const bulletMatch = line.match(/^- (.+)$/)
      if (bulletMatch) {
        findings[currentCategory].push(bulletMatch[1].trim())
      }
    }
  }

  if (!sourcePath && !processedAt) {
    console.warn(`[note_review] Could not parse frontmatter in ${filePath}`)
    return null
  }

  return { sourcePath, processedAt: processedAt || Date.now(), findings, openQuestions }
}

// ── Category → LearningFileName mapping ───────────────────────────────────

const CATEGORY_TO_FILE: Partial<Record<string, LearningFileName>> = {
  character: 'character',
  facts: 'facts',
  people: 'people',
  work: 'projects',
  goals: 'goals',
  beliefs: 'beliefs',
}

// ── Main job ───────────────────────────────────────────────────────────────

export async function run(ctx: CognitiveJobContext): Promise<JobResult> {
  const { agentVaultManager, cognitiveRunner, userName } = ctx
  const learningManager = new LearningFileManager(agentVaultManager)
  const manifest = await agentVaultManager.manifest.getAll()
  const lastReview = manifest.last_note_review ?? 0

  // ── Collect raw learning notes written since last review ────────────────
  const newRawFiles = Object.values(manifest.files)
    .filter((entry) => entry.processed_at > lastReview)
    .map((entry) => entry.raw_learning_file)

  if (newRawFiles.length === 0) {
    console.log('[note_review] No new raw learning notes since last review.')
    await agentVaultManager.manifest.setLastNoteReview(Date.now())
    return { processed: 0, skipped: 0, errors: 0 }
  }

  console.log(`[note_review] Processing ${newRawFiles.length} raw learning note(s)...`)

  const notes: RawLearningNote[] = []
  for (const filePath of newRawFiles) {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const note = parseRawLearningNote(content, filePath)
      if (note) notes.push(note)
    } catch (err) {
      console.warn(`[note_review] Could not read ${filePath}:`, err)
    }
  }

  // Aggregate findings per category across all notes
  const aggregated: Record<string, string[]> = {}
  const allNewRawQuestions: RawQuestion[] = []

  for (const note of notes) {
    for (const [categoryId, items] of Object.entries(note.findings)) {
      if (!aggregated[categoryId]) aggregated[categoryId] = []
      aggregated[categoryId].push(...items)
    }
    allNewRawQuestions.push(...note.openQuestions)
  }

  let errors = 0

  // ── Part A: Consolidate facts into dense learning files ─────────────────
  const allNewFacts: string[] = []  // collect for use in question dedup

  for (const [categoryId, newItems] of Object.entries(aggregated)) {
    const learningFile = CATEGORY_TO_FILE[categoryId]
    if (!learningFile || newItems.length === 0) continue

    try {
      const existing = await learningManager.readLearningFile(learningFile)
      const result = await cognitiveRunner.call<{
        new: string[]
        updates: string[]
      }>({
        prompt: buildConsolidationPrompt(learningFile, existing, newItems, userName),
        outputSchema: CONSOLIDATION_SCHEMA,
        example: CONSOLIDATION_EXAMPLE,
        maxTokens: 1200,
      })

      const toAdd = [...(result?.new ?? []), ...(result?.updates ?? [])]
      await learningManager.applyUpdate(learningFile, toAdd)
      allNewFacts.push(...toAdd)
      console.log(
        `[note_review] ${learningFile}: +${result?.new.length ?? 0} new, ` +
        `${result?.updates.length ?? 0} updates`
      )
    } catch (err) {
      errors++
      console.error(`[note_review] Error consolidating ${categoryId}:`, err)
    }
  }

  // ── Part B: Consolidate open questions ──────────────────────────────────
  const existingQuestions = await learningManager.readOpenQuestions()

  let updatedQuestions = [...existingQuestions]

  if (allNewRawQuestions.length > 0) {
    try {
      const result = await cognitiveRunner.call<{
        duplicate_indices: number[]
        answered: Array<{ question_text: string; answer: string }>
        new: string[]
      }>({
        prompt: buildQuestionDedupePrompt(
          allNewRawQuestions.map((q) => q.text),
          existingQuestions.map((q) => q.text),
          allNewFacts,
          userName
        ),
        outputSchema: QUESTION_DEDUPE_SCHEMA,
        example: QUESTION_DEDUPE_EXAMPLE,
        maxTokens: 1200,
      })

      void result?.duplicate_indices  // informational only; model already excludes dupes from result.new
      const answeredTexts = new Set(
        (result?.answered ?? []).map((a) => a.question_text.toLowerCase())
      )

      // Write answers to relevant learning file (facts.md as catch-all)
      const answers = result?.answered ?? []
      if (answers.length > 0) {
        const answerFacts = answers.map((a) => `${a.question_text} → ${a.answer}`)
        await learningManager.applyUpdate('facts', answerFacts)
        console.log(`[note_review] Answered ${answers.length} open question(s) from new facts`)
      }

      // Mark answered existing questions as resolved (remove from list)
      updatedQuestions = updatedQuestions.filter(
        (q) => !answeredTexts.has(q.text.toLowerCase())
      )

      // Add genuinely new questions.
      // Match returned text back to the original raw question to recover search_method.
      const newQs = (result?.new ?? []).map((text) => {
        const rawQ = allNewRawQuestions.find(
          (q) => q.text.toLowerCase() === text.toLowerCase()
        )
        // Find source note for this question
        const sourceNote = notes.find((n) =>
          n.openQuestions.some((q) => q.text.toLowerCase() === text.toLowerCase())
        )
        return {
          id: randomUUID(),
          text,
          search_method: rawQ?.search_method ?? 'internal_vault',
          source_file: sourceNote?.sourcePath ?? notes[0]?.sourcePath ?? '',
          created_at: Date.now(),
          attempt_count: 0,
        } satisfies OpenQuestion
      })

      updatedQuestions.push(...newQs)
      console.log(`[note_review] Questions: +${newQs.length} new, ${answers.length} answered`)
    } catch (err) {
      errors++
      console.error('[note_review] Error deduplicating questions:', err)
    }
  }

  // ── Part C: Score unscored questions ────────────────────────────────────
  const unscored = updatedQuestions.filter(
    (q) => q.importance === undefined && q.attempt_count === 0
  )

  for (const question of unscored) {
    try {
      const result = await cognitiveRunner.call<{ score: number }>({
        prompt: buildImportanceScoringPrompt(question.text, userName),
        outputSchema: IMPORTANCE_SCHEMA,
        example: { score: 3 },
        maxTokens: 100,
      })
      if (result && result.score >= 1 && result.score <= 5) {
        question.importance = result.score
      }
    } catch (err) {
      console.warn(`[note_review] Could not score question "${question.text}":`, err)
    }
  }

  // Prune and archive
  const { kept, dropped } = learningManager.pruneOpenQuestions(updatedQuestions)
  for (const q of dropped) {
    await learningManager.archiveDroppedQuestion(q)
  }
  if (dropped.length > 0) {
    console.log(`[note_review] Archived ${dropped.length} low-value question(s)`)
  }

  await learningManager.writeOpenQuestions(kept)

  await agentVaultManager.manifest.setLastNoteReview(Date.now())

  return { processed: notes.length, skipped: 0, errors }
}

// ── Prompt builders ────────────────────────────────────────────────────────

function buildConsolidationPrompt(
  fileName: LearningFileName,
  existing: string,
  newItems: string[],
  userName: string
): string {
  const newBullets = newItems.map((f) => `- ${f}`).join('\n')
  const existingSection = existing.trim()
    ? `EXISTING CONTENT:\n${existing.trim()}`
    : 'EXISTING CONTENT: (empty)'

  return `You are helping maintain a knowledge file about ${userName || 'this person'}.

File: ${fileName}.md
${existingSection}

NEW FACTS from recent notes:
${newBullets}

Return ONLY the facts that should be ADDED to the file:
- "new": facts that are genuinely new, not already covered
- "updates": facts that correct or meaningfully expand existing content (write the full updated statement)
- Exclude duplicates and trivially similar facts
- Keep each fact concise (one sentence)`
}

function buildQuestionDedupePrompt(
  newQuestions: string[],
  existingQuestions: string[],
  newFacts: string[],
  userName: string
): string {
  const newList = newQuestions.map((q, i) => `${i}. ${q}`).join('\n')
  const existingList =
    existingQuestions.length > 0
      ? existingQuestions.map((q, i) => `${i}. ${q}`).join('\n')
      : '(none yet)'
  const factsList =
    newFacts.length > 0 ? newFacts.map((f) => `- ${f}`).join('\n') : '(none)'

  return `You are managing open questions about ${userName || 'this person'}.

NEW QUESTIONS (0-indexed):
${newList}

EXISTING QUESTIONS:
${existingList}

RECENTLY ADDED FACTS (these may answer some questions):
${factsList}

Tasks:
1. Which new question indices are duplicates of existing ones?
2. Which existing or new questions are now answered by the facts? Provide a concise answer.
3. Which new questions are genuinely new (not duplicates, not answered)?

Return the question texts verbatim for "new" — do not rewrite them.`
}

function buildImportanceScoringPrompt(questionText: string, userName: string): string {
  return `Rate how important this open question is for understanding ${userName || 'this person'} on a scale of 1–5:

5 — Critical: directly affects understanding of goals, core relationships, or identity
4 — Significant: would meaningfully improve understanding
3 — Moderate: interesting but not urgent
2 — Low: minor detail, unlikely to matter much
1 — Trivial: not worth pursuing

Question: "${questionText}"

Return only the numeric score.`
}

// ── Schemas & examples ─────────────────────────────────────────────────────

const CONSOLIDATION_SCHEMA = {
  type: 'object' as const,
  properties: {
    new: { type: 'array', items: { type: 'string' } },
    updates: { type: 'array', items: { type: 'string' } },
  },
  required: ['new', 'updates'],
}

const CONSOLIDATION_EXAMPLE = {
  new: ['Prefers async communication over real-time meetings', 'Started learning Rust in March 2026'],
  updates: ['Works at a crypto startup focused on DeFi (previously just "crypto project")'],
}

const QUESTION_DEDUPE_SCHEMA = {
  type: 'object' as const,
  properties: {
    duplicate_indices: { type: 'array', items: { type: 'number' } },
    answered: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question_text: { type: 'string' },
          answer: { type: 'string' },
        },
      },
    },
    new: { type: 'array', items: { type: 'string' } },
  },
  required: ['duplicate_indices', 'answered', 'new'],
}

const QUESTION_DEDUPE_EXAMPLE = {
  duplicate_indices: [2],
  answered: [{ question_text: 'Who is Alice?', answer: 'Alice is a co-founder mentioned in the seed round notes' }],
  new: ['What is the name of the crypto project?', 'Where did the investor meeting take place?'],
}

const IMPORTANCE_SCHEMA = {
  type: 'object' as const,
  properties: {
    score: { type: 'number' },
  },
  required: ['score'],
}
