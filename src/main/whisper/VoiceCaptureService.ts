import { EventEmitter } from 'events'
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { tmpdir } from 'os'
import type { WhisperManager } from './WhisperManager.js'

const execFileAsync = promisify(execFile)

// Cache the path to whisper-cli so we only search once
let whisperCliPath: string | null = null

async function findWhisperCli(): Promise<string> {
  if (whisperCliPath) return whisperCliPath

  // Get WHISPER_CPP_PATH from nodejs-whisper's bundled constants
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const constants = await import('nodejs-whisper/dist/constants.js') as any
  const cppPath: string = constants.WHISPER_CPP_PATH ?? constants.default?.WHISPER_CPP_PATH
  if (!cppPath) throw new Error('Could not resolve WHISPER_CPP_PATH from nodejs-whisper')

  const execName = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'
  const candidates = [
    path.join(cppPath, 'build', 'bin', execName),
    path.join(cppPath, 'build', 'bin', 'Release', execName),
    path.join(cppPath, 'build', execName),
    path.join(cppPath, execName),
  ]

  for (const p of candidates) {
    if (existsSync(p)) {
      console.log('[VoiceCaptureService] Found whisper-cli at:', p)
      whisperCliPath = p
      return p
    }
  }

  throw new Error(`whisper-cli not found. Searched:\n  ${candidates.join('\n  ')}`)
}

interface TranscriptEvent {
  text: string
  isFinal: boolean
}

// Simple energy-based VAD — no extra dependencies.
// Detects speech when RMS amplitude exceeds a threshold, and speech-end when
// silence persists for SILENCE_MS milliseconds after active speech.
const SAMPLE_RATE = 16000
const SILENCE_THRESHOLD = 0.01   // RMS below this = silence
const SILENCE_MS = 1200           // ms of silence before segment is flushed
const MAX_SEGMENT_MS = 25000      // hard-split long segments

function rms(samples: Float32Array): number {
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i]
  }
  return Math.sqrt(sum / samples.length)
}

export class VoiceCaptureService extends EventEmitter {
  private whisperManager: WhisperManager
  private isRunning = false

  // Audio accumulation
  private speechBuffer: Float32Array[] = []
  private silenceTimer: ReturnType<typeof setTimeout> | null = null
  private segmentTimer: ReturnType<typeof setTimeout> | null = null
  private hasSpeech = false

  // Serialized transcription queue — prevents concurrent whisper-cli processes
  // which would spike memory and produce out-of-order text
  private transcriptionQueue: Promise<void> = Promise.resolve()

  constructor(whisperManager: WhisperManager) {
    super()
    this.whisperManager = whisperManager
  }

  start(): void {
    if (this.isRunning) return
    console.log('[VoiceCaptureService] start()')
    this.isRunning = true
    this.speechBuffer = []
    this.hasSpeech = false
  }

  stop(): Promise<void> {
    if (!this.isRunning) return this.transcriptionQueue
    console.log('[VoiceCaptureService] stop() — buffer chunks:', this.speechBuffer.length)
    this.isRunning = false
    this.clearTimers()

    // Flush whatever's in the buffer as a final segment
    if (this.speechBuffer.length > 0) {
      this.flushSegment(true)
    }

    // Return the queue so callers can await all pending transcriptions
    return this.transcriptionQueue
  }

  /**
   * Called from the IPC handler with each PCM chunk from the renderer's AudioWorklet.
   * chunks are Float32Array (16kHz mono).
   */
  private _chunkCount = 0

  async handleAudioChunk(buffer: ArrayBuffer): Promise<void> {
    if (!this.isRunning) return

    this._chunkCount++
    const samples = new Float32Array(buffer)
    const energy = rms(samples)
    const isSpeech = energy > SILENCE_THRESHOLD

    if (this._chunkCount <= 3 || this._chunkCount % 100 === 0) {
      console.log(`[VoiceCaptureService] chunk #${this._chunkCount} — energy: ${energy.toFixed(5)}, isSpeech: ${isSpeech}, hasSpeech: ${this.hasSpeech}, bufLen: ${this.speechBuffer.length}`)
    }

    if (isSpeech) {
      // Clear silence timer — we have speech
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer)
        this.silenceTimer = null
      }

      this.hasSpeech = true
      this.speechBuffer.push(samples)

      // Start a hard-cap timer if not already running
      if (!this.segmentTimer) {
        this.segmentTimer = setTimeout(() => {
          this.segmentTimer = null
          if (this.speechBuffer.length > 0) {
            this.flushSegment(false)
          }
        }, MAX_SEGMENT_MS)
      }
    } else if (this.hasSpeech) {
      // Silence after speech — accumulate a bit more then flush
      this.speechBuffer.push(samples)

      if (!this.silenceTimer) {
        this.silenceTimer = setTimeout(() => {
          this.silenceTimer = null
          this.flushSegment(false)
        }, SILENCE_MS)
      }
    }
    // Pure silence before any speech — discard
  }

  private clearTimers(): void {
    if (this.silenceTimer) { clearTimeout(this.silenceTimer); this.silenceTimer = null }
    if (this.segmentTimer) { clearTimeout(this.segmentTimer); this.segmentTimer = null }
  }

  private flushSegment(isFinal: boolean): void {
    if (this.speechBuffer.length === 0) return

    const chunks = this.speechBuffer.splice(0)
    this.hasSpeech = false
    this.clearTimers()

    const totalSamples = chunks.reduce((n, c) => n + c.length, 0)
    console.log(`[VoiceCaptureService] flushSegment — isFinal: ${isFinal}, chunks: ${chunks.length}, totalSamples: ${totalSamples} (~${(totalSamples / SAMPLE_RATE).toFixed(2)}s)`)

    // Emit a placeholder so the UI knows transcription is in progress
    this.emit('transcript', { text: '…', isFinal: false } as TranscriptEvent)

    // Chain onto the queue so whisper-cli calls are serialized — one at a time
    this.transcriptionQueue = this.transcriptionQueue.then(async () => {
      try {
        console.log('[VoiceCaptureService] Starting transcription...')
        const text = await this.transcribeChunks(chunks)
        console.log('[VoiceCaptureService] Transcription result:', JSON.stringify(text))
        if (text.trim()) {
          this.emit('transcript', { text: text.trim(), isFinal } as TranscriptEvent)
        } else {
          console.log('[VoiceCaptureService] Transcription returned empty text — nothing emitted')
        }
      } catch (err) {
        console.error('[VoiceCaptureService] transcription error:', err)
      }
    })
  }

  private async transcribeChunks(chunks: Float32Array[]): Promise<string> {
    const config = await this.whisperManager.getConfig()
    console.log('[VoiceCaptureService] transcribeChunks — config:', config)
    if (!config) throw new Error('No voice model configured')

    const modelPath = this.whisperManager.getModelPath(config.modelName)
    console.log('[VoiceCaptureService] modelPath:', modelPath)

    // Verify the model file actually exists before attempting transcription
    if (!existsSync(modelPath)) {
      throw new Error(`Model file not found at: ${modelPath}`)
    }

    // Combine all chunks into one Float32Array
    const totalLength = chunks.reduce((n, c) => n + c.length, 0)
    const combined = new Float32Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      combined.set(chunk, offset)
      offset += chunk.length
    }

    const wavPath = path.join(tmpdir(), `thinkpod-voice-${Date.now()}.wav`)
    await writeWav(wavPath, combined, SAMPLE_RATE)

    try {
      const cli = await findWhisperCli()
      const lang = config.language === 'en' ? 'en' : 'auto'

      console.log('[VoiceCaptureService] Running whisper-cli:', cli, '-m', modelPath, '-l', lang)

      // Call whisper-cli directly so we control the model path.
      // nodejs-whisper's nodewhisper() ignores the modelPath option and always
      // looks in its own node_modules directory — this bypasses that.
      const { stdout, stderr } = await execFileAsync(cli, [
        '-m', modelPath,
        '-f', wavPath,
        '-l', lang,
        '--no-prints',  // suppress progress output
      ], { maxBuffer: 10 * 1024 * 1024 })

      if (stderr) console.log('[VoiceCaptureService] whisper-cli stderr:', stderr)

      // Strip timestamp brackets if present: [00:00:00.000 --> 00:00:02.360]
      const text = stdout
        .replace(/\[\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}\]\s*/g, '')
        .trim()

      console.log('[VoiceCaptureService] whisper-cli stdout (cleaned):', JSON.stringify(text))
      return text
    } finally {
      await fs.unlink(wavPath).catch(() => {})
    }
  }
}

// Minimal WAV writer for 16-bit PCM mono
async function writeWav(filePath: string, samples: Float32Array, sampleRate: number): Promise<void> {
  const numSamples = samples.length
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * bitsPerSample / 8
  const blockAlign = numChannels * bitsPerSample / 8
  const dataSize = numSamples * blockAlign
  const buffer = Buffer.alloc(44 + dataSize)

  // RIFF header
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)            // Subchunk1Size
  buffer.writeUInt16LE(1, 20)             // PCM = 1
  buffer.writeUInt16LE(numChannels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(byteRate, 28)
  buffer.writeUInt16LE(blockAlign, 32)
  buffer.writeUInt16LE(bitsPerSample, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  // PCM samples (float32 → int16)
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    buffer.writeInt16LE(Math.round(s * 32767), 44 + i * 2)
  }

  await fs.writeFile(filePath, buffer)
}
