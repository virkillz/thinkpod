import fs from 'fs/promises'
import { randomUUID } from 'crypto'
import type { AgentVaultManager, LearningFileName } from './AgentVaultManager.js'

export interface OpenQuestion {
  id: string
  text: string
  search_method: 'internal_vault' | 'web' | 'ask_human'
  source_file: string
  created_at: number
  last_attempt?: number
  attempt_count: number
  importance?: number  // 1–5; 1–2 → drop
}

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000
const MAX_QUESTIONS = 50

export class LearningFileManager {
  constructor(private manager: AgentVaultManager) {}

  async readLearningFile(name: LearningFileName): Promise<string> {
    try {
      return await fs.readFile(this.manager.paths.learning(name), 'utf-8')
    } catch {
      return ''
    }
  }

  /**
   * Appends new facts to a dense learning file.
   * Each fact becomes a bullet point. No deduplication at write-time — the
   * NoteReviewJob CognitiveRunner call handles that before calling this.
   */
  async applyUpdate(name: LearningFileName, newFacts: string[]): Promise<void> {
    if (newFacts.length === 0) return
    const existing = await this.readLearningFile(name)
    const toAppend = newFacts.map((f) => `- ${f}`).join('\n')
    const updated = existing.trimEnd()
      ? `${existing.trimEnd()}\n${toAppend}\n`
      : `${toAppend}\n`
    await fs.writeFile(this.manager.paths.learning(name), updated, 'utf-8')
  }

  async readOpenQuestions(): Promise<OpenQuestion[]> {
    let raw: string
    try {
      raw = await fs.readFile(this.manager.paths.openQuestions(), 'utf-8')
    } catch {
      return []
    }
    return parseOpenQuestions(raw)
  }

  async writeOpenQuestions(questions: OpenQuestion[]): Promise<void> {
    const content = serializeOpenQuestions(questions)
    await fs.writeFile(this.manager.paths.openQuestions(), content, 'utf-8')
  }

  async archiveDroppedQuestion(question: OpenQuestion): Promise<void> {
    let existing = ''
    try {
      existing = await fs.readFile(this.manager.paths.droppedQuestions(), 'utf-8')
    } catch { /* file may not exist yet */ }
    const reasonParts: string[] = []
    if (question.importance === 1 || question.importance === 2)
      reasonParts.push(`importance: ${question.importance}`)
    if (!question.attempt_count)
      reasonParts.push('no attempts after 30 days')
    const reason = reasonParts.join(', ') || 'pruned'
    const line = `- [${reason}] ${question.text} (source: ${question.source_file})\n`
    await fs.writeFile(this.manager.paths.droppedQuestions(), existing + line, 'utf-8')
  }

  /**
   * Pure function — no I/O. Returns questions to keep and those to drop.
   * Callers are responsible for archiving dropped questions.
   */
  pruneOpenQuestions(questions: OpenQuestion[]): {
    kept: OpenQuestion[]
    dropped: OpenQuestion[]
  } {
    const now = Date.now()
    const dropped = questions.filter(
      (q) =>
        (now - q.created_at > THIRTY_DAYS && q.attempt_count === 0) ||
        q.importance === 1 ||
        q.importance === 2
    )
    const droppedIds = new Set(dropped.map((q) => q.id))
    const kept = questions.filter((q) => !droppedIds.has(q.id)).slice(0, MAX_QUESTIONS)
    return { kept, dropped }
  }
}

// ── Serialization ─────────────────────────────────────────────────────────────
//
// open_questions.md format:
//
//   <!-- {"id":"abc","search_method":"web","source_file":"notes/j.md","created_at":123,"attempt_count":0} -->
//   - [ ] Question text here?
//

function serializeOpenQuestions(questions: OpenQuestion[]): string {
  if (questions.length === 0) return ''
  const lines: string[] = []
  for (const q of questions) {
    const meta: Record<string, unknown> = {
      id: q.id,
      search_method: q.search_method,
      source_file: q.source_file,
      created_at: q.created_at,
      attempt_count: q.attempt_count,
    }
    if (q.last_attempt !== undefined) meta.last_attempt = q.last_attempt
    if (q.importance !== undefined) meta.importance = q.importance
    lines.push(`<!-- ${JSON.stringify(meta)} -->`)
    lines.push(`- [ ] ${q.text}`)
    lines.push('')
  }
  return lines.join('\n')
}

function parseOpenQuestions(raw: string): OpenQuestion[] {
  const questions: OpenQuestion[] = []
  const lines = raw.split('\n')
  let pendingMeta: Record<string, unknown> | null = null

  for (const line of lines) {
    const metaMatch = line.match(/^<!-- ({.+}) -->$/)
    if (metaMatch) {
      try {
        pendingMeta = JSON.parse(metaMatch[1])
      } catch {
        pendingMeta = null
      }
      continue
    }

    const questionMatch = line.match(/^- \[ \] (.+)$/)
    if (questionMatch && pendingMeta) {
      questions.push({
        id: (pendingMeta.id as string) || randomUUID(),
        text: questionMatch[1],
        search_method:
          (pendingMeta.search_method as OpenQuestion['search_method']) || 'internal_vault',
        source_file: (pendingMeta.source_file as string) || '',
        created_at: (pendingMeta.created_at as number) || Date.now(),
        attempt_count: (pendingMeta.attempt_count as number) || 0,
        ...(pendingMeta.last_attempt !== undefined && {
          last_attempt: pendingMeta.last_attempt as number,
        }),
        ...(pendingMeta.importance !== undefined && {
          importance: pendingMeta.importance as number,
        }),
      })
      pendingMeta = null
    }
  }

  return questions
}
