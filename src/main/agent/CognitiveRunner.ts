import { LLMClient, LLMConfig } from './LLMClient.js'
import { buildCognitiveSystemInstruction, buildCognitiveRetryInstruction } from './prompts.js'

export interface CognitiveCallConfig {
  /** Narrow, pre-assembled prompt describing the task and source content */
  prompt: string
  /** JSON schema for validating the response */
  outputSchema: SchemaObject
  /** Filled-in example so the model knows exactly what shape to return */
  example: object
  /** Default: 800 */
  maxTokens?: number
}

export interface SchemaObject {
  type: 'object'
  properties: Record<string, unknown>
  required?: string[]
}

/**
 * Single-call LLM runner that returns validated JSON or null.
 *
 * Distinct from AgentLoop (which is multi-turn, free-form tool-calling).
 * CognitiveRunner is used for all cognitive jobs: one call, one JSON response,
 * validate, retry once on failure, then give up gracefully.
 */
export class CognitiveRunner {
  private client: LLMClient

  constructor(llmConfig: LLMConfig) {
    this.client = new LLMClient({
      ...llmConfig,
      maxTokens: 800,
    })
  }

  async call<T = unknown>(config: CognitiveCallConfig): Promise<T | null> {
    const maxTokens = config.maxTokens ?? 800
    const systemInstruction = this.buildSystemInstruction(config.outputSchema, config.example)

    // First attempt
    const result = await this.attempt<T>(config.prompt, systemInstruction, maxTokens, config.outputSchema)
    if (result !== null) return result

    // Retry once with a stricter re-prompt
    console.warn('[CognitiveRunner] First attempt failed validation, retrying...')
    const retryInstruction = buildCognitiveRetryInstruction(config.outputSchema, config.example)

    const retryResult = await this.attempt<T>(config.prompt, retryInstruction, maxTokens, config.outputSchema)
    if (retryResult === null) {
      console.error('[CognitiveRunner] Both attempts failed validation. Skipping.')
    }
    return retryResult
  }

  private async attempt<T>(
    userPrompt: string,
    systemInstruction: string,
    maxTokens: number,
    schema: SchemaObject
  ): Promise<T | null> {
    try {
      const response = await this.client.chat([
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt },
      ])

      const raw = response.content
      if (!raw) return null

      const parsed = this.extractJSON(raw)
      if (!parsed) return null

      if (!this.validate(parsed, schema)) return null

      return parsed as T
    } catch (err) {
      console.error('[CognitiveRunner] LLM call error:', err)
      return null
    }
  }

  private buildSystemInstruction(schema: SchemaObject, example: object): string {
    return buildCognitiveSystemInstruction(schema, example)
  }

  /**
   * Extract a JSON object from a model response that may include extra text.
   */
  private extractJSON(raw: string): unknown {
    // Strip markdown fences if present
    const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

    // Try full string first
    try {
      return JSON.parse(stripped)
    } catch {
      // Try to find the first { ... } block
      const start = stripped.indexOf('{')
      const end = stripped.lastIndexOf('}')
      if (start !== -1 && end > start) {
        try {
          return JSON.parse(stripped.slice(start, end + 1))
        } catch {
          return null
        }
      }
      return null
    }
  }

  /**
   * Minimal schema validation: checks required top-level keys exist
   * and that array properties are actually arrays.
   */
  private validate(data: unknown, schema: SchemaObject): boolean {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return false

    const obj = data as Record<string, unknown>

    // Check required fields
    for (const key of schema.required ?? []) {
      if (!(key in obj)) return false
    }

    // Check types of known properties
    for (const [key, schemaProp] of Object.entries(schema.properties)) {
      if (!(key in obj)) continue
      const prop = schemaProp as { type?: string }
      if (prop.type === 'array' && !Array.isArray(obj[key])) return false
      if (prop.type === 'string' && typeof obj[key] !== 'string') return false
      if (prop.type === 'number' && typeof obj[key] !== 'number') return false
      if (prop.type === 'boolean' && typeof obj[key] !== 'boolean') return false
    }

    return true
  }
}
