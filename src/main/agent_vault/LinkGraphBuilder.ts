import fs from 'fs/promises'
import path from 'path'
import { Manifest } from './Manifest.js'

export interface LinkGraphEntry {
  mention_count: number
  files: string[]
  last_mentioned: number
  /** Computed at read time — not stored */
  days_since_mention?: number
}

export type LinkGraph = Record<string, LinkGraphEntry>

const LINK_GRAPH_FILE = 'link_graph.json'

export class LinkGraphBuilder {
  private graphPath: string

  constructor(agentVaultPath: string) {
    this.graphPath = path.join(agentVaultPath, LINK_GRAPH_FILE)
  }

  /**
   * Rebuild the entire link graph from the current manifest.
   * Called after each file is processed.
   */
  async rebuild(manifest: Manifest): Promise<void> {
    const graph: LinkGraph = {}
    const now = Date.now()

    for (const [filePath, entry] of Object.entries(manifest.files)) {
      const allTerms = [...entry.entities, ...entry.keywords]
      for (const term of allTerms) {
        if (!term || term.length < 2) continue
        if (!graph[term]) {
          graph[term] = { mention_count: 0, files: [], last_mentioned: 0 }
        }
        graph[term].mention_count++
        if (!graph[term].files.includes(filePath)) {
          graph[term].files.push(filePath)
        }
        if (entry.processed_at > graph[term].last_mentioned) {
          graph[term].last_mentioned = entry.processed_at
        }
      }
    }

    // Compute days_since_mention at write time for convenience
    for (const entry of Object.values(graph)) {
      entry.days_since_mention = Math.floor((now - entry.last_mentioned) / (1000 * 60 * 60 * 24))
    }

    await fs.writeFile(this.graphPath, JSON.stringify(graph, null, 2), 'utf-8')
  }

  async read(): Promise<LinkGraph> {
    try {
      const raw = await fs.readFile(this.graphPath, 'utf-8')
      const graph = JSON.parse(raw) as LinkGraph
      const now = Date.now()
      for (const entry of Object.values(graph)) {
        entry.days_since_mention = Math.floor((now - entry.last_mentioned) / (1000 * 60 * 60 * 24))
      }
      return graph
    } catch {
      return {}
    }
  }

  /**
   * Find files most closely related to the given set of entities,
   * by counting how many of the given entities each file shares.
   */
  async getRelatedFiles(entities: string[], excludeFile: string, limit: number = 3): Promise<string[]> {
    const graph = await this.read()
    const scores = new Map<string, number>()

    for (const entity of entities) {
      const entry = graph[entity]
      if (!entry) continue
      for (const file of entry.files) {
        if (file === excludeFile) continue
        scores.set(file, (scores.get(file) ?? 0) + 1)
      }
    }

    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([file]) => file)
  }
}
