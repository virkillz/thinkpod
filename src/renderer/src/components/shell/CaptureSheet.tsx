import { useState, useCallback, useEffect, useRef } from 'react'
import { X, Mic, MicOff, Square } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'

interface CaptureSheetProps {
  isOpen: boolean
  onClose: () => void
}

type VoiceState = 'idle' | 'listening' | 'stopping'

export function CaptureSheet({ isOpen, onClose }: CaptureSheetProps) {
  const [content, setContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [voiceConfigured, setVoiceConfigured] = useState(false)
  const [amplitude, setAmplitude] = useState<number[]>(Array(16).fill(0))
  const { refreshFileTree } = useAppStore()

  // Refs for audio pipeline
  const audioCtxRef = useRef<AudioContext | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const transcriptBufRef = useRef<string>('')

  // Check if voice is configured on open
  useEffect(() => {
    if (!isOpen) return
    window.electronAPI.getWhisperConfig().then(({ config }) => {
      setVoiceConfigured(config !== null)
    })
  }, [isOpen])

  // Subscribe to streaming transcript push events
  useEffect(() => {
    const cleanup = window.electronAPI.onVoiceTranscript(({ text, isFinal }) => {
      if (text === '…') return // placeholder while processing

      if (isFinal) {
        transcriptBufRef.current += (transcriptBufRef.current ? ' ' : '') + text
        setContent(transcriptBufRef.current)
      } else {
        // Partial — show inline without committing to the buffer
        setContent(transcriptBufRef.current + (transcriptBufRef.current ? ' ' : '') + text)
      }
    })
    return cleanup
  }, [])

  // Handle keyboard shortcut Cmd+Enter to save
  const handleSave = useCallback(async () => {
    if (!content.trim()) return
    setIsSaving(true)
    try {
      const date = new Date()
      const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const slug = content.slice(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'folio'
      const filename = `${timestamp}-${slug}.md`
      await window.electronAPI.writeFile(`_folios/${filename}`, content)
      await refreshFileTree()
      setContent('')
      transcriptBufRef.current = ''
      onClose()
    } catch (error) {
      console.error('Failed to save folio:', error)
    } finally {
      setIsSaving(false)
    }
  }, [content, refreshFileTree, onClose])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleSave])

  // Stop voice when sheet closes
  useEffect(() => {
    if (!isOpen && voiceState === 'listening') {
      stopVoice()
    }
    if (!isOpen) {
      setContent('')
      transcriptBufRef.current = ''
      setVoiceState('idle')
    }
  }, [isOpen])

  // Amplitude animation loop
  const startAmplitudeLoop = (analyser: AnalyserNode) => {
    const data = new Uint8Array(analyser.fftSize)
    const tick = () => {
      analyser.getByteTimeDomainData(data)
      const bars = Array.from({ length: 16 }, (_, i) => {
        const start = Math.floor((i / 16) * data.length)
        const end = Math.floor(((i + 1) / 16) * data.length)
        let sum = 0
        for (let j = start; j < end; j++) sum += Math.abs(data[j] - 128)
        return Math.min(1, (sum / (end - start)) / 40)
      })
      setAmplitude(bars)
      animFrameRef.current = requestAnimationFrame(tick)
    }
    animFrameRef.current = requestAnimationFrame(tick)
  }

  const stopAmplitudeLoop = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    setAmplitude(Array(16).fill(0))
  }

  const startVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const ctx = new AudioContext({ sampleRate: 16000 })
      audioCtxRef.current = ctx

      // Load AudioWorklet
      const workletUrl = new URL('../../audio/captureWorklet.ts', import.meta.url).href
      await ctx.audioWorklet.addModule(workletUrl)

      const source = ctx.createMediaStreamSource(stream)

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser
      source.connect(analyser)

      const workletNode = new AudioWorkletNode(ctx, 'whisper-capture-processor')
      workletNodeRef.current = workletNode
      source.connect(workletNode)

      // Forward PCM chunks to main process
      workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        window.electronAPI.sendAudioChunk(e.data)
      }

      await window.electronAPI.startVoiceCapture()
      setVoiceState('listening')
      startAmplitudeLoop(analyser)
    } catch (err) {
      console.error('[CaptureSheet] Failed to start voice capture:', err)
      setVoiceState('idle')
    }
  }

  const stopVoice = async () => {
    setVoiceState('stopping')
    stopAmplitudeLoop()

    workletNodeRef.current?.disconnect()
    workletNodeRef.current = null
    analyserRef.current?.disconnect()
    analyserRef.current = null

    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null

    await audioCtxRef.current?.close()
    audioCtxRef.current = null

    await window.electronAPI.stopVoiceCapture()
    setVoiceState('idle')
  }

  const handleVoiceClick = () => {
    if (voiceState === 'listening') {
      stopVoice()
    } else if (voiceState === 'idle' && voiceConfigured) {
      startVoice()
    }
  }

  if (!isOpen) return null

  const isListening = voiceState === 'listening'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-8 pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink-primary/20 pointer-events-auto"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl pointer-events-auto animate-in slide-in-from-bottom-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark">
          <h3 className="font-serif font-medium text-lg text-ink-primary">New Folio</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-parchment-sidebar rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-ink-muted" />
          </button>
        </div>

        {/* Waveform bar — only shown while listening */}
        {isListening && (
          <div className="flex items-center gap-0.5 px-6 pt-4">
            {amplitude.map((v, i) => (
              <div
                key={i}
                className="flex-1 bg-accent rounded-full transition-all duration-75"
                style={{ height: `${Math.max(3, v * 32)}px` }}
              />
            ))}
          </div>
        )}

        {/* Editor */}
        <div className="p-6">
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              if (!isListening) transcriptBufRef.current = e.target.value
            }}
            placeholder={isListening ? 'Listening…' : 'Write here…'}
            className="w-full h-64 p-4 bg-parchment-base rounded-lg border border-parchment-dark focus:outline-none focus:border-accent resize-none font-serif text-ink-primary leading-relaxed"
            autoFocus={!isListening}
            readOnly={isListening}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-parchment-dark">
          <button
            onClick={handleVoiceClick}
            disabled={!voiceConfigured || voiceState === 'stopping'}
            title={
              !voiceConfigured
                ? 'Set up voice in Rule → Voice'
                : isListening
                ? 'Stop recording'
                : 'Start voice capture'
            }
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              isListening
                ? 'text-white bg-red-500 hover:bg-red-600'
                : voiceConfigured
                ? 'text-ink-muted hover:text-ink-primary hover:bg-parchment-sidebar'
                : 'text-ink-light cursor-not-allowed'
            }`}
          >
            {isListening ? (
              <>
                <Square className="w-4 h-4 fill-current" />
                <span className="text-sm font-medium">Stop</span>
              </>
            ) : voiceConfigured ? (
              <>
                <Mic className="w-5 h-5" />
                <span className="text-sm">Voice</span>
              </>
            ) : (
              <>
                <MicOff className="w-5 h-5" />
                <span className="text-sm">Voice</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-muted">Cmd+Enter to save</span>
            <button
              onClick={handleSave}
              disabled={!content.trim() || isSaving || isListening}
              className="px-6 py-2 bg-accent hover:bg-accent-hover disabled:bg-ink-light disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {isSaving ? 'Saving…' : 'Save Folio'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
