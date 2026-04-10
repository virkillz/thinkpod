import fs from 'fs/promises'
import type { Dirent } from 'fs'
import path from 'path'
import type { AgentVaultManager } from '../agent_vault/AgentVaultManager.js'
import type { CognitiveRunner } from '../agent/CognitiveRunner.js'
import { QUESTION_BATTERY } from '../agent_vault/QuestionBattery.js'
import { writeRawLearningNote, BatteryFinding, QuestionItem } from '../agent_vault/RawLearningWriter.js'
import { computeHash, extractKeywords, extractEntities, countWords } from '../agent_vault/Extractor.js'
import type { ManifestEntry } from '../agent_vault/Manifest.js'

export interface CognitiveJobContext {
  agentVaultManager: AgentVaultManager
  cognitiveRunner: CognitiveRunner
  /** Name of the platform user, injected into LLM prompts. */
  userName: string
  /** When true: runs LLM calls but skips all writes. Returns preview in JobResult. */
  dryRun?: boolean
  /** Max files to process in this run (default: 20). Used for manual runs to process one at a time. */
  limit?: number
}

export interface DryRunStep {
  categoryId: string
  label: string
  status: 'ok' | 'failed' | 'empty'
  output: unknown
}

export interface DryRunResult {
  targetFile: string
  steps: DryRunStep[]
  rawLearningPreview: string
}

export interface JobResult {
  processed: number
  skipped: number
  errors: number
  dryRun?: DryRunResult
}

const MAX_FILES_PER_RUN = 20

export async function run(ctx: CognitiveJobContext): Promise<JobResult> {
  if (ctx.dryRun) return runDry(ctx)

  const { agentVaultManager, cognitiveRunner, userName } = ctx
  const vaultPath = agentVaultManager.vaultPath

  // 1. Collect all vault markdown files, excluding _agent_vault/
  const allFiles = await collectVaultFiles(vaultPath)

  // 2. Compute hashes and find unprocessed / hash-changed files
  const filesWithMeta = await Promise.all(
    allFiles.map(async (relPath) => {
      const absPath = path.join(vaultPath, relPath)
      try {
        const [stat, content] = await Promise.all([
          fs.stat(absPath),
          fs.readFile(absPath, 'utf-8'),
        ])
        return { path: relPath, mtime: stat.mtimeMs, hash: computeHash(content), content }
      } catch {
        return null
      }
    })
  )

  const valid = filesWithMeta.filter((f): f is NonNullable<typeof f> => f !== null)

  const toProcess = await agentVaultManager.manifest.getUnprocessed(
    valid.map((f) => ({ path: f.path, mtime: f.mtime, hash: f.hash })),
    ctx.limit ?? MAX_FILES_PER_RUN
  )

  let processed = 0
  let skipped = 0
  let errors = 0

  for (const relPath of toProcess) {
    const fileMeta = valid.find((f) => f.path === relPath)
    if (!fileMeta) { skipped++; continue }

    try {
      // 3a. Extract keywords and entities (no model)
      const keywords = extractKeywords(fileMeta.content, 10)
      const entities = extractEntities(fileMeta.content)
      const wordCount = countWords(fileMeta.content)

      // 3b. Run question battery (7 CognitiveRunner calls in parallel)
      const batteryResults = await runBattery(cognitiveRunner, fileMeta.content, userName)

      // 3c. Write raw learning note
      const rawLearningFile = await writeRawLearningNote(relPath, batteryResults, agentVaultManager)

      // 3d. Update manifest
      const entry: ManifestEntry = {
        hash: fileMeta.hash,
        processed_at: Date.now(),
        word_count: wordCount,
        keywords,
        entities,
        raw_learning_file: rawLearningFile,
      }
      await agentVaultManager.manifest.upsertEntry(relPath, entry)

      // 3e. Rebuild link graph (incremental: rebuild from full manifest each time)
      const manifest = await agentVaultManager.manifest.getAll()
      await agentVaultManager.linkGraph.rebuild(manifest)

      processed++
      console.log(`[process_new_files] Processed: ${relPath}`)
    } catch (err) {
      errors++
      console.error(`[process_new_files] Error processing ${relPath}:`, err)
    }
  }

  if (toProcess.length === 0) {
    console.log('[process_new_files] No new or changed files to process.')
  }

  return { processed, skipped, errors }
}

/**
 * Dry-run: picks the most recently modified vault file, runs the full battery
 * with real LLM calls, but skips all writes. Returns preview in JobResult.
 */
async function runDry(ctx: CognitiveJobContext): Promise<JobResult> {
  const { agentVaultManager, cognitiveRunner, userName } = ctx
  const vaultPath = agentVaultManager.vaultPath

  const allFiles = await collectVaultFiles(vaultPath)
  if (allFiles.length === 0) {
    return { processed: 0, skipped: 0, errors: 0, dryRun: { targetFile: '', steps: [], rawLearningPreview: '(no vault files found)' } }
  }

  // Pick the most recently modified file
  const filesWithMeta = (await Promise.all(
    allFiles.map(async (relPath) => {
      try {
        const stat = await fs.stat(path.join(vaultPath, relPath))
        return { path: relPath, mtime: stat.mtimeMs }
      } catch { return null }
    })
  )).filter((f): f is NonNullable<typeof f> => f !== null)

  filesWithMeta.sort((a, b) => b.mtime - a.mtime)
  const target = filesWithMeta[0]
  const content = await fs.readFile(path.join(vaultPath, target.path), 'utf-8')

  // Run battery (real LLM calls) — collect steps for display
  const steps: DryRunStep[] = []
  const findings: BatteryFinding[] = []

  await Promise.all(
    QUESTION_BATTERY.map(async (category) => {
      let step: DryRunStep
      if (category.id === 'open_questions') {
        const result = await cognitiveRunner.call<{ questions: QuestionItem[] }>({
          prompt: category.prompt(content, userName),
          outputSchema: category.schema,
          example: category.example,
        })
        const items = result?.questions ?? []
        step = { categoryId: category.id, label: category.label, status: result ? (items.length > 0 ? 'ok' : 'empty') : 'failed', output: result }
        findings.push({ categoryId: category.id, label: category.label, results: items })
      } else {
        const result = await cognitiveRunner.call<{ findings: string[] }>({
          prompt: category.prompt(content, userName),
          outputSchema: category.schema,
          example: category.example,
        })
        const items = result?.findings ?? []
        step = { categoryId: category.id, label: category.label, status: result ? (items.length > 0 ? 'ok' : 'empty') : 'failed', output: result }
        findings.push({ categoryId: category.id, label: category.label, results: items })
      }
      steps.push(step)
    })
  )

  // Restore battery order (Promise.all resolves out of order)
  const order = QUESTION_BATTERY.map(c => c.id)
  steps.sort((a, b) => order.indexOf(a.categoryId) - order.indexOf(b.categoryId))

  // Build what the raw learning note would look like
  const now = new Date().toISOString()
  const lines = ['---', `source: ${target.path}`, `processed_at: ${now}`, '---', '']
  for (const finding of findings.sort((a, b) => order.indexOf(a.categoryId) - order.indexOf(b.categoryId))) {
    if (finding.categoryId === 'open_questions') {
      const questions = finding.results as QuestionItem[]
      if (questions.length === 0) continue
      lines.push(`## [${finding.categoryId}] ${finding.label}`)
      for (const q of questions) lines.push(`- [ ] ${q.question} [search: ${q.search_method}]`)
      lines.push('')
    } else {
      const items = finding.results as string[]
      if (items.length === 0) continue
      lines.push(`## [${finding.categoryId}] ${finding.label}`)
      for (const item of items) lines.push(`- ${item}`)
      lines.push('')
    }
  }

  return {
    processed: 0,
    skipped: 0,
    errors: 0,
    dryRun: { targetFile: target.path, steps, rawLearningPreview: lines.join('\n') },
  }
}

/**
 * Run all 7 question battery categories in parallel.
 * Returns findings for categories that succeeded (null results are skipped).
 */
async function runBattery(
  runner: CognitiveRunner,
  documentText: string,
  userName: string
): Promise<BatteryFinding[]> {
  const results = await Promise.all(
    QUESTION_BATTERY.map(async (category) => {
      if (category.id === 'open_questions') {
        const result = await runner.call<{ questions: QuestionItem[] }>({
          prompt: category.prompt(documentText, userName),
          outputSchema: category.schema,
          example: category.example,
        })
        return {
          categoryId: category.id,
          label: category.label,
          results: result?.questions ?? [],
        } satisfies BatteryFinding
      } else {
        const result = await runner.call<{ findings: string[] }>({
          prompt: category.prompt(documentText, userName),
          outputSchema: category.schema,
          example: category.example,
        })
        return {
          categoryId: category.id,
          label: category.label,
          results: result?.findings ?? [],
        } satisfies BatteryFinding
      }
    })
  )

  return results
}

/**
 * Recursively collect all .md files under vaultPath, excluding _agent_vault/.
 * Returns vault-relative paths.
 */
async function collectVaultFiles(vaultPath: string): Promise<string[]> {
  const results: string[] = []

  async function walk(dir: string): Promise<void> {
    let entries: Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const absPath = path.join(dir, entry.name)
      const relPath = path.relative(vaultPath, absPath)

      // Skip system folders: underscore-prefixed dirs (e.g. _agent_vault, _inbox) and dot-prefixed (e.g. .obsidian)
      if (entry.isDirectory() && (entry.name.startsWith('_') || entry.name.startsWith('.'))) continue
      if (entry.isFile() && entry.name.startsWith('.')) continue

      if (entry.isDirectory()) {
        await walk(absPath)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(relPath)
      }
    }
  }

  await walk(vaultPath)
  return results
}
