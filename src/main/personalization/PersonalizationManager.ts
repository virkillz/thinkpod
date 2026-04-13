import fs from 'node:fs/promises'
import path from 'node:path'

export const PERSONALIZATION_TOPICS = ['interests', 'values', 'career', 'health', 'family'] as const
export type PersonalizationTopic = typeof PERSONALIZATION_TOPICS[number]

const TOPIC_META: Record<PersonalizationTopic, { topics: string; loadWhen: string }> = {
  interests: { topics: 'hobbies, media, sports', loadWhen: 'recommendations, leisure, creativity' },
  values: { topics: 'beliefs, communication prefs', loadWhen: 'sensitive topics, big decisions' },
  career: { topics: 'job, skills, goals, frustrations', loadWhen: 'work, productivity, career advice' },
  health: { topics: 'conditions, routines, goals', loadWhen: 'health, wellness, lifestyle topics' },
  family: { topics: 'spouse, kids, parents, dynamics', loadWhen: 'relationship/family topics' },
}

export class PersonalizationManager {
  constructor(private vaultPath: string) {}

  private profileDir(): string {
    return path.join(this.vaultPath, '.thinkpod', 'user_profile')
  }

  topicPath(topic: PersonalizationTopic): string {
    return path.join(this.profileDir(), `${topic}.md`)
  }

  summaryPath(): string {
    return path.join(this.profileDir(), 'summary.md')
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

  async getSummaryContent(): Promise<string | null> {
    try {
      return await fs.readFile(this.summaryPath(), 'utf-8')
    } catch {
      return null
    }
  }

  async writeSummaryContent(content: string): Promise<void> {
    await fs.mkdir(this.profileDir(), { recursive: true })
    await fs.writeFile(this.summaryPath(), content, 'utf-8')
  }

  async buildProfileReference(): Promise<{ topic: PersonalizationTopic; relativePath: string; meta: { topics: string; loadWhen: string } }[]> {
    const result: { topic: PersonalizationTopic; relativePath: string; meta: { topics: string; loadWhen: string } }[] = []
    for (const topic of PERSONALIZATION_TOPICS) {
      const content = await this.getTopicContent(topic)
      if (content) {
        result.push({
          topic,
          relativePath: `.thinkpod/user_profile/${topic}.md`,
          meta: TOPIC_META[topic],
        })
      }
    }
    return result
  }

  async getFilledTopics(): Promise<PersonalizationTopic[]> {
    const filled: PersonalizationTopic[] = []
    for (const topic of PERSONALIZATION_TOPICS) {
      const content = await this.getTopicContent(topic)
      if (content) filled.push(topic)
    }
    return filled
  }
}
