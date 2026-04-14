/**
 * LLM Utility Process — runs in an isolated Electron utility process.
 * Owns node-llama-cpp lifecycle and exposes an OpenAI-compatible HTTP server.
 * Communicates with the main process via process.parentPort (Electron IPC).
 */

import http from 'http'
import type { IncomingMessage, ServerResponse } from 'http'
import type { LlamaChatSession, ChatHistoryItem, ChatModelResponse } from 'node-llama-cpp'

type LlamaInstance = import('node-llama-cpp').Llama
type LlamaModelType = import('node-llama-cpp').LlamaModel
type LlamaContextType = import('node-llama-cpp').LlamaContext

// Electron utility process exposes parentPort on the global process object
declare const process: NodeJS.Process & {
  parentPort: {
    on(event: 'message', handler: (event: { data: unknown }) => void): void
    postMessage(message: unknown): void
  }
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// ── State ─────────────────────────────────────────────────────────────────────

let llama: LlamaInstance | null = null
let model: LlamaModelType | null = null
let context: LlamaContextType | null = null
let server: http.Server | null = null
let gpuLayers = -1

// ── IPC with main process ─────────────────────────────────────────────────────

process.parentPort.on('message', ({ data: msg }) => {
  const message = msg as { type: string; modelPath?: string; gpuLayers?: number }
  switch (message.type) {
    case 'start':
      gpuLayers = message.gpuLayers ?? -1
      handleStart(message.modelPath!).catch((err) => {
        process.parentPort.postMessage({ type: 'error', message: (err as Error).message })
        process.exit(1)
      })
      break
    case 'stop':
      handleStop().then(() => {
        process.parentPort.postMessage({ type: 'stopped' })
        process.exit(0)
      })
      break
    case 'ping':
      process.parentPort.postMessage({ type: 'pong' })
      break
  }
})

async function handleStart(modelPath: string): Promise<void> {
  try {
    process.parentPort.postMessage({ type: 'status', status: 'loading' })

    const { getLlama } = await import('node-llama-cpp')
    llama = await getLlama('lastBuild')
    model = await llama.loadModel({ modelPath, gpuLayers })
    context = await model.createContext({ contextSize: 4096, batchSize: 512 })

    const port = await findFreePort(8765)
    await startHttpServer(port)

    process.parentPort.postMessage({
      type: 'ready',
      url: `http://127.0.0.1:${port}/v1`,
    })
  } catch (err) {
    process.parentPort.postMessage({ type: 'error', message: (err as Error).message })
    process.exit(1)
  }
}

async function handleStop(): Promise<void> {
  server?.close()
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(context as any)?.dispose?.()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(model as any)?.dispose?.()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(llama as any)?.dispose?.()
  } catch {
    // ignore
  }
  context = null
  model = null
  llama = null
}

// ── HTTP Server ───────────────────────────────────────────────────────────────

async function startHttpServer(port: number): Promise<void> {
  server = http.createServer(async (req, res) => {
    try {
      await handleRequest(req, res)
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: { message: (err as Error).message } }))
      }
    }
  })
  await new Promise<void>((resolve, reject) => {
    server!.listen(port, '127.0.0.1', resolve)
    server!.on('error', reject)
  })
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = req.url ?? ''

  if (url === '/health' || url === '/v1/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }

  if (req.method === 'GET' && (url === '/v1/models' || url === '/models')) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        object: 'list',
        data: [{ id: 'builtin', object: 'model', created: Date.now() }],
      })
    )
    return
  }

  if (
    req.method === 'POST' &&
    (url === '/v1/chat/completions' || url === '/chat/completions')
  ) {
    const body = await readBody(req)
    const data = JSON.parse(body) as {
      messages: ChatMessage[]
      stream?: boolean
      max_tokens?: number
    }

    if (data.stream) {
      await streamInference(data.messages, res)
    } else {
      const content = await runInference(data.messages)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          id: `builtin-${Date.now()}`,
          object: 'chat.completion',
          model: 'builtin',
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
    }
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: { message: 'Not found' } }))
}

// ── Inference ─────────────────────────────────────────────────────────────────

async function runInference(messages: ChatMessage[]): Promise<string> {
  if (!model || !context) throw new Error('Model not loaded')

  const { LlamaChatSession } = await import('node-llama-cpp')
  const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
  }) as LlamaChatSession

  session.setChatHistory(buildHistory(messages))

  const lastUser = messages.filter((m) => m.role !== 'system').at(-1)
  if (!lastUser || lastUser.role !== 'user') {
    throw new Error('Last message must be from user')
  }

  return session.prompt(lastUser.content)
}

async function streamInference(messages: ChatMessage[], res: ServerResponse): Promise<void> {
  if (!model || !context) throw new Error('Model not loaded')

  const { LlamaChatSession } = await import('node-llama-cpp')
  const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
  }) as LlamaChatSession

  session.setChatHistory(buildHistory(messages))

  const lastUser = messages.filter((m) => m.role !== 'system').at(-1)
  if (!lastUser || lastUser.role !== 'user') {
    throw new Error('Last message must be from user')
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  const id = `builtin-${Date.now()}`
  await session.prompt(lastUser.content, {
    onTextChunk(token: string) {
      const chunk = JSON.stringify({
        id,
        object: 'chat.completion.chunk',
        model: 'builtin',
        choices: [{ index: 0, delta: { content: token }, finish_reason: null }],
      })
      res.write(`data: ${chunk}\n\n`)
    },
  })

  res.write('data: [DONE]\n\n')
  res.end()
}

function buildHistory(messages: ChatMessage[]): ChatHistoryItem[] {
  const history: ChatHistoryItem[] = []
  const systemText = messages.find((m) => m.role === 'system')?.content
  if (systemText) history.push({ type: 'system', text: systemText })

  const turns = messages.filter((m) => m.role !== 'system')
  for (let i = 0; i < turns.length - 1; i++) {
    const m = turns[i]
    if (m.role === 'user') {
      history.push({ type: 'user', text: m.content })
    } else {
      const modelResponse: ChatModelResponse = { type: 'model', response: [m.content] }
      history.push(modelResponse)
    }
  }
  return history
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function findFreePort(start: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const try_ = (port: number) => {
      const s = http.createServer()
      s.listen(port, '127.0.0.1', () => s.close(() => resolve(port)))
      s.on('error', () => {
        if (port < start + 20) {
          try_(port + 1)
        } else {
          reject(new Error('No free port found'))
        }
      })
    }
    try_(start)
  })
}
