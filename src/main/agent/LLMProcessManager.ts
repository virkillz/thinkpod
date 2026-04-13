/**
 * LLM Process Manager
 * Loads a GGUF model in-process via node-llama-cpp (with Metal on Apple Silicon,
 * CUDA on Linux/Windows with NVIDIA, CPU fallback everywhere) and exposes it as
 * a minimal OpenAI-compatible HTTP server on localhost.
 *
 * This means all existing LLMClient usage works unchanged — handlers just point
 * their baseUrl at the local server URL returned by getUrl().
 */

import { EventEmitter } from 'events'
import http from 'http'
import type { IncomingMessage, ServerResponse } from 'http'
import type {
  LlamaChatSession,
  ChatHistoryItem,
  ChatModelResponse,
} from 'node-llama-cpp'

type LlamaInstance = import('node-llama-cpp').Llama
type LlamaModelType = import('node-llama-cpp').LlamaModel

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export class LLMProcessManager extends EventEmitter {
  private llama: LlamaInstance | null = null
  private model: LlamaModelType | null = null
  private server: http.Server | null = null
  private serverUrl: string | null = null
  private isLoading = false

  constructor() {
    super()
  }

  /**
   * Load the GGUF model into memory and start the local HTTP server.
   */
  async start(modelPath: string): Promise<boolean> {
    if (this.model || this.isLoading) return false

    this.isLoading = true
    console.log('[LLMProcessManager.start] emitting loading status')
    this.emit('status', 'loading')

    try {
      console.log('[LLMProcessManager.start] importing node-llama-cpp...')
      const { getLlama } = await import('node-llama-cpp')

      console.log('[LLMProcessManager.start] calling getLlama("lastBuild")...')
      this.llama = await getLlama('lastBuild')
      console.log('[LLMProcessManager.start] llama instance created, loading model from:', modelPath)

      console.log('[LLMProcessManager.start] calling llama.loadModel()...')
      this.model = await this.llama.loadModel({ modelPath })
      console.log('[LLMProcessManager.start] model loaded, starting HTTP server...')

      this.serverUrl = await this.startHttpServer()
      console.log('[LLMProcessManager.start] server started at:', this.serverUrl)

      this.isLoading = false
      this.emit('status', 'ready')
      return true
    } catch (error) {
      console.error('[LLMProcessManager.start] error:', error)
      this.isLoading = false
      this.model = null
      this.llama = null
      this.emit('error', (error as Error).message)
      return false
    }
  }

  stop(): void {
    this.server?.close()
    this.server = null
    this.serverUrl = null

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(this.model as any)?.dispose?.()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(this.llama as any)?.dispose?.()
    } catch {
      // ignore
    }

    this.model = null
    this.llama = null
    this.isLoading = false
    this.emit('status', 'stopped')
  }

  isRunning(): boolean {
    return this.model !== null && this.server !== null
  }

  getUrl(): string | null {
    return this.serverUrl
  }

  // ── Local HTTP server ────────────────────────────────────────────────────────

  private async startHttpServer(): Promise<string> {
    const port = await this.findFreePort(8765)

    this.server = http.createServer(async (req, res) => {
      try {
        await this.handleRequest(req, res)
      } catch (err) {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: { message: (err as Error).message } }))
        }
      }
    })

    return new Promise((resolve, reject) => {
      this.server!.listen(port, '127.0.0.1', () => {
        resolve(`http://127.0.0.1:${port}/v1`)
      })
      this.server!.on('error', reject)
    })
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url ?? ''

    // Health check
    if (url === '/health' || url === '/v1/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok' }))
      return
    }

    // Models list — required for LLMClient.healthCheck()
    if (req.method === 'GET' && (url === '/v1/models' || url === '/models')) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          object: 'list',
          data: [{ id: 'gemma-4-e4b-builtin', object: 'model', created: Date.now() }],
        })
      )
      return
    }

    // Chat completions — main inference endpoint
    if (
      req.method === 'POST' &&
      (url === '/v1/chat/completions' || url === '/chat/completions')
    ) {
      const body = await this.readBody(req)
      const data = JSON.parse(body) as { messages: ChatMessage[]; max_tokens?: number }
      const content = await this.runInference(data.messages)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          id: `builtin-${Date.now()}`,
          object: 'chat.completion',
          model: 'gemma-4-e4b-builtin',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        })
      )
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: { message: 'Not found' } }))
  }

  private async runInference(messages: ChatMessage[]): Promise<string> {
    if (!this.model) throw new Error('Model not loaded')

    const { LlamaChatSession } = await import('node-llama-cpp')

    const context = await this.model.createContext({ contextSize: 4096 })
    try {
      const session = new LlamaChatSession({
        contextSequence: context.getSequence(),
      }) as LlamaChatSession

      // Build chat history from all messages except the last user message.
      // setChatHistory() loads it into context without running inference.
      const history: ChatHistoryItem[] = []
      const turns = messages.filter((m) => m.role !== 'system')
      const systemMsg = messages.find((m) => m.role === 'system')?.content

      if (systemMsg) {
        history.push({ type: 'system', text: systemMsg })
      }

      // All turns except the final user message go into history
      for (let i = 0; i < turns.length - 1; i++) {
        const msg = turns[i]
        if (msg.role === 'user') {
          history.push({ type: 'user', text: msg.content })
        } else if (msg.role === 'assistant') {
          const modelResponse: ChatModelResponse = {
            type: 'model',
            response: [msg.content],
          }
          history.push(modelResponse)
        }
      }

      session.setChatHistory(history)

      const lastUser = turns[turns.length - 1]
      if (!lastUser || lastUser.role !== 'user') {
        throw new Error('Last message must be from user')
      }

      return await session.prompt(lastUser.content)
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (context as any).dispose?.()
    }
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = ''
      req.on('data', (chunk) => (data += chunk))
      req.on('end', () => resolve(data))
      req.on('error', reject)
    })
  }

  private findFreePort(startPort: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const tryPort = (port: number) => {
        const server = http.createServer()
        server.listen(port, '127.0.0.1', () => {
          server.close(() => resolve(port))
        })
        server.on('error', () => {
          if (port < startPort + 20) {
            tryPort(port + 1)
          } else {
            reject(new Error('No free port found'))
          }
        })
      }
      tryPort(startPort)
    })
  }
}
