import { EventEmitter } from 'events'
import path from 'path'
import fs from 'fs/promises'
import { tmpdir } from 'os'
import { app } from 'electron'
import type { WhisperManager } from './WhisperManager.js'

// nodejs-whisper ships CommonJS; import dynamically to avoid ESM issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let nodeWhisper: any = null

async function getNodeWhisper() {
  if (!nodeWhisper) {
    nodeWhisper = await import('nodejs-whisper')
  }
  return nodeWhisper
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

  constructor(whisperManager: WhisperManager) {
    super()
    this.whisperManager = whisperManager
  }

  start(): void {
    if (this.isRunning) return
    this.isRunning = true
    this.speechBuffer = []
    this.hasSpeech = false
  }

  stop(): void {
    if (!this.isRunning) return
    this.isRunning = false
    this.clearTimers()

    // Flush whatever's in the buffer as a final segment
    if (this.speechBuffer.length > 0) {
      this.flushSegment(true)
    }
  }

  /**
   * Called from the IPC handler with each PCM chunk from the renderer's AudioWorklet.
   * chunks are Float32Array (16kHz mono).
   */
  async handleAudioChunk(buffer: ArrayBuffer): Promise<void> {
    if (!this.isRunning) return

    const samples = new Float32Array(buffer)
    const energy = rms(samples)
    const isSpeech = energy > SILENCE_THRESHOLD

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

  private async flushSegment(isFinal: boolean): Promise<void> {
    if (this.speechBuffer.length === 0) return

    const chunks = this.speechBuffer.splice(0)
    this.hasSpeech = false
    this.clearTimers()

    // Emit a placeholder so the UI knows transcription is in progress
    this.emit('transcript', { text: '…', isFinal: false } as TranscriptEvent)

    try {
      const text = await this.transcribeChunks(chunks)
      if (text.trim()) {
        this.emit('transcript', { text: text.trim(), isFinal } as TranscriptEvent)
      }
    } catch (err) {
      console.error('[VoiceCaptureService] transcription error:', err)
    }
  }

  private async transcribeChunks(chunks: Float32Array[]): Promise<string> {
    const config = await this.whisperManager.getConfig()
    if (!config) throw new Error('No voice model configured')

    const modelPath = this.whisperManager.getModelPath(config.modelName)

    // Combine all chunks into one Float32Array
    const totalLength = chunks.reduce((n, c) => n + c.length, 0)
    const combined = new Float32Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      combined.set(chunk, offset)
      offset += chunk.length
    }

    // Write as a raw PCM WAV to a temp file for nodejs-whisper
    const wavPath = path.join(tmpdir(), `scriptorium-voice-${Date.now()}.wav`)
    await writeWav(wavPath, combined, SAMPLE_RATE)

    try {
      const whisper = await getNodeWhisper()
      // nodejs-whisper API: whisper(filePath, options) → string
      const result = await whisper.nodewhisper(wavPath, {
        modelName: config.modelName,
        autoDownloadModelName: undefined,
        whisperOptions: {
          outputInText: true,
          outputInVtt: false,
          outputInSrt: false,
          outputInCsv: false,
          translateToEnglish: false,
          language: config.language === 'en' ? 'en' : undefined,
          wordTimestamps: false,
          timestamps_length: 60,
        },
        modelPath,
      })
      return typeof result === 'string' ? result : ''
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
