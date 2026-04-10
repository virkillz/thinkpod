import fs from 'node:fs/promises'
import path from 'node:path'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  ts: number
}

export class ChatSession {
  private filePath: string

  constructor(sessionsDir: string, sessionId: string) {
    this.filePath = path.join(sessionsDir, `${sessionId}.jsonl`)
  }

  static sessionsDir(vaultPath: string): string {
    return path.join(vaultPath, '.scriptorium', 'sessions')
  }

  static async ensure(vaultPath: string): Promise<void> {
    await fs.mkdir(ChatSession.sessionsDir(vaultPath), { recursive: true })
  }

  async readAll(): Promise<ChatMessage[]> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8')
      return raw
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line) as ChatMessage)
    } catch {
      return []
    }
  }

  async append(message: ChatMessage): Promise<void> {
    await fs.appendFile(this.filePath, JSON.stringify(message) + '\n', 'utf-8')
  }

  async clear(): Promise<void> {
    await fs.writeFile(this.filePath, '', 'utf-8')
  }
}
