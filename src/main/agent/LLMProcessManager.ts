/**
 * LLM Process Manager
 * Manages the mlx_lm.server process (or any other local LLM server)
 */

import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'

export interface LLMProcessConfig {
  model: string
  port?: number
  quantization?: string
}

export class LLMProcessManager extends EventEmitter {
  private process: ChildProcess | null = null
  private config: LLMProcessConfig
  private isStarting = false

  constructor(config: LLMProcessConfig) {
    super()
    this.config = {
      port: 8765,
      ...config,
    }
  }

  /**
   * Start the LLM server process
   */
  async start(): Promise<boolean> {
    if (this.process || this.isStarting) {
      return false
    }

    this.isStarting = true
    this.emit('status', 'starting')

    try {
      // Check if mlx_lm is available
      const hasMlxLm = await this.checkCommand('python3 -m mlx_lm.server --help')
      
      if (!hasMlxLm) {
        this.emit('error', 'mlx_lm not found. Install with: pip install mlx-lm')
        this.isStarting = false
        return false
      }

      // Start the server
      const args = [
        '-m', 'mlx_lm.server',
        '--model', this.config.model,
        '--port', this.config.port!.toString(),
      ]

      if (this.config.quantization) {
        args.push('--quantize', this.config.quantization)
      }

      this.process = spawn('python3', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      })

      // Handle stdout
      this.process.stdout?.on('data', (data) => {
        const output = data.toString()
        this.emit('log', { level: 'info', message: output })
        
        // Check for Uvicorn startup message
        if (output.includes('Uvicorn running') || output.includes('Application startup complete')) {
          this.emit('status', 'ready')
        }
      })

      // Handle stderr
      this.process.stderr?.on('data', (data) => {
        this.emit('log', { level: 'error', message: data.toString() })
      })

      // Handle process exit
      this.process.on('exit', (code) => {
        this.process = null
        this.isStarting = false
        this.emit('status', 'stopped')
        
        if (code !== 0 && code !== null) {
          this.emit('error', `LLM process exited with code ${code}`)
        }
      })

      // Wait for server to be ready
      const ready = await this.waitForServer(this.config.port!, 30000)
      
      if (ready) {
        this.emit('status', 'ready')
        this.isStarting = false
        return true
      } else {
        this.stop()
        this.emit('error', 'Server failed to start within timeout')
        this.isStarting = false
        return false
      }

    } catch (error) {
      this.emit('error', (error as Error).message)
      this.isStarting = false
      return false
    }
  }

  /**
   * Stop the LLM server
   */
  stop(): void {
    if (this.process) {
      this.process.kill('SIGTERM')
      
      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL')
        }
      }, 5000)
      
      this.process = null
    }
    this.emit('status', 'stopped')
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.process !== null && !this.process.killed
  }

  /**
   * Get the server URL
   */
  getUrl(): string {
    return `http://localhost:${this.config.port}`
  }

  private async checkCommand(cmd: string): Promise<boolean> {
    return new Promise((resolve) => {
      const parts = cmd.split(' ')
      const proc = spawn(parts[0], parts.slice(1), { stdio: 'ignore' })
      
      proc.on('exit', (code) => {
        resolve(code === 0)
      })
      
      proc.on('error', () => {
        resolve(false)
      })
    })
  }

  private async waitForServer(port: number, timeout: number): Promise<boolean> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(`http://localhost:${port}/health`, {
          method: 'GET',
        })
        
        if (response.ok) {
          return true
        }
      } catch {
        // Server not ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    return false
  }
}
