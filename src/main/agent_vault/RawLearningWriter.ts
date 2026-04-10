import fs from 'fs/promises'
import path from 'path'
import type { AgentVaultManager } from './AgentVaultManager.js'

export interface BatteryFinding {
  categoryId: string
  label: string
  /** For most categories: string[]. For open_questions: QuestionItem[] */
  results: string[] | QuestionItem[]
}

export interface QuestionItem {
  question: string
  search_method: 'internal_vault' | 'web' | 'ask_human'
}

/**
 * Takes battery results and writes a structured raw learning note.
 * Returns the path to the written file.
 */
export async function writeRawLearningNote(
  sourcePath: string,
  findings: BatteryFinding[],
  manager: AgentVaultManager
): Promise<string> {
  const slug = slugify(sourcePath)
  const outPath = manager.paths.rawLearning(slug)

  const now = new Date().toISOString()
  const lines: string[] = [
    '---',
    `source: ${sourcePath}`,
    `processed_at: ${now}`,
    '---',
    '',
  ]

  for (const finding of findings) {
    if (finding.categoryId === 'open_questions') {
      const questions = finding.results as QuestionItem[]
      if (questions.length === 0) continue
      lines.push(`## [${finding.categoryId}] ${finding.label}`)
      for (const q of questions) {
        lines.push(`- [ ] ${q.question} [search: ${q.search_method}]`)
      }
      lines.push('')
    } else {
      const items = finding.results as string[]
      if (items.length === 0) continue
      lines.push(`## [${finding.categoryId}] ${finding.label}`)
      for (const item of items) {
        lines.push(`- ${item}`)
      }
      lines.push('')
    }
  }

  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, lines.join('\n'), 'utf-8')
  return outPath
}

/**
 * Turn a vault-relative file path into a safe filename slug.
 * e.g. "notes/journal/2026-04-01.md" → "notes__journal__2026-04-01"
 */
function slugify(filePath: string): string {
  return filePath
    .replace(/\.md$/i, '')
    .replace(/[/\\]+/g, '__')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 120)
}
