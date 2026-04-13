/**
 * LLM Model Manager
 * Manages GGUF model files for the built-in Gemma 4B inference engine.
 * Follows the same pattern as WhisperManager.
 */

import path from 'path'
import fs from 'fs/promises'
import { createWriteStream } from 'fs'
import https from 'https'
import http from 'http'
import { app } from 'electron'
import type { DatabaseManager } from '../database/DatabaseManager.js'

export interface LLMBuiltinConfig {
  quant: string // e.g. 'Q4_K_M'
}

export interface GGUFModelInfo {
  quant: string
  label: string
  description: string
  sizeMb: number
  filename: string
}

const HF_REPO = 'unsloth/gemma-4-E4B-it-GGUF'
const HF_BASE_URL = `https://huggingface.co/${HF_REPO}/resolve/main`

export const GEMMA_MODELS: GGUFModelInfo[] = [
  {
    quant: 'Q3_K_M',
    label: 'Light',
    description: 'Smaller and faster — good for 8 GB RAM',
    sizeMb: 1400,
    filename: 'gemma-4-E4B-it-Q3_K_M.gguf',
  },
  {
    quant: 'Q4_K_M',
    label: 'Balanced',
    description: 'Best quality-to-size trade-off — recommended',
    sizeMb: 1800,
    filename: 'gemma-4-E4B-it-Q4_K_M.gguf',
  },
  {
    quant: 'Q5_K_M',
    label: 'Quality',
    description: 'Higher quality output — 16 GB RAM or more',
    sizeMb: 2100,
    filename: 'gemma-4-E4B-it-Q5_K_M.gguf',
  },
]

export class LLMModelManager {
  private modelsDir: string
  private dbManager: DatabaseManager
  private abortController: AbortController | null = null

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager
    this.modelsDir = path.join(app.getPath('userData'), 'models', 'llm')
  }

  async ensureModelsDir(): Promise<void> {
    await fs.mkdir(this.modelsDir, { recursive: true })
  }

  getModelPath(quant: string): string {
    const info = GEMMA_MODELS.find((m) => m.quant === quant)
    if (!info) throw new Error(`Unknown quant: ${quant}`)
    return path.join(this.modelsDir, info.filename)
  }

  async getConfig(): Promise<LLMBuiltinConfig | null> {
    const raw = this.dbManager.getSetting('llmBuiltinConfig')
    if (!raw) return null
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : (raw as LLMBuiltinConfig)
    } catch {
      return null
    }
  }

  async setConfig(config: LLMBuiltinConfig | null): Promise<void> {
    this.dbManager.setSetting('llmBuiltinConfig', config ? JSON.stringify(config) : null)
  }

  async isModelDownloaded(quant: string): Promise<boolean> {
    try {
      await fs.access(this.getModelPath(quant))
      return true
    } catch {
      return false
    }
  }

  async listDownloadedModels(): Promise<string[]> {
    await this.ensureModelsDir()
    const files = await fs.readdir(this.modelsDir).catch(() => [] as string[])
    return GEMMA_MODELS.filter((m) => files.includes(m.filename)).map((m) => m.quant)
  }

  async downloadModel(quant: string, onProgress: (progress: number) => void): Promise<void> {
    const info = GEMMA_MODELS.find((m) => m.quant === quant)
    if (!info) throw new Error(`Unknown quant: ${quant}`)

    await this.ensureModelsDir()
    const url = `${HF_BASE_URL}/${info.filename}`
    const destPath = this.getModelPath(quant)
    const tempPath = `${destPath}.tmp`

    this.abortController = new AbortController()
    const { signal } = this.abortController

    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(new Error('Download cancelled'))

      const cleanup = () => {
        fs.unlink(tempPath).catch(() => {})
      }

      signal.addEventListener('abort', () => {
        cleanup()
        reject(new Error('Download cancelled'))
      })

      const doRequest = (reqUrl: string) => {
        const protocol = reqUrl.startsWith('https') ? https : http

        protocol.get(reqUrl, (res) => {
          if (signal.aborted) {
            res.destroy()
            return
          }

          if (
            res.statusCode === 301 ||
            res.statusCode === 302 ||
            res.statusCode === 307 ||
            res.statusCode === 308
          ) {
            const location = res.headers.location
            if (location) {
              doRequest(location)
              return
            }
            reject(new Error('Redirect with no location'))
            return
          }

          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} downloading model`))
            return
          }

          const totalBytes = parseInt(res.headers['content-length'] || '0', 10)
          let receivedBytes = 0

          const writeStream = createWriteStream(tempPath)

          res.on('data', (chunk: Buffer) => {
            if (signal.aborted) {
              res.destroy()
              writeStream.destroy()
              return
            }
            receivedBytes += chunk.length
            if (totalBytes > 0) {
              onProgress(Math.round((receivedBytes / totalBytes) * 100))
            }
          })

          res.pipe(writeStream)

          writeStream.on('finish', async () => {
            if (signal.aborted) {
              cleanup()
              return
            }
            try {
              await fs.rename(tempPath, destPath)
              onProgress(100)
              resolve()
            } catch (err) {
              cleanup()
              reject(err)
            }
          })

          writeStream.on('error', (err) => {
            cleanup()
            reject(err)
          })

          res.on('error', (err) => {
            cleanup()
            reject(err)
          })
        }).on('error', (err) => {
          cleanup()
          reject(err)
        })
      }

      doRequest(url)
    })

    this.abortController = null
  }

  cancelDownload(): void {
    this.abortController?.abort()
    this.abortController = null
  }

  async deleteModel(quant: string): Promise<void> {
    const modelPath = this.getModelPath(quant)
    await fs.unlink(modelPath)

    const config = await this.getConfig()
    if (config?.quant === quant) {
      await this.setConfig(null)
    }
  }

  getModelInfo(quant: string): GGUFModelInfo | undefined {
    return GEMMA_MODELS.find((m) => m.quant === quant)
  }
}
