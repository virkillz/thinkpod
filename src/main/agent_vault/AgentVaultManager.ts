import fs from 'fs/promises'
import path from 'path'
import { ManifestManager } from './Manifest.js'
import { LinkGraphBuilder } from './LinkGraphBuilder.js'

/**
 * Folder schema for _agent_vault/:
 *
 * _agent_vault/
 *   manifest.json
 *   link_graph.json
 *   learning/
 *     character.md  facts.md  people.md  projects.md
 *     goals.md  beliefs.md  open_questions.md  dropped_questions.md
 *   raw_learning/
 *   insights/
 *   inbox/
 *     threads/
 *   synthesis/
 *   inspiration/
 *   plans/
 */

const AGENT_VAULT_DIR = '_agent_vault'

const SUBDIRS = [
  'learning',
  'raw_learning',
  'insights',
  path.join('inbox', 'threads'),
  'synthesis',
  'inspiration',
  'plans',
]

const LEARNING_FILES = [
  'character.md',
  'facts.md',
  'people.md',
  'projects.md',
  'goals.md',
  'beliefs.md',
  'open_questions.md',
  'dropped_questions.md',
]

export class AgentVaultManager {
  readonly vaultPath: string
  readonly agentVaultPath: string
  readonly manifest: ManifestManager
  readonly linkGraph: LinkGraphBuilder

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath
    this.agentVaultPath = path.join(vaultPath, AGENT_VAULT_DIR)
    this.manifest = new ManifestManager(this.agentVaultPath)
    this.linkGraph = new LinkGraphBuilder(this.agentVaultPath)
  }

  async initialize(): Promise<void> {
    await this.ensureFolderStructure()
  }

  private async ensureFolderStructure(): Promise<void> {
    // Root
    await fs.mkdir(this.agentVaultPath, { recursive: true })

    // Subdirectories
    for (const subdir of SUBDIRS) {
      await fs.mkdir(path.join(this.agentVaultPath, subdir), { recursive: true })
    }

    // Empty learning files (only if they don't exist)
    for (const file of LEARNING_FILES) {
      const filePath = path.join(this.agentVaultPath, 'learning', file)
      try {
        await fs.access(filePath)
      } catch {
        await fs.writeFile(filePath, '', 'utf-8')
      }
    }

    // manifest.json (only if missing)
    const manifestPath = path.join(this.agentVaultPath, 'manifest.json')
    try {
      await fs.access(manifestPath)
    } catch {
      await fs.writeFile(
        manifestPath,
        JSON.stringify({ files: {}, last_note_review: null, last_question_hunt: null }, null, 2),
        'utf-8'
      )
    }

    // link_graph.json (only if missing)
    const graphPath = path.join(this.agentVaultPath, 'link_graph.json')
    try {
      await fs.access(graphPath)
    } catch {
      await fs.writeFile(graphPath, JSON.stringify({}, null, 2), 'utf-8')
    }
  }

  // ── Path helpers ──────────────────────────────────────────────────────────

  paths = {
    agentVault: () => this.agentVaultPath,
    learning: (name: LearningFileName) =>
      path.join(this.agentVaultPath, 'learning', `${name}.md`),
    openQuestions: () => path.join(this.agentVaultPath, 'learning', 'open_questions.md'),
    droppedQuestions: () => path.join(this.agentVaultPath, 'learning', 'dropped_questions.md'),
    rawLearning: (slug: string) =>
      path.join(this.agentVaultPath, 'raw_learning', `${slug}.md`),
    thread: (threadId: string) =>
      path.join(this.agentVaultPath, 'inbox', 'threads', `${threadId}.md`),
    threads: () => path.join(this.agentVaultPath, 'inbox', 'threads'),
    synthesis: (filename: string) =>
      path.join(this.agentVaultPath, 'synthesis', filename),
    inspiration: (filename: string) =>
      path.join(this.agentVaultPath, 'inspiration', filename),
    plans: (filename: string) =>
      path.join(this.agentVaultPath, 'plans', filename),
    vaultIndex: () => path.join(this.agentVaultPath, 'index.md'),
  }
}

export type LearningFileName =
  | 'character'
  | 'facts'
  | 'people'
  | 'projects'
  | 'goals'
  | 'beliefs'
