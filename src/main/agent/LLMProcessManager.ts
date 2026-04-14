/**
 * LLM Process Manager
 * Spawns node-llama-cpp in an isolated Electron utility process to prevent
 * UI freezes during inference and survive crashes without taking down the app.
 *
 * The utility process (llm-server.ts) loads the model and runs a local
 * OpenAI-compatible HTTP server. The existing LLMClient connects to the URL
 * returned by getUrl() — no other code needs to change.
 *
 * Main ↔ utility communication goes through utilityProcess.postMessage()
 * and process.parentPort (Electron IPC), keeping inference fully off the
 * main process event loop.
 */

import { EventEmitter } from 'events'
import { utilityProcess, app } from 'electron'
import type { UtilityProcess } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const MAX_RESTART_ATTEMPTS = 3
const RESTART_BACKOFF_MS = [1000, 3000, 10_000]

export class LLMProcessManager extends EventEmitter {
  private proc: UtilityProcess | null = null
  private serverUrl: string | null = null
  private gpuLayers = -1
  private pendingModelPath: string | null = null
  private restartAttempts = 0
  private startupTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private lastPong = 0

  constructor() {
    super()
  }

  /** Resolve path to the compiled llm-server script — differs in dev vs packaged. */
  private getServerScriptPath(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'llm-server.js')
    }
    // In dev, tsc outputs src/main/agent/llm-server.ts → dist/main/agent/llm-server.js
    return path.join(__dirname, 'llm-server.js')
  }

  async start(modelPath: string): Promise<boolean> {
    if (this.proc) return false
    this.pendingModelPath = modelPath
    this.restartAttempts = 0
    return this.spawnAndStart(modelPath)
  }

  private spawnAndStart(modelPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const scriptPath = this.getServerScriptPath()

      this.proc = utilityProcess.fork(scriptPath, [], {
        serviceName: 'LLM Server',
        stdio: 'pipe',
      })

      this.proc.stdout?.on('data', (d: Buffer) =>
        console.log('[llm-server]', d.toString().trim())
      )
      this.proc.stderr?.on('data', (d: Buffer) =>
        console.error('[llm-server]', d.toString().trim())
      )

      // 120s startup timeout
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
    console.log(
      `[LLMProcessManager] Restarting in ${delay}ms (attempt ${this.restartAttempts})`
    )
    setTimeout(() => this.spawnAndStart(this.pendingModelPath!), delay)
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
    this.pendingModelPath = null
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
