import fs from 'node:fs/promises'
import path from 'node:path'

export const PERSONALIZATION_TOPICS = ['interests', 'values', 'career', 'health', 'family'] as const
export type PersonalizationTopic = typeof PERSONALIZATION_TOPICS[number]

export class PersonalizationManager {
  constructor(private vaultPath: string) {}

  private profileDir(): string {
    return path.join(this.vaultPath, '.thinkpod', 'user_profile')
  }

  topicPath(topic: PersonalizationTopic): string {
    return path.join(this.profileDir(), `${topic}.md`)
  }

  async getTopicContent(topic: PersonalizationTopic): Promise<string | null> {
    try {
      return await fs.readFile(this.topicPath(topic), 'utf-8')
    } catch {
      return null
    }
  }

  async writeTopicContent(topic: PersonalizationTopic, content: string): Promise<void> {
    await fs.mkdir(this.profileDir(), { recursive: true })
    await fs.writeFile(this.topicPath(topic), content, 'utf-8')
  }
}
