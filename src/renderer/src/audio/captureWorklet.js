/**
 * AudioWorklet processor for 16kHz mono PCM capture.
 * This file is loaded as a worklet module — it must be self-contained.
 *
 * Downsamples from the browser's native sample rate to 16000 Hz using linear
 * interpolation, batches 512-sample chunks, and sends them to the main thread.
 */

const TARGET_SAMPLE_RATE = 16000
const CHUNK_SAMPLES = 512

class WhisperCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.resampleRatio = TARGET_SAMPLE_RATE / sampleRate
    this.outputBuffer = new Float32Array(CHUNK_SAMPLES * 2)
    this.outputWritePos = 0
  }

  process(inputs) {
    const input = inputs[0]?.[0]
    if (!input || input.length === 0) return true

    // Downsample each quantum independently via linear interpolation.
    // Each quantum is self-contained so there's no cross-boundary accumulation needed.
    const numOutputSamples = Math.floor(input.length * this.resampleRatio)
    for (let i = 0; i < numOutputSamples; i++) {
      const srcIndex = i / this.resampleRatio
      const srcFloor = Math.floor(srcIndex)
      const srcCeil = Math.min(srcFloor + 1, input.length - 1)
      const frac = srcIndex - srcFloor
      const sample = input[srcFloor] * (1 - frac) + input[srcCeil] * frac

      this.outputBuffer[this.outputWritePos++] = sample

      if (this.outputWritePos >= CHUNK_SAMPLES) {
        const chunk = this.outputBuffer.slice(0, CHUNK_SAMPLES)
        this.port.postMessage(chunk.buffer, [chunk.buffer])
        this.outputBuffer = new Float32Array(CHUNK_SAMPLES * 2)
        this.outputWritePos = 0
      }
    }

    return true
  }
}

registerProcessor('whisper-capture-processor', WhisperCaptureProcessor)
