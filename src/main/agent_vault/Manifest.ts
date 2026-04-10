import fs from 'fs/promises'
import path from 'path'

export interface ManifestEntry {
  hash: string
  processed_at: number
  word_count: number
  keywords: string[]
  entities: string[]
  raw_learning_file: string
  last_surfaced?: number
}

export interface Manifest {
  files: Record<string, ManifestEntry>
  last_note_review: number | null
  last_question_hunt: number | null
}

const EMPTY_MANIFEST: Manifest = {
  files: {},
  last_note_review: null,
  last_question_hunt: null,
}

export class ManifestManager {
  private manifestPath: string
  private manifest: Manifest | null = null

  constructor(agentVaultPath: string) {
    this.manifestPath = path.join(agentVaultPath, 'manifest.json')
  }

  private async load(): Promise<Manifest> {
    if (this.manifest) return this.manifest
    try {
      const raw = await fs.readFile(this.manifestPath, 'utf-8')
      this.manifest = JSON.parse(raw) as Manifest
    } catch {
      this.manifest = { ...EMPTY_MANIFEST, files: {} }
    }
    return this.manifest
  }

  private async save(): Promise<void> {
    await fs.writeFile(this.manifestPath, JSON.stringify(this.manifest, null, 2), 'utf-8')
  }

  async getEntry(filePath: string): Promise<ManifestEntry | null> {
    const manifest = await this.load()
    return manifest.files[filePath] ?? null
  }

  async upsertEntry(filePath: string, entry: ManifestEntry): Promise<void> {
    const manifest = await this.load()
    manifest.files[filePath] = entry
    await this.save()
  }

  /**
   * Returns paths of files not in manifest or whose stored hash differs
   * from the provided hash map. Sorted newest-first.
   */
  async getUnprocessed(
    allFiles: Array<{ path: string; mtime: number; hash: string }>,
    limit: number
  ): Promise<string[]> {
    const manifest = await this.load()
    const unprocessed = allFiles
      .filter((f) => {
        const entry = manifest.files[f.path]
        return !entry || entry.hash !== f.hash
      })
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, limit)
      .map((f) => f.path)
    return unprocessed
  }

  async getChangedFiles(
    allFiles: Array<{ path: string; hash: string }>
  ): Promise<string[]> {
    const manifest = await this.load()
    return allFiles
      .filter((f) => {
        const entry = manifest.files[f.path]
        return entry && entry.hash !== f.hash
      })
      .map((f) => f.path)
  }

  async setLastNoteReview(timestamp: number): Promise<void> {
    const manifest = await this.load()
    manifest.last_note_review = timestamp
    await this.save()
  }

  async setLastQuestionHunt(timestamp: number): Promise<void> {
    const manifest = await this.load()
    manifest.last_question_hunt = timestamp
    await this.save()
  }

  async getAll(): Promise<Manifest> {
    return this.load()
  }

  /** Force reload from disk (e.g. after external write) */
  invalidate(): void {
    this.manifest = null
  }
}
