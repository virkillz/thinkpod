import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

export interface ThreadMessage {
  role: 'agent' | 'human'
  timestamp: number
  content: string
}

export interface ThreadFrontmatter {
  thread_id: string
  type: 'question' | 'insight' | 'recommendation' | 'plan' | 'housekeeping'
  status: 'active' | 'awaiting_reply' | 'replied' | 'resolved'
  created: number
  related_questions?: string[]
  source_job?: string
}

export interface Thread {
  thread_id: string
  filePath: string
  frontmatter: ThreadFrontmatter
  messages: ThreadMessage[]
}

export class InboxThreadManager {
  constructor(private inboxPath: string) {}

  private getThreadPath(threadId: string): string {
    return path.join(this.inboxPath, `thread-${threadId}.md`)
  }

  private parseThreadFile(content: string, filePath: string): Thread | null {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (!frontmatterMatch) return null

    const frontmatterLines = frontmatterMatch[1].split('\n')
    const fm: Partial<ThreadFrontmatter> = {}

    for (const line of frontmatterLines) {
      const colonIndex = line.indexOf(':')
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim()
        const value = line.slice(colonIndex + 1).trim()
        if (key === 'thread_id') fm.thread_id = value
        else if (key === 'type') fm.type = value as ThreadFrontmatter['type']
        else if (key === 'status') fm.status = value as ThreadFrontmatter['status']
        else if (key === 'created') fm.created = parseInt(value, 10)
        else if (key === 'source_job') fm.source_job = value
        else if (key === 'related_questions') {
          try {
            fm.related_questions = JSON.parse(value)
          } catch {
            fm.related_questions = []
          }
        }
      }
    }

    if (!fm.thread_id || !fm.type) return null

    // Parse messages after frontmatter
    const body = content.slice(frontmatterMatch[0].length).trim()
    const messages: ThreadMessage[] = []

    const messageRegex = /## (Agent|Human) — ([\d-T:]{19,})\n\n([\s\S]*?)(?=\n## (Agent|Human) — |$)/g
    let match
    while ((match = messageRegex.exec(body)) !== null) {
      messages.push({
        role: match[1].toLowerCase() as 'agent' | 'human',
        timestamp: new Date(match[2]).getTime(),
        content: match[3].trim(),
      })
    }

    return {
      thread_id: fm.thread_id,
      filePath,
      frontmatter: fm as ThreadFrontmatter,
      messages,
    }
  }

  async createThread(
    type: ThreadFrontmatter['type'],
    initialMessage: string,
    opts?: { sourceJob?: string; relatedQuestions?: string[] }
  ): Promise<Thread> {
    const threadId = randomUUID().slice(0, 8)
    const now = Date.now()
    const filePath = this.getThreadPath(threadId)

    const fm: ThreadFrontmatter = {
      thread_id: threadId,
      type,
      status: type === 'question' ? 'awaiting_reply' : 'active',
      created: now,
      source_job: opts?.sourceJob,
      related_questions: opts?.relatedQuestions,
    }

    const content = this.serializeThread(fm, [
      { role: 'agent', timestamp: now, content: initialMessage },
    ])

    await fs.mkdir(this.inboxPath, { recursive: true })
    await fs.writeFile(filePath, content, 'utf-8')

    return {
      thread_id: threadId,
      filePath,
      frontmatter: fm,
      messages: [{ role: 'agent', timestamp: now, content: initialMessage }],
    }
  }

  async appendReply(threadId: string, replyText: string): Promise<Thread | null> {
    const filePath = this.getThreadPath(threadId)
    let content: string
    try {
      content = await fs.readFile(filePath, 'utf-8')
    } catch {
      return null
    }

    const thread = this.parseThreadFile(content, filePath)
    if (!thread) return null

    // Append human message
    const humanMessage: ThreadMessage = {
      role: 'human',
      timestamp: Date.now(),
      content: replyText,
    }
    thread.messages.push(humanMessage)
    thread.frontmatter.status = 'replied'

    // Write updated thread
    const newContent = this.serializeThread(thread.frontmatter, thread.messages)
    await fs.writeFile(filePath, newContent, 'utf-8')

    return thread
  }

  async appendAgentResponse(threadId: string, responseText: string): Promise<Thread | null> {
    const filePath = this.getThreadPath(threadId)
    let content: string
    try {
      content = await fs.readFile(filePath, 'utf-8')
    } catch {
      return null
    }

    const thread = this.parseThreadFile(content, filePath)
    if (!thread) return null

    // Append agent message
    const agentMessage: ThreadMessage = {
      role: 'agent',
      timestamp: Date.now(),
      content: responseText,
    }
    thread.messages.push(agentMessage)

    // Update status based on thread type
    if (thread.frontmatter.type === 'question') {
      thread.frontmatter.status = 'awaiting_reply'
    }

    // Write updated thread
    const newContent = this.serializeThread(thread.frontmatter, thread.messages)
    await fs.writeFile(filePath, newContent, 'utf-8')

    return thread
  }

  async getThread(threadId: string): Promise<Thread | null> {
    const filePath = this.getThreadPath(threadId)
    let content: string
    try {
      content = await fs.readFile(filePath, 'utf-8')
    } catch {
      return null
    }
    return this.parseThreadFile(content, filePath)
  }

  async getAllThreads(): Promise<Thread[]> {
    let entries: string[]
    try {
      entries = await fs.readdir(this.inboxPath)
    } catch {
      return []
    }

    const threads: Thread[] = []
    for (const entry of entries) {
      if (entry.startsWith('thread-') && entry.endsWith('.md')) {
        const filePath = path.join(this.inboxPath, entry)
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          const thread = this.parseThreadFile(content, filePath)
          if (thread) threads.push(thread)
        } catch {
          // Skip unreadable files
        }
      }
    }

    return threads.sort((a, b) => b.frontmatter.created - a.frontmatter.created)
  }

  async getRepliedThreads(): Promise<Thread[]> {
    const all = await this.getAllThreads()
    return all.filter((t) => t.frontmatter.status === 'replied')
  }

  async resolveThread(threadId: string): Promise<boolean> {
    const filePath = this.getThreadPath(threadId)
    let content: string
    try {
      content = await fs.readFile(filePath, 'utf-8')
    } catch {
      return false
    }

    const thread = this.parseThreadFile(content, filePath)
    if (!thread) return false

    thread.frontmatter.status = 'resolved'
    const newContent = this.serializeThread(thread.frontmatter, thread.messages)
    await fs.writeFile(filePath, newContent, 'utf-8')
    return true
  }

  private serializeThread(fm: ThreadFrontmatter, messages: ThreadMessage[]): string {
    const frontmatter = `---
thread_id: ${fm.thread_id}
type: ${fm.type}
status: ${fm.status}
created: ${fm.created}${fm.source_job ? `\nsource_job: ${fm.source_job}` : ''}${fm.related_questions?.length ? `\nrelated_questions: ${JSON.stringify(fm.related_questions)}` : ''}
---`

    const body = messages
      .map((m) => {
        const date = new Date(m.timestamp).toISOString().slice(0, 19).replace('T', ' ')
        return `## ${m.role.charAt(0).toUpperCase() + m.role.slice(1)} — ${date}\n\n${m.content}`
      })
      .join('\n\n')

    return `${frontmatter}\n\n${body}\n`
  }
}
