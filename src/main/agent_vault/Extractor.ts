import crypto from 'crypto'

/**
 * Pure string processing utilities — no model calls.
 */

export function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex')
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Extract top N keywords by frequency, excluding common stop words.
 */
export function extractKeywords(text: string, topN: number = 10): string[] {
  const STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'shall', 'can', 'this', 'that',
    'these', 'those', 'it', 'its', 'i', 'you', 'he', 'she', 'we', 'they',
    'my', 'your', 'his', 'her', 'our', 'their', 'me', 'him', 'us', 'them',
    'not', 'no', 'so', 'if', 'as', 'up', 'out', 'about', 'what', 'which',
    'who', 'when', 'where', 'how', 'all', 'just', 'also', 'more', 'than',
    'then', 'into', 'over', 'after', 'before', 'between', 'such', 'through',
    'during', 'each', 'very', 'any', 'some', 'only', 'new', 'now', 'get',
  ])

  const freq = new Map<string, number>()
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))

  for (const word of words) {
    freq.set(word, (freq.get(word) ?? 0) + 1)
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word)
}

/**
 * Extract entities: wikilinks [[name]], markdown link text [text](...),
 * and capitalized proper noun phrases.
 */
export function extractEntities(text: string): string[] {
  const entities = new Set<string>()

  // [[wikilinks]]
  for (const match of text.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const name = match[1].split('|')[0].trim() // handle [[name|alias]]
    if (name) entities.add(name)
  }

  // [text](link) — capture the display text only
  for (const match of text.matchAll(/\[([^\]]+)\]\([^)]+\)/g)) {
    const name = match[1].trim()
    if (name && name.length > 1) entities.add(name)
  }

  // Capitalized proper noun phrases (1-3 words, each starting with uppercase)
  const properNounRegex = /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2})\b/g
  for (const match of text.matchAll(properNounRegex)) {
    const noun = match[1].trim()
    // Skip single very common words and sentence starters by requiring 2+ words
    // or by checking it's not at the start of a sentence (heuristic: exclude if
    // preceded by '. ' or is the very first word)
    if (noun.includes(' ') || noun.length > 4) {
      entities.add(noun)
    }
  }

  return [...entities]
}
