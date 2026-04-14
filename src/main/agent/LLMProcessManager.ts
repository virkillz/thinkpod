/**
 * LLM Process Manager
 * Spawns node-llama-cpp (GGUF) or mlx_lm.server (MLX) in an isolated Electron
 * utility process to prevent UI freezes during inference and survive crashes
 * without taking down the app.
 *
 * Both backends post `{ type: 'ready', url }` on startup, so LLMClient and all
 * upstream code stay unchanged — only the launched script differs.
 *
 * Main ↔ utility communication goes through utilityProcess.postMessage() and
 * process.parentPort (Electron IPC), keeping inference fully off the main event loop.
 */

import { EventEmitter } from 'events'
import { utilityProcess, app } from 'electron'
import type { UtilityProcess } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const MAX_RESTART_ATTEMPTS = 3
const RESTART_BACKOFF_MS = [1000, 3000, 10_000]

// ── Start options ─────────────────────────────────────────────────────────────

export type LLMStartOpts =
  | { backend?: 'gguf'; modelPath: string }
  | { backend: 'mlx'; hfRepo: string; port?: number }

// ── Manager ───────────────────────────────────────────────────────────────────

export class LLMProcessManager extends EventEmitter {
  private proc: UtilityProcess | null = null
  private serverUrl: string | null = null
  private gpuLayers = -1
  private pendingOpts: LLMStartOpts | null = null
  private restartAttempts = 0
  private startupTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private lastPong = 0

  constructor() {
    super()
  }

  // ── Script path resolution ────────────────────────────────────────────────

  /** Resolve path to the compiled llm-server script — differs in dev vs packaged. */
  private getServerScriptPath(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'llm-server.js')
    }
    return path.join(__dirname, 'llm-server.js')
  }

  /** Resolve path to the compiled mlx-launcher script — differs in dev vs packaged. */
  private getMLXLauncherScriptPath(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'mlx-launcher.js')
    }
    return path.join(__dirname, 'mlx-launcher.js')
  }

  /** Resolve the bundled Python 3.11 runtime directory. */
  private getPythonRuntimePath(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'python-runtime')
    }
    // Dev: resources/python-runtime relative to the project root
    return path.join(app.getAppPath(), 'resources', 'python-runtime')
  }

  // ── Public API ────────────────────────────────────────────────────────────

  async start(opts: LLMStartOpts): Promise<boolean> {
    if (this.proc) return false
    this.pendingOpts = opts
    this.restartAttempts = 0
    return this.spawnAndStart(opts)
  }

  stop(): void {
    clearTimeout(this.startupTimer!)
    this.stopHeartbeat()
    if (this.proc) {
      this.proc.postMessage({ type: 'stop' })
      // Kill if it doesn't exit cleanly within 5s
      setTimeout(() => this.proc?.kill(), 5000)
    }
    this.proc = null
    this.serverUrl = null
    this.pendingOpts = null
  }

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

  // ── Internal ──────────────────────────────────────────────────────────────

  private spawnAndStart(opts: LLMStartOpts): Promise<boolean> {
    return new Promise((resolve) => {
      const isMLX = opts.backend === 'mlx'
      const scriptPath = isMLX ? this.getMLXLauncherScriptPath() : this.getServerScriptPath()

      this.proc = utilityProcess.fork(scriptPath, [], {
        serviceName: isMLX ? 'MLX Server' : 'LLM Server',
        stdio: 'pipe',
      })

      this.proc.stdout?.on('data', (d: Buffer) =>
        console.log(isMLX ? '[mlx-launcher]' : '[llm-server]', d.toString().trim())
      )
      this.proc.stderr?.on('data', (d: Buffer) =>
        console.error(isMLX ? '[mlx-launcher]' : '[llm-server]', d.toString().trim())
      )

      // 120s startup timeout (MLX may need to download model on first run)
      this.startupTimer = setTimeout(() => {
        console.error('[LLMProcessManager] Startup timeout')
        resolve(false)
      }, 120_000)

      this.proc.on('message', (msg: unknown) => {
        const message = msg as { type: string; status?: string; url?: string; message?: string }
        switch (message.type) {
          case 'status':
            this.emit('status', message.status)
            break
          case 'ready':
            clearTimeout(this.startupTimer!)
            this.serverUrl = message.url!
            this.restartAttempts = 0
            this.startHeartbeat()
            this.emit('status', 'ready')
            resolve(true)
            break
          case 'error':
            clearTimeout(this.startupTimer!)
            this.emit('error', message.message)
            resolve(false)
            break
          case 'stopped':
            this.emit('status', 'stopped')
            break
          case 'pong':
            this.lastPong = Date.now()
            break
        }
      })

      this.proc.on('exit', (code: number | null) => {
        clearTimeout(this.startupTimer!)
        this.stopHeartbeat()
        this.proc = null
        this.serverUrl = null
        if (code !== 0 && code !== null) {
          console.error(`[LLMProcessManager] Utility process exited with code ${code}`)
          this.emit('crashed', code)
          this.attemptRestart()
        }
      })

      // Send the start message — payload differs by backend
      if (isMLX) {
        this.proc.postMessage({
          type: 'start',
          hfRepo: opts.hfRepo,
          port: opts.port ?? 8765,
          pythonRuntimePath: this.getPythonRuntimePath(),
        })
      } else {
        this.proc.postMessage({ type: 'start', modelPath: opts.modelPath, gpuLayers: this.gpuLayers })
      }
    })
  }

  private attemptRestart(): void {
    if (!this.pendingOpts) return
    if (this.restartAttempts >= MAX_RESTART_ATTEMPTS) {
      console.error('[LLMProcessManager] Max restart attempts reached — giving up')
      this.emit('error', 'Max restart attempts reached')
      return
    }
    const delay = RESTART_BACKOFF_MS[this.restartAttempts] ?? 10_000
    this.restartAttempts++
    console.log(
      `[LLMProcessManager] Restarting in ${delay}ms (attempt ${this.restartAttempts})`
    )
    setTimeout(() => this.spawnAndStart(this.pendingOpts!), delay)
  }

  // ── Heartbeat ────────────────────────────────────────────────────────────────

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
    }, 10_000)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }
}
