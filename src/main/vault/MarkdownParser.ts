import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

export interface DocumentMetadata {
  path: string       // relative to vault root
  title: string
  tags: string[]
}

export interface GraphNode {
  id: string         // relative file path
  label: string      // document title
  tags: string[]
  group: string      // primary tag for coloring
  val: number        // node size
}

export interface GraphLink {
  source: string
  target: string
  sharedTags: string[]
  weight: number
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

export interface TagStat {
  tag: string
  count: number
}

export interface StatsOverview {
  totalDocuments: number
  totalTags: number
  avgTagsPerDoc: number
  topTags: TagStat[]
}

const EXCLUDED_DIRS = new Set(['_thoughts', '_inbox', '_agent_vault', '.thinkpod', 'node_modules', '.git'])

export function parseMarkdownFile(filePath: string, vaultPath: string): DocumentMetadata {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const { data } = matter(content)
    const relativePath = path.relative(vaultPath, filePath)
    const rawTags = data.tags
    const tags: string[] = Array.isArray(rawTags)
      ? rawTags.map(String).filter(Boolean)
      : typeof rawTags === 'string' && rawTags
        ? [rawTags]
        : []

    return {
      path: relativePath,
      title: (data.title as string) || path.basename(filePath, '.md'),
      tags,
    }
  } catch {
    return {
      path: path.relative(vaultPath, filePath),
      title: path.basename(filePath, '.md'),
      tags: [],
    }
  }
}

async function collectMarkdownFiles(dir: string, vaultPath: string): Promise<string[]> {
  const results: string[] = []

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return results
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const relDir = path.relative(vaultPath, fullPath)
      const topLevel = relDir.split(path.sep)[0]
      if (!EXCLUDED_DIRS.has(topLevel) && !entry.name.startsWith('.')) {
        const sub = await collectMarkdownFiles(fullPath, vaultPath)
        results.push(...sub)
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath)
    }
  }

  return results
}

export async function buildGraphData(vaultPath: string): Promise<GraphData> {
  const filePaths = await collectMarkdownFiles(vaultPath, vaultPath)
  const docs = filePaths.map((fp) => parseMarkdownFile(fp, vaultPath))

  const nodes: GraphNode[] = docs.map((doc) => ({
    id: doc.path,
    label: doc.title,
    tags: doc.tags,
    group: doc.tags[0] || 'untagged',
    val: Math.min(doc.tags.length * 2 + 3, 15),
  }))

  const links: GraphLink[] = []
  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      const sharedTags = docs[i].tags.filter((t) => docs[j].tags.includes(t))
      if (sharedTags.length > 0) {
        links.push({
          source: docs[i].path,
          target: docs[j].path,
          sharedTags,
          weight: sharedTags.length,
        })
      }
    }
  }

  return { nodes, links }
}

export async function buildStatsOverview(vaultPath: string): Promise<StatsOverview> {
  const filePaths = await collectMarkdownFiles(vaultPath, vaultPath)
  const docs = filePaths.map((fp) => parseMarkdownFile(fp, vaultPath))

  const tagCounts = new Map<string, number>()
  let totalTagCount = 0

  for (const doc of docs) {
    for (const tag of doc.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
      totalTagCount++
    }
  }

  const topTags: TagStat[] = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  return {
    totalDocuments: docs.length,
    totalTags: tagCounts.size,
    avgTagsPerDoc: docs.length > 0 ? totalTagCount / docs.length : 0,
    topTags,
  }
}
