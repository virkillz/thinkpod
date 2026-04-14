# Implementation Plan: Replicating LM Studio Architecture

**Goal**: Transform ThinkPod's built-in LLM into a production-grade inference engine matching LM Studio's architecture and performance.

**Status**: Phase 1 ✅ Complete | Phase 2 ✅ Complete | Phase 3 ✅ Complete | Phase 4-5 Pending

---

## Phase 1: Critical Stability Fixes ✅ COMPLETED

### 1.1 Context Lifecycle Management ✅
- **Status**: Implemented
- **File**: `src/main/agent/LLMProcessManager.ts`
- **Changes**:
  - Persistent context instead of per-request creation
  - Proper disposal order (context → model → llama)
  - Added batch size configuration
- **Impact**: Eliminates crashes from memory fragmentation

### 1.2 GPU Layer Control ✅
- **Status**: Implemented
- **File**: `src/main/agent/LLMProcessManager.ts`
- **Changes**:
  - Added `setGpuLayers(layers: number)` method
  - Configurable GPU offloading (-1 = auto, 0 = CPU, N = N layers)
- **Impact**: Prevents VRAM exhaustion on smaller GPUs

---

## Phase 2: Process Isolation 🔴 HIGH PRIORITY

### 2.1 Architecture

**Goal**: Move inference out of the main Electron process to prevent UI freezes and survive crashes without taking down the app.

```
Main Process (Electron)
  ├── Renderer (React UI) ──────── IPC ──────┐
  └── Utility Process (LLM Server)           │
       ├── node-llama-cpp (model + context)  │
       └── HTTP Server :8765 ◄───────────────┘
            └── OpenAI-compatible /v1 API
```

**Why `utilityProcess` over `child_process.fork`**:

Electron's `utilityProcess` API (added in Electron 22) is the official, recommended way to spawn a child process from the main process. Unlike `child_process.fork`, it:

- Runs under Chromium's Services API — properly sandboxed and managed by Electron's process lifecycle
- Avoids `ELECTRON_RUN_AS_NODE` issues that plague `child_process.fork` on packaged apps
- Can establish MessagePort channels directly with renderer processes (future capability)
- Is correctly included in Electron's crash reporter and process supervision

The utility process loads `node-llama-cpp`, starts a local HTTP server on port 8765, and exposes an OpenAI-compatible `/v1` API. The existing `LLMClient` connects to this URL unchanged. Main process ↔ utility process communication (start/stop/status) goes through `utilityProcess.postMessage()` and `process.parentPort`.

**Cons to plan for**:
- The compiled utility process script path must be explicitly included in the app bundle (`extraResources` or `files` in electron-builder)
- electron-vite needs a second entry point for the utility process script
- IPC message roundtrip adds ~0.5ms overhead (negligible vs. inference latency)

### 2.2 Implementation Steps

#### Step 1: Add Utility Process Entry Point to Build System

**File**: `electron.vite.config.ts`

```typescript
export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          'llm-server': resolve(__dirname, 'src/main/agent/llm-server.ts'), // new
        },
      },
    },
  },
  // ...
})
```

**File**: `electron-builder.config.js` — ensure the compiled server script is bundled:

```javascript
extraResources: [
  { from: 'out/main/llm-server.js', to: 'llm-server.js' },
]
```

> In development, electron-vite outputs to `out/main/`. In production, the packaged path is `process.resourcesPath + '/llm-server.js'`. The manager must resolve the correct path at runtime.

#### Step 2: Create the Utility Process Server Script

**File**: `src/main/agent/llm-server.ts` (new)

This script runs as the utility process. It owns the model, context, and HTTP server.

```typescript
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

interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

// ── State ─────────────────────────────────────────────────────────────────────

let llama: LlamaInstance | null = null
let model: LlamaModelType | null = null
let context: LlamaContextType | null = null
let server: http.Server | null = null
let gpuLayers = -1

// ── IPC with main process ─────────────────────────────────────────────────────

process.parentPort.on('message', async ({ data: msg }) => {
  switch (msg.type) {
    case 'start':
      gpuLayers = msg.gpuLayers ?? -1
      await handleStart(msg.modelPath)
      break
    case 'stop':
      await handleStop()
      process.parentPort.postMessage({ type: 'stopped' })
      process.exit(0)
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
    ;(context as any)?.dispose?.()
    ;(model as any)?.dispose?.()
    ;(llama as any)?.dispose?.()
  } catch { /* ignore */ }
  context = null; model = null; llama = null
}

// ── HTTP Server ───────────────────────────────────────────────────────────────

async function startHttpServer(port: number): Promise<void> {
  server = http.createServer(async (req, res) => {
    try { await handleRequest(req, res) }
    catch (err) {
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
  const stream = url.includes('stream=true') // naive — replace with body parse

  if (url === '/health' || url === '/v1/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }

  if (req.method === 'GET' && (url === '/v1/models' || url === '/models')) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ object: 'list', data: [{ id: 'builtin', object: 'model' }] }))
    return
  }

  if (req.method === 'POST' && (url === '/v1/chat/completions' || url === '/chat/completions')) {
    const body = await readBody(req)
    const data = JSON.parse(body) as { messages: ChatMessage[]; stream?: boolean; max_tokens?: number }

    if (data.stream) {
      // SSE streaming — see Step 3
      await streamInference(data.messages, res)
    } else {
      const content = await runInference(data.messages)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        id: `builtin-${Date.now()}`, object: 'chat.completion', model: 'builtin',
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      }))
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
  const session = new LlamaChatSession({ contextSequence: context.getSequence() }) as LlamaChatSession
  session.setChatHistory(buildHistory(messages))
  const lastUser = messages.filter(m => m.role !== 'system').at(-1)
  if (!lastUser || lastUser.role !== 'user') throw new Error('Last message must be from user')
  return session.prompt(lastUser.content)
}

async function streamInference(messages: ChatMessage[], res: ServerResponse): Promise<void> {
  if (!model || !context) throw new Error('Model not loaded')
  const { LlamaChatSession } = await import('node-llama-cpp')
  const session = new LlamaChatSession({ contextSequence: context.getSequence() }) as LlamaChatSession
  session.setChatHistory(buildHistory(messages))
  const lastUser = messages.filter(m => m.role !== 'system').at(-1)
  if (!lastUser || lastUser.role !== 'user') throw new Error('Last message must be from user')

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })

  const id = `builtin-${Date.now()}`
  await session.prompt(lastUser.content, {
    onTextChunk(token) {
      const chunk = JSON.stringify({
        id, object: 'chat.completion.chunk', model: 'builtin',
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
  const systemText = messages.find(m => m.role === 'system')?.content
  if (systemText) history.push({ type: 'system', text: systemText })
  const turns = messages.filter(m => m.role !== 'system')
  for (let i = 0; i < turns.length - 1; i++) {
    const m = turns[i]
    if (m.role === 'user') history.push({ type: 'user', text: m.content })
    else history.push({ type: 'model', response: [m.content] } as ChatModelResponse)
  }
  return history
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => (data += chunk))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function findFreePort(start: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const try_ = (port: number) => {
      const s = http.createServer()
      s.listen(port, '127.0.0.1', () => s.close(() => resolve(port)))
      s.on('error', () => port < start + 20 ? try_(port + 1) : reject(new Error('No free port')))
    }
    try_(start)
  })
}
```

#### Step 3: Rewrite `LLMProcessManager` to Drive the Utility Process

**File**: `src/main/agent/LLMProcessManager.ts`

Replace the current in-process implementation with a lifecycle manager for the utility process.

```typescript
import { EventEmitter } from 'events'
import { utilityProcess, UtilityProcess } from 'electron'
import path from 'path'
import { app } from 'electron'

const MAX_RESTART_ATTEMPTS = 3
const RESTART_BACKOFF_MS = [1000, 3000, 10000] // exponential backoff

export class LLMProcessManager extends EventEmitter {
  private proc: UtilityProcess | null = null
  private serverUrl: string | null = null
  private gpuLayers = -1
  private pendingModelPath: string | null = null
  private restartAttempts = 0
  private startupTimer: NodeJS.Timeout | null = null

  /** Resolve path to llm-server.js — differs in dev vs packaged */
  private getServerScriptPath(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'llm-server.js')
    }
    return path.join(__dirname, 'llm-server.js') // out/main/llm-server.js in dev
  }

  async start(modelPath: string): Promise<boolean> {
    if (this.proc) return false
    this.pendingModelPath = modelPath
    this.restartAttempts = 0
    return this.spawnAndStart(modelPath)
  }

  private async spawnAndStart(modelPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const scriptPath = this.getServerScriptPath()

      this.proc = utilityProcess.fork(scriptPath, [], {
        serviceName: 'LLM Server',
        stdio: 'pipe', // capture stdout/stderr for logging
      })

      // Forward stdout/stderr to main process console
      this.proc.stdout?.on('data', d => console.log('[llm-server]', d.toString().trim()))
      this.proc.stderr?.on('data', d => console.error('[llm-server]', d.toString().trim()))

      // Startup timeout — if no 'ready' within 120s, treat as failure
      this.startupTimer = setTimeout(() => {
        console.error('[LLMProcessManager] Startup timeout')
        resolve(false)
      }, 120_000)

      this.proc.on('message', (msg: any) => {
        switch (msg.type) {
          case 'status':
            this.emit('status', msg.status)
            break
          case 'ready':
            clearTimeout(this.startupTimer!)
            this.serverUrl = msg.url
            this.restartAttempts = 0
            this.emit('status', 'ready')
            resolve(true)
            break
          case 'error':
            clearTimeout(this.startupTimer!)
            this.emit('error', msg.message)
            resolve(false)
            break
          case 'stopped':
            this.emit('status', 'stopped')
            break
          case 'pong':
            // heartbeat response — process is alive
            break
        }
      })

      this.proc.on('exit', (code) => {
        clearTimeout(this.startupTimer!)
        this.proc = null
        this.serverUrl = null
        if (code !== 0 && code !== null) {
          console.error(`[LLMProcessManager] Utility process exited with code ${code}`)
          this.emit('crashed', code)
          this.attemptRestart()
        }
      })

      // Kick off model loading inside the utility process
      this.proc.postMessage({ type: 'start', modelPath, gpuLayers: this.gpuLayers })
    })
  }

  private attemptRestart(): void {
    if (!this.pendingModelPath) return
    if (this.restartAttempts >= MAX_RESTART_ATTEMPTS) {
      console.error('[LLMProcessManager] Max restart attempts reached — giving up')
      this.emit('error', 'Max restart attempts reached')
      return
    }
    const delay = RESTART_BACKOFF_MS[this.restartAttempts] ?? 10_000
    this.restartAttempts++
    console.log(`[LLMProcessManager] Restarting in ${delay}ms (attempt ${this.restartAttempts})`)
    setTimeout(() => this.spawnAndStart(this.pendingModelPath!), delay)
  }

  stop(): void {
    clearTimeout(this.startupTimer!)
    if (this.proc) {
      this.proc.postMessage({ type: 'stop' })
      // Kill if it doesn't exit cleanly within 5s
      setTimeout(() => this.proc?.kill(), 5000)
    }
    this.proc = null
    this.serverUrl = null
    this.pendingModelPath = null
  }

  /** Send a heartbeat ping to verify the process is alive */
  ping(): void {
    this.proc?.postMessage({ type: 'ping' })
  }

  setGpuLayers(layers: number): void {
    this.gpuLayers = layers
  }

  isRunning(): boolean {
    return this.proc !== null && this.serverUrl !== null
  }

  getUrl(): string | null {
    return this.serverUrl
  }
}
```

#### Step 4: SSE Streaming in `LLMClient`

The utility process HTTP server already emits Server-Sent Events for streaming requests. Update `LLMClient` to consume them:

**File**: `src/main/agent/LLMClient.ts` — add `chatStream()`:

```typescript
async *chatStream(messages: LLMMessage[]): AsyncGenerator<string> {
  const url = `${this.config.baseUrl}/chat/completions`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: this.config.model, messages, stream: true }),
  })

  if (!response.ok || !response.body) throw new Error(`Stream failed: ${response.status}`)

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
      if (token) yield token
    }
  }
}
```

#### Step 5: Heartbeat Monitor

Add a periodic health check so the main process knows if the utility process has silently hung (vs. crashed):

**File**: `src/main/agent/LLMProcessManager.ts` — add to the `start` flow:

```typescript
private heartbeatInterval: NodeJS.Timeout | null = null
private lastPong = 0

private startHeartbeat(): void {
  this.lastPong = Date.now()
  this.heartbeatInterval = setInterval(() => {
    if (!this.proc) return
    const silentMs = Date.now() - this.lastPong
    if (silentMs > 30_000) {
      console.error('[LLMProcessManager] Heartbeat timeout — killing hung process')
      this.proc.kill()
      return
    }
    this.ping()
  }, 10_000) // ping every 10s
}

// In the 'pong' message handler:
case 'pong':
  this.lastPong = Date.now()
  break
```

Call `startHeartbeat()` when `ready` is received. Clear the interval in `stop()`.

### 2.3 Build & Packaging Checklist

- [ ] Add `llm-server` entry point to `electron.vite.config.ts`
- [ ] Add compiled `llm-server.js` to `electron-builder` `extraResources`
- [ ] Verify `node-llama-cpp` is in `externals` (not bundled by Vite — it ships native `.node` files)
- [ ] Test `getServerScriptPath()` resolves correctly in both dev and packaged builds
- [ ] Verify `utilityProcess` import is available (Electron 22+)

### 2.4 Testing Plan

- Simulate a crash in the utility process (`process.exit(1)`) — verify UI stays responsive and auto-restart fires
- Send 50 concurrent requests to the HTTP server — verify queuing doesn't deadlock
- Kill the utility process mid-inference — verify the in-flight request returns an error to the caller (not a hang)
- Package the app and verify the `llm-server.js` resource path resolves correctly
- Heartbeat: pause the event loop in the utility process with a `while(true){}` — verify the 30s timeout kills it

**Estimated Time**: 3-4 days

---

## Phase 3: MLX Backend for Apple Silicon 🟡 MEDIUM PRIORITY

### 3.1 Why MLX?
- **2-3x faster** than llama.cpp on Apple Silicon
- Native Apple framework, optimized for Metal
- Better memory efficiency on M1/M2/M3/M4
- Same approach as LM Studio: bundle Python 3.11 + mlx-lm inside the app — no user-facing Python dependency

### 3.2 Architecture

```
Platform Detection (darwin + arm64 only)
  ├── macOS + ARM64 → MLX Backend (recommended, bundled Python runtime)
  │     └── Utility Process: spawns bundled python3.11 -m mlx_lm.server
  ├── macOS + x86_64 → GGUF/llama.cpp (Phase 2 utility process)
  ├── Windows        → GGUF/llama.cpp (Phase 2 utility process)
  └── Linux          → GGUF/llama.cpp (Phase 2 utility process)
```

MLX runs as an **OpenAI-compatible HTTP server** (same interface as the Phase 2 llama.cpp utility process), so `LLMClient` and all upstream code stays unchanged. The only difference is which server script is launched.

### 3.3 Preset Models

All three are `gemma-3n` (text-only / `lm` variant — no audio processing, smaller and faster for a chat app):

| Tier | HF Repo | Effective Params | Approx. Size | Notes |
|------|---------|-----------------|--------------|-------|
| Fast | `mlx-community/gemma-3n-E2B-it-lm-4bit` | ~2B | ~1 GB | Entry-level Macs |
| Balanced | `mlx-community/gemma-3n-E4B-it-lm-4bit` | ~4B | ~2 GB | **Recommended default** |
| Quality | `mlx-community/gemma-3n-E4B-it-lm-bf16` | ~4B | ~8 GB | 16 GB+ RAM only |

A **Custom** option below the presets lets power users type any `mlx-community/<repo>` (or any public HF repo ID) to download and use an arbitrary MLX model.

### 3.4 UI Changes

Both `StepLLM` (setup wizard) and `SettingsView` (inference tab) gain a backend selector, shown **only on `darwin/arm64`**:

```
Backend
  ● MLX  [Recommended for Apple Silicon]     ← shown only on arm64 Mac
  ○ GGUF (llama.cpp)
  ○ External API …

── If MLX selected ────────────────────────────────
  ○ Fast     gemma-3n E2B lm 4bit  ~1 GB
  ● Balanced gemma-3n E4B lm 4bit  ~2 GB  ← default
  ○ Quality  gemma-3n E4B lm bf16  ~8 GB
  ─────────────────────────────────────────────────
  Custom model (advanced)
  [ mlx-community/_________________ ]  [Download]

── If GGUF selected ───────────────────────────────
  Existing Q3_K_M / Q4_K_M / Q5_K_M options (unchanged)
```

`LLMProfile` gains two new optional fields:
```typescript
builtinBackend?: 'gguf' | 'mlx'   // defaults to 'gguf' if absent (backwards compat)
builtinHfRepo?: string             // custom HF repo ID for MLX; undefined = use preset
```

### 3.5 Bundling the Python Runtime (LM Studio approach)

LM Studio ships `lmstudio-ai/mlx-engine` (100% Python) pre-bundled with Python 3.11 inside the Electron app so users need nothing installed.

#### Step 1: Embed a minimal Python 3.11 distribution

Use `python-build-standalone` (Gregory Szorc's relocatable CPython builds) — the same technique LM Studio uses. Download the `arm64-apple-darwin` build and include it as an `extraResource` for Mac arm64 only.

**`electron-builder.yml`** (arm64 Mac target only):
```yaml
mac:
  extraResources:
    - from: resources/python-runtime/
      to: python-runtime/
      filter:
        - "**/*"
```

The runtime directory structure:
```
resources/python-runtime/
  bin/
    python3.11          ← the embedded interpreter
  lib/
    python3.11/
      site-packages/
        mlx/            ← mlx framework
        mlx_lm/         ← mlx-lm (text generation + server)
        ...
```

Build script (`scripts/build-python-runtime.sh`) runs on CI (arm64 Mac runner only):
1. Downloads `python-build-standalone` CPython 3.11 for `aarch64-apple-darwin`
2. Runs `bin/pip install mlx-lm` into the embedded env
3. Strips `.pyc` cache and test files to keep size down
4. Output lands in `resources/python-runtime/`

Approximate added size: **~120–180 MB** (arm64 Mac `.dmg` only; Windows/Linux unaffected).

#### Step 2: Create the MLX utility process entry point

**File**: `src/main/agent/mlx-launcher.ts` (new)

This is a **thin Node.js utility process** (not Python). Its only job is to resolve the bundled Python path and `exec` the mlx_lm server:

```typescript
/**
 * MLX Launcher — Electron utility process.
 * Resolves the bundled Python 3.11 runtime and spawns mlx_lm.server.
 * Communicates with main process via process.parentPort.
 */
import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import { app } from 'electron'

let mlxProc: ChildProcess | null = null

process.parentPort.on('message', async ({ data: msg }) => {
  switch (msg.type) {
    case 'start':
      await startMLX(msg.hfRepo, msg.port)
      break
    case 'stop':
      mlxProc?.kill()
      process.parentPort.postMessage({ type: 'stopped' })
      process.exit(0)
      break
  }
})

function getPythonPath(): string {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'python-runtime')
    : path.join(__dirname, '../../resources/python-runtime')
  return path.join(base, 'bin', 'python3.11')
}

async function startMLX(hfRepo: string, port: number): Promise<void> {
  const python = getPythonPath()
  process.parentPort.postMessage({ type: 'status', status: 'loading' })

  mlxProc = spawn(python, ['-m', 'mlx_lm.server', '--model', hfRepo, '--port', String(port)], {
    env: { ...process.env, PYTHONPATH: path.dirname(path.dirname(python)) + '/lib/python3.11/site-packages' },
  })

  mlxProc.stdout?.on('data', (d: Buffer) => {
    if (d.toString().includes('Running on')) {
      process.parentPort.postMessage({ type: 'ready', url: `http://127.0.0.1:${port}/v1` })
    }
  })

  mlxProc.on('exit', (code) => {
    if (code !== 0) process.parentPort.postMessage({ type: 'error', message: `mlx_lm exited with code ${code}` })
  })
}
```

Add this as a second entry point in `electron.vite.config.ts` alongside `llm-server`:
```typescript
input: {
  index:        resolve(__dirname, 'src/main/index.ts'),
  'llm-server': resolve(__dirname, 'src/main/agent/llm-server.ts'),
  'mlx-launcher': resolve(__dirname, 'src/main/agent/mlx-launcher.ts'), // new
},
```

And in `electron-builder.yml`:
```yaml
extraResources:
  - from: out/main/llm-server.js
    to: llm-server.js
  - from: out/main/mlx-launcher.js   # new
    to: mlx-launcher.js
```

#### Step 3: Extend `LLMProcessManager` to dispatch on backend

`LLMProcessManager.start()` checks `profile.builtinBackend`:
- `'gguf'` (or absent) → spawn `llm-server.js` utility process (Phase 2, unchanged)
- `'mlx'` → spawn `mlx-launcher.js` utility process, pass `hfRepo` and `port`

Both utility processes post `{ type: 'ready', url }` on success, so the rest of the manager (URL routing to `LLMClient`, restart logic, etc.) is identical.

#### Step 4: HF model download for MLX

MLX models are entire HF repos (multiple `.safetensors` + `config.json` + tokenizer files), not a single `.gguf`. `mlx_lm.server` can accept a HF repo ID directly and will auto-download via the HF Hub cache — so **no custom download logic is needed for preset models**.

For the UI download button (to pre-cache before first use), call:
```python
# mlx_lm handles this natively
python3.11 -c "from mlx_lm import load; load('<hf-repo>')"
```

Expose via a new IPC channel `downloadMLXModel(hfRepo: string)` → streams progress from stdout.

### 3.6 CI / Build Notes

- The Python runtime build script (`scripts/build-python-runtime.sh`) must run on a **macOS arm64 GitHub Actions runner** and commit/cache its output
- The `resources/python-runtime/` directory is `.gitignore`d — it is built as part of `npm run dist` on Mac
- Windows and Linux builds are unaffected: `electron-builder` only includes `python-runtime/` for the `mac` target

**Estimated Size Impact**: +~150 MB to Mac arm64 `.dmg` only  
**Estimated Performance**: 40–60 tokens/sec on M2 Pro (vs ~15–20 with llama.cpp)  
**Testing**: Benchmark GGUF vs MLX on M1/M2/M3/M4 for same model family

---

## Phase 4: Context Pooling for Concurrency 🟡 MEDIUM PRIORITY

### 4.1 Problem
Current implementation uses a single context. Multiple concurrent requests will queue, causing delays.

### 4.2 Solution: Context Pool
```
Request 1 → Context A (in use)
Request 2 → Context B (in use)
Request 3 → Context C (in use)
Request 4 → Wait for available context
```

### 4.3 Implementation

#### Step 1: Create Context Pool
**File**: `src/main/agent/ContextPool.ts` (new)

```typescript
import type { LlamaContext, LlamaModel } from 'node-llama-cpp'

interface PooledContext {
  context: LlamaContext
  inUse: boolean
  lastUsed: number
}

export class ContextPool {
  private pool: PooledContext[] = []
  private model: LlamaModel
  private maxSize: number
  private contextSize: number
  
  constructor(model: LlamaModel, maxSize = 3, contextSize = 4096) {
    this.model = model
    this.maxSize = maxSize
    this.contextSize = contextSize
  }
  
  async acquire(): Promise<LlamaContext> {
    // Find available context
    let pooled = this.pool.find(p => !p.inUse)
    
    if (!pooled && this.pool.length < this.maxSize) {
      // Create new context
      const context = await this.model.createContext({
        contextSize: this.contextSize,
        batchSize: 512
      })
      pooled = { context, inUse: true, lastUsed: Date.now() }
      this.pool.push(pooled)
    }
    
    if (!pooled) {
      // Wait for available context
      await this.waitForAvailable()
      return this.acquire()
    }
    
    pooled.inUse = true
    pooled.lastUsed = Date.now()
    return pooled.context
  }
  
  release(context: LlamaContext): void {
    const pooled = this.pool.find(p => p.context === context)
    if (pooled) {
      pooled.inUse = false
    }
  }
  
  async dispose(): Promise<void> {
    for (const pooled of this.pool) {
      await (pooled.context as any).dispose?.()
    }
    this.pool = []
  }
  
  private waitForAvailable(): Promise<void> {
    return new Promise(resolve => {
      const check = setInterval(() => {
        if (this.pool.some(p => !p.inUse)) {
          clearInterval(check)
          resolve()
        }
      }, 100)
    })
  }
}
```

#### Step 2: Update LLMProcessManager
**File**: `src/main/agent/LLMProcessManager.ts`

```typescript
import { ContextPool } from './ContextPool.js'

export class LLMProcessManager extends EventEmitter {
  private contextPool: ContextPool | null = null
  
  async start(modelPath: string): Promise<boolean> {
    // ... load model ...
    
    // Create context pool instead of single context
    this.contextPool = new ContextPool(this.model, 3, 4096)
    
    // ... start server ...
  }
  
  private async runInference(messages: ChatMessage[]): Promise<string> {
    // Acquire context from pool
    const context = await this.contextPool!.acquire()
    
    try {
      const sequence = context.getSequence()
      const session = new LlamaChatSession({ contextSequence: sequence })
      
      // ... inference logic ...
      
      return await session.prompt(lastUser.content)
    } finally {
      // Release back to pool
      this.contextPool!.release(context)
    }
  }
  
  stop(): void {
    this.contextPool?.dispose()
    // ... rest of cleanup ...
  }
}
```

**Estimated Time**: 2-3 days  
**Testing**: Concurrent request load testing (10+ simultaneous requests)

---

## Phase 5: Speculative Decoding 🟢 LOW PRIORITY (Performance)

### 5.1 Concept
```
User Request → Draft Model (fast, small)
              ↓
         Generates 3-5 tokens
              ↓
         Main Model (slow, large)
              ↓
         Validates tokens (parallel)
              ↓
         1.5-3x faster output
```

### 5.2 Implementation

#### Step 1: Add Draft Model Support
**File**: `src/main/agent/LLMModelManager.ts`

```typescript
export const DRAFT_MODELS: GGUFModelInfo[] = [
  {
    quant: 'Q4_K_M',
    label: 'Draft Model',
    description: 'Small model for speculative decoding',
    sizeMb: 500,
    filename: 'gemma-2b-it-Q4_K_M.gguf', // Smaller 2B model
  }
]
```

#### Step 2: Load Draft Model
**File**: `src/main/agent/LLMProcessManager.ts`

```typescript
export class LLMProcessManager extends EventEmitter {
  private model: LlamaModelType | null = null
  private draftModel: LlamaModelType | null = null
  
  async start(modelPath: string, draftModelPath?: string): Promise<boolean> {
    // Load main model
    this.model = await this.llama.loadModel({ 
      modelPath,
      gpuLayers: this.gpuLayers
    })
    
    // Load draft model if provided
    if (draftModelPath) {
      this.draftModel = await this.llama.loadModel({
        modelPath: draftModelPath,
        gpuLayers: -1 // Keep draft model fully on GPU
      })
    }
    
    // ... rest of setup ...
  }
}
```

#### Step 3: Implement Speculative Decoding
```typescript
private async runInferenceWithSpeculation(
  messages: ChatMessage[]
): Promise<string> {
  if (!this.draftModel) {
    return this.runInference(messages) // Fallback to normal
  }
  
  // Draft model generates candidate tokens
  const draftSequence = this.draftModel.createContext()
  const candidates = await this.generateDraftTokens(draftSequence, messages, 5)
  
  // Main model validates in parallel
  const validated = await this.validateTokens(candidates, messages)
  
  return validated
}
```

**Estimated Time**: 4-5 days  
**Testing**: Benchmark with/without speculative decoding

---

## Phase 6: Advanced Features 🟢 LOW PRIORITY

### 6.1 Flash Attention (NVIDIA GPUs)
- **Requires**: Custom llama.cpp build with Flash Attention
- **Impact**: 15% throughput boost on NVIDIA
- **Implementation**: Build flag in electron-builder

### 6.2 CUDA Graphs (NVIDIA GPUs)
- **Requires**: llama.cpp with CUDA graph support
- **Impact**: 35% overhead reduction
- **Implementation**: Runtime flag

### 6.3 Memory Pressure Monitoring
**File**: `src/main/agent/MemoryMonitor.ts` (new)

```typescript
export class MemoryMonitor extends EventEmitter {
  private interval: NodeJS.Timeout | null = null
  
  start(): void {
    this.interval = setInterval(() => {
      const usage = process.memoryUsage()
      const heapPercent = (usage.heapUsed / usage.heapTotal) * 100
      
      if (heapPercent > 85) {
        this.emit('pressure-high', usage)
      } else if (heapPercent > 70) {
        this.emit('pressure-medium', usage)
      }
    }, 10000) // Check every 10s
  }
  
  stop(): void {
    if (this.interval) clearInterval(this.interval)
  }
}
```

### 6.4 Model Warmup
```typescript
async warmup(): Promise<void> {
  // Run dummy inference to initialize GPU kernels
  await this.runInference([
    { role: 'user', content: 'Hello' }
  ])
}
```

---

## Implementation Timeline

### Sprint 1 (Week 1-2): Process Isolation
- [ ] Add `llm-server` entry point to electron-vite build
- [ ] Create `src/main/agent/llm-server.ts` utility process script
- [ ] Rewrite `LLMProcessManager` to use `utilityProcess.fork()`
- [ ] Add exponential backoff crash recovery
- [ ] Add heartbeat monitor (10s ping / 30s timeout)
- [ ] Add SSE streaming to `LLMClient.chatStream()`
- [ ] Verify dev + packaged resource path resolution
- [ ] Simulate crashes and concurrent load

### Sprint 2 (Week 3-4): MLX Backend
- [ ] Platform detection logic
- [ ] Python MLX server
- [ ] Backend selector
- [ ] Benchmark vs llama.cpp

### Sprint 3 (Week 5-6): Context Pooling
- [ ] Implement ContextPool class
- [ ] Update LLMProcessManager
- [ ] Concurrent request testing
- [ ] Performance tuning

### Sprint 4 (Week 7-8): Speculative Decoding
- [ ] Add draft model support
- [ ] Implement speculation logic
- [ ] Benchmark speedup
- [ ] UI for enabling/disabling

### Sprint 5 (Week 9-10): Polish & Optimization
- [ ] Memory monitoring
- [ ] Model warmup
- [ ] Advanced GPU features
- [ ] Documentation

---

## Success Metrics

### Performance Targets
- **Stability**: 0 crashes in 1000 consecutive requests
- **Speed (llama.cpp)**: 20-30 tokens/sec on M2 Pro
- **Speed (MLX)**: 40-60 tokens/sec on M2 Pro
- **Memory**: Stable usage, no leaks
- **Concurrency**: Handle 5+ simultaneous requests

### User Experience
- **UI Responsiveness**: Never freeze on inference crash
- **Startup Time**: < 10 seconds to load model
- **Error Recovery**: Auto-restart on crash within 5 seconds

---

## Testing Strategy

### Unit Tests
```typescript
// test/LLMProcessManager.test.ts
describe('LLMProcessManager', () => {
  it('should survive 100 rapid requests', async () => {
    const manager = new LLMProcessManager()
    await manager.start(modelPath)
    
    const requests = Array(100).fill(null).map(() => 
      manager.runInference([{ role: 'user', content: 'test' }])
    )
    
    await Promise.all(requests)
    expect(manager.isRunning()).toBe(true)
  })
})
```

### Integration Tests
- Load testing with concurrent requests
- Crash recovery simulation
- Memory leak detection (run for 1 hour)
- Platform-specific testing (Mac/Windows/Linux)

### Benchmarking
```bash
# Benchmark script
npm run benchmark:llm -- \
  --model gemma-4-e4b-q4 \
  --requests 100 \
  --concurrent 5 \
  --backend llama.cpp

npm run benchmark:llm -- \
  --model gemma-4-e4b-q4 \
  --requests 100 \
  --concurrent 5 \
  --backend mlx
```

---

## Dependencies

### New Dependencies
```json
{
  "dependencies": {
    "node-llama-cpp": "^3.18.1"  // Already installed
  },
  "optionalDependencies": {
    "@mlx-community/mlx-node": "^0.1.0"  // For MLX backend
  },
  "devDependencies": {
    "@types/node": "^22.14.0"  // Already installed
  }
}
```

### System Requirements
- **macOS MLX**: Python 3.9+, pip, mlx-lm
- **NVIDIA CUDA**: CUDA Toolkit 11.8+
- **AMD ROCm**: ROCm 5.4+

---

## Rollout Strategy

### Phase 1: Beta Testing (Internal)
- Deploy to 5-10 internal users
- Monitor crash reports
- Collect performance metrics

### Phase 2: Opt-in Beta (Public)
- Add "Experimental Features" toggle in settings
- Users can enable new backend
- Fallback to stable version on error

### Phase 3: Gradual Rollout
- 10% of users → MLX backend (Mac only)
- 25% of users → Process isolation
- 50% of users → Context pooling
- 100% of users → Full rollout

### Phase 4: Stable Release
- Mark as stable in release notes
- Remove experimental flags
- Update documentation

---

## Risk Mitigation

### Risk 1: MLX Compatibility Issues
- **Mitigation**: Keep llama.cpp as fallback
- **Detection**: Platform check before enabling MLX
- **Recovery**: Auto-switch to llama.cpp on MLX failure

### Risk 2: Utility Process Script Path in Packaged Build
- **Mitigation**: `getServerScriptPath()` checks `app.isPackaged` and uses `process.resourcesPath`
- **Detection**: Smoke test packaged `.dmg`/`.exe` before release
- **Recovery**: Fallback log tells user exactly which path was resolved

### Risk 3: Context Pool Deadlocks
- **Mitigation**: Timeout on acquire (30s max)
- **Detection**: Monitor wait times
- **Recovery**: Force-release stuck contexts

---

## Documentation Updates

### User-Facing Docs
- [ ] Update FAQ with MLX vs llama.cpp comparison
- [ ] Add troubleshooting guide for crashes
- [ ] Document GPU layer configuration
- [ ] Create performance tuning guide

### Developer Docs
- [ ] Architecture diagram (process isolation)
- [ ] Backend selection flowchart
- [ ] Context pool lifecycle
- [ ] Contributing guide for new backends

---

## Monitoring & Observability

### Metrics to Track
```typescript
interface LLMMetrics {
  requestsPerMinute: number
  averageLatency: number
  p95Latency: number
  p99Latency: number
  crashCount: number
  memoryUsageMB: number
  gpuUtilization: number
  activeContexts: number
}
```

### Logging
```typescript
// Structured logging
log.info('[LLM]', {
  event: 'inference_complete',
  duration_ms: 1234,
  tokens: 50,
  backend: 'mlx',
  gpu_layers: 20
})
```

---

## Conclusion

This plan transforms ThinkPod's LLM from a crash-prone prototype into a production-grade inference engine matching LM Studio's architecture. The phased approach allows incremental delivery while maintaining stability.

**Next Steps**:
1. Review and approve this plan
2. Begin Sprint 1 (Process Isolation)
3. Set up testing infrastructure
4. Create tracking issues for each phase
