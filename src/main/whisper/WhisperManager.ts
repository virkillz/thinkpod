import path from 'path'
import fs from 'fs/promises'
import { createWriteStream } from 'fs'
import https from 'https'
import http from 'http'
import { app } from 'electron'
import type { DatabaseManager } from '../database/DatabaseManager.js'

export interface VoiceConfig {
  modelName: string       // e.g. 'small.en', 'large-v3-turbo'
  language: 'en' | 'auto' // 'en' = english-only hint, 'auto' = let whisper detect
}

export interface ModelInfo {
  name: string
  label: string
  description: string
  sizeMb: number
  tier: 'fast' | 'accurate' | 'custom'
  languages: 'english-only' | 'multilingual'
}

export const WHISPER_MODELS: ModelInfo[] = [
  { name: 'tiny.en',         label: 'Tiny (English)',      description: 'Very fast, basic accuracy',          sizeMb: 75,   tier: 'custom',    languages: 'english-only' },
  { name: 'tiny',            label: 'Tiny',                description: 'Very fast, basic accuracy',          sizeMb: 75,   tier: 'custom',    languages: 'multilingual' },
  { name: 'base.en',         label: 'Base (English)',      description: 'Fast, decent accuracy',              sizeMb: 142,  tier: 'custom',    languages: 'english-only' },
  { name: 'base',            label: 'Base',                description: 'Fast, decent accuracy',              sizeMb: 142,  tier: 'custom',    languages: 'multilingual' },
  { name: 'small.en',        label: 'Small (English)',     description: 'Good balance of speed and accuracy', sizeMb: 466,  tier: 'fast',      languages: 'english-only' },
  { name: 'small',           label: 'Small',               description: 'Good balance of speed and accuracy', sizeMb: 466,  tier: 'fast',      languages: 'multilingual' },
  { name: 'medium.en',       label: 'Medium (English)',    description: 'High accuracy, slower',              sizeMb: 1533, tier: 'custom',    languages: 'english-only' },
  { name: 'medium',          label: 'Medium',              description: 'High accuracy, slower',              sizeMb: 1533, tier: 'custom',    languages: 'multilingual' },
  { name: 'large-v3-turbo',  label: 'Large Turbo',         description: 'Near-max accuracy, fast (recommended)', sizeMb: 805, tier: 'accurate', languages: 'multilingual' },
  { name: 'large-v3',        label: 'Large v3',            description: 'Maximum accuracy, slowest',          sizeMb: 3094, tier: 'custom',    languages: 'multilingual' },
]

// Hugging Face GGML model URL pattern
const MODEL_BASE_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main'

export class WhisperManager {
  private modelsDir: string
  private dbManager: DatabaseManager
  private abortController: AbortController | null = null

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager
    this.modelsDir = path.join(app.getPath('userData'), 'models', 'whisper')
  }

  async ensureModelsDir(): Promise<void> {
    await fs.mkdir(this.modelsDir, { recursive: true })
  }

  getModelPath(modelName: string): string {
    return path.join(this.modelsDir, `ggml-${modelName}.bin`)
  }

  async getConfig(): Promise<VoiceConfig | null> {
    const raw = this.dbManager.getSetting('voiceConfig')
    if (!raw) return null
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : (raw as VoiceConfig)
    } catch {
      return null
    }
  }

  async setConfig(config: VoiceConfig | null): Promise<void> {
    this.dbManager.setSetting('voiceConfig', config ? JSON.stringify(config) : null)
  }

  async isModelDownloaded(modelName: string): Promise<boolean> {
    try {
      await fs.access(this.getModelPath(modelName))
      return true
    } catch {
      return false
    }
  }

  async listDownloadedModels(): Promise<string[]> {
    await this.ensureModelsDir()
    const files = await fs.readdir(this.modelsDir)
    return files
      .filter(f => f.startsWith('ggml-') && f.endsWith('.bin'))
      .map(f => f.slice(5, -4)) // strip 'ggml-' prefix and '.bin' suffix
  }

  async downloadModel(
    modelName: string,
    onProgress: (progress: number) => void
  ): Promise<void> {
    await this.ensureModelsDir()

    const url = `${MODEL_BASE_URL}/ggml-${modelName}.bin`
    const destPath = this.getModelPath(modelName)
    const tempPath = `${destPath}.tmp`

    this.abortController = new AbortController()
    const { signal } = this.abortController

    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        return reject(new Error('Download cancelled'))
      }

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

          // Follow redirects (HuggingFace uses them)
          if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
            const location = res.headers.location
            if (location) {
              doRequest(location)
            } else {
              reject(new Error('Redirect with no location'))
            }
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

  async deleteModel(modelName: string): Promise<void> {
    const modelPath = this.getModelPath(modelName)
    await fs.unlink(modelPath)

    // If current config uses this model, clear it
    const config = await this.getConfig()
    if (config?.modelName === modelName) {
      await this.setConfig(null)
    }
  }

  getModelInfo(modelName: string): ModelInfo | undefined {
    return WHISPER_MODELS.find(m => m.name === modelName)
  }
}
