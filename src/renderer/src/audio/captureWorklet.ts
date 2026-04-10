/**
 * AudioWorklet processor for 16kHz mono PCM capture.
 * This file is loaded as a worklet module — it must be self-contained.
 *
 * The processor resamples from the browser's native sample rate down to 16000 Hz
 * (Whisper's expected input rate) using linear interpolation, then batches
 * 512-sample chunks and sends them to the main thread via postMessage.
 */

const TARGET_SAMPLE_RATE = 16000
const CHUNK_SAMPLES = 512

class WhisperCaptureProcessor extends AudioWorkletProcessor {
  private sourceSampleRate: number
  private resampleRatio: number
  private inputBuffer: Float32Array
  private inputWritePos: number
  private outputBuffer: Float32Array
  private outputWritePos: number

  constructor() {
    super()
    // sampleRate is a global in AudioWorkletGlobalScope
    this.sourceSampleRate = sampleRate
    this.resampleRatio = TARGET_SAMPLE_RATE / this.sourceSampleRate

    // Input ring buffer: enough for one web audio render quantum (128 samples) + margin
    this.inputBuffer = new Float32Array(4096)
    this.inputWritePos = 0

    this.outputBuffer = new Float32Array(CHUNK_SAMPLES * 4)
    this.outputWritePos = 0
  }

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0]
    if (!input || input.length === 0) return true

    // Accumulate input samples
    for (let i = 0; i < input.length; i++) {
      this.inputBuffer[this.inputWritePos++ % this.inputBuffer.length] = input[i]
    }

    // Resample to 16kHz and accumulate in output buffer
    const numOutputSamples = Math.floor(input.length * this.resampleRatio)
    for (let i = 0; i < numOutputSamples; i++) {
      const srcIndex = i / this.resampleRatio
      const srcFloor = Math.floor(srcIndex) % this.inputBuffer.length
      const srcCeil = (srcFloor + 1) % this.inputBuffer.length
      const frac = srcIndex - Math.floor(srcIndex)
      const sample = this.inputBuffer[srcFloor] * (1 - frac) + this.inputBuffer[srcCeil] * frac

      this.outputBuffer[this.outputWritePos++] = sample

      // Flush a full chunk to the main thread
      if (this.outputWritePos >= CHUNK_SAMPLES) {
        const chunk = this.outputBuffer.slice(0, CHUNK_SAMPLES)
        this.port.postMessage(chunk.buffer, [chunk.buffer])
        this.outputBuffer = new Float32Array(CHUNK_SAMPLES * 4)
        this.outputWritePos = 0
      }
    }

    return true
  }
}

registerProcessor('whisper-capture-processor', WhisperCaptureProcessor)
