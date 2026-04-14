/**
 * OpenAI-compatible LLM client
 * Works with mlx_lm.server, LM Studio, or any OpenAI-compatible endpoint
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  name?: string
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface LLMResponse {
  id: string
  content: string | null
  toolCalls: ToolCall[]
  model: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface LLMConfig {
  baseUrl: string
  model: string
  apiKey?: string
  maxTokens?: number
  responseFormat?: 'json_object' | 'text'
}

export class LLMClient {
  private config: LLMConfig

  constructor(config: LLMConfig) {
    this.config = {
      maxTokens: 2048,
      ...config,
    }
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    const url = `${this.config.baseUrl}/chat/completions`
    
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      max_tokens: this.config.maxTokens,
      temperature: 0.7,
    }

    if (this.config.responseFormat === 'json_object') {
      body.response_format = { type: 'json_object' }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`LLM request failed: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    
    const choice = data.choices[0]
    if (!choice) {
      throw new Error('No response from LLM')
    }

    return {
      id: data.id,
      content: choice.message?.content || null,
      toolCalls: choice.message?.tool_calls || [],
      model: data.model,
      usage: data.usage,
    }
  }

  async chatWithTools(
    messages: LLMMessage[],
    tools: unknown[]
  ): Promise<LLMResponse> {
    const url = `${this.config.baseUrl}/chat/completions`
    
    const body = {
      model: this.config.model,
      messages,
      tools,
      tool_choice: 'auto',
      max_tokens: this.config.maxTokens,
      temperature: 0.7,
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`LLM request failed: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    
    const choice = data.choices[0]
    if (!choice) {
      throw new Error('No response from LLM')
    }

    return {
      id: data.id,
      content: choice.message?.content || null,
      toolCalls: choice.message?.tool_calls || [],
      model: data.model,
      usage: data.usage,
    }
  }

  async *chatStream(messages: LLMMessage[]): AsyncGenerator<string> {
    const url = `${this.config.baseUrl}/chat/completions`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.config.model,
        messages,
        stream: true,
        max_tokens: this.config.maxTokens,
      }),
    })

    if (!response.ok || !response.body) {
      throw new Error(`Stream request failed: ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6).trim()
        if (payload === '[DONE]') return
        const chunk = JSON.parse(payload)
        const token = chunk.choices?.[0]?.delta?.content
        if (token) yield token as string
      }
    }
  }

  async healthCheck(): Promise<{ ok: boolean; models?: string[] }> {
    try {
      const url = `${this.config.baseUrl}/models`
      const headers: Record<string, string> = {}
      
      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`
      }

      const response = await fetch(url, { headers })
      
      if (!response.ok) {
        return { ok: false }
      }

      const data = await response.json()
      const models = data.data?.map((m: { id: string }) => m.id) || []
      
      return { ok: true, models }
    } catch {
      return { ok: false }
    }
  }
}
