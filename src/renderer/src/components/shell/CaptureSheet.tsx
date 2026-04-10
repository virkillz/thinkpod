import { useState, useCallback, useEffect, useRef } from 'react'
import { X, Mic, MicOff, Square, Settings, ArrowRight } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'
import captureWorkletUrl from '../../audio/captureWorklet.js?url'

interface CaptureSheetProps {
  isOpen: boolean
  onClose: () => void
  onOpenSettings?: () => void
}

type VoiceState = 'idle' | 'listening' | 'stopping'

export function CaptureSheet({ isOpen, onClose, onOpenSettings }: CaptureSheetProps) {
  const [content, setContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [voiceConfigured, setVoiceConfigured] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [showVoiceInfo, setShowVoiceInfo] = useState(false)
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
      console.log('[VoiceCapture] Whisper config:', config)
      setVoiceConfigured(config !== null)
    })
  }, [isOpen])

  // Subscribe to streaming transcript push events
  useEffect(() => {
    const cleanup = window.electronAPI.onVoiceTranscript(({ text, isFinal }) => {
      console.log('[VoiceCapture] Transcript received — isFinal:', isFinal, 'text:', JSON.stringify(text))
      if (text === '…') return // placeholder while processing

      transcriptBufRef.current += (transcriptBufRef.current ? ' ' : '') + text
      setContent(transcriptBufRef.current)
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
    console.log('[VoiceCapture] startVoice — requesting microphone...')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log('[VoiceCapture] Got media stream, tracks:', stream.getTracks().map(t => `${t.kind}:${t.label}`))
      streamRef.current = stream

      const ctx = new AudioContext({ sampleRate: 16000 })
      console.log('[VoiceCapture] AudioContext created, state:', ctx.state, 'sampleRate:', ctx.sampleRate)
      audioCtxRef.current = ctx

      // Load AudioWorklet
      console.log('[VoiceCapture] Loading worklet from:', captureWorkletUrl)
      await ctx.audioWorklet.addModule(captureWorkletUrl)
      console.log('[VoiceCapture] Worklet module loaded')

      const source = ctx.createMediaStreamSource(stream)

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser
      source.connect(analyser)

      const workletNode = new AudioWorkletNode(ctx, 'whisper-capture-processor')
      workletNodeRef.current = workletNode
      source.connect(workletNode)

      let chunkCount = 0
      // Forward PCM chunks to main process
      workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        chunkCount++
        if (chunkCount <= 3 || chunkCount % 50 === 0) {
          console.log('[VoiceCapture] Sending audio chunk #', chunkCount, 'byteLength:', e.data.byteLength)
        }
        window.electronAPI.sendAudioChunk(e.data)
      }

      console.log('[VoiceCapture] Calling startVoiceCapture IPC...')
      const result = await window.electronAPI.startVoiceCapture()
      console.log('[VoiceCapture] startVoiceCapture result:', result)
      setVoiceState('listening')
      startAmplitudeLoop(analyser)
    } catch (err) {
      console.error('[VoiceCapture] Failed to start voice capture:', err)
      setVoiceState('idle')
      setVoiceError(err instanceof Error ? err.message : 'Failed to start recording')
    }
  }

  const stopVoice = async () => {
    console.log('[VoiceCapture] stopVoice called')
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

    console.log('[VoiceCapture] Calling stopVoiceCapture IPC...')
    await window.electronAPI.stopVoiceCapture()
    console.log('[VoiceCapture] stopVoiceCapture done')
    setVoiceState('idle')
  }

  const handleVoiceClick = () => {
    console.log('[VoiceCapture] handleVoiceClick — voiceState:', voiceState, 'voiceConfigured:', voiceConfigured)
    if (voiceState === 'listening') {
      stopVoice()
    } else if (voiceState === 'idle' && voiceConfigured) {
      setVoiceError(null)
      startVoice()
    } else if (!voiceConfigured) {
      console.log('[VoiceCapture] Voice not configured — showing info panel')
      setShowVoiceInfo(true)
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

        {/* Recording indicator — only shown while listening */}
        {isListening && (
          <div className="flex items-center gap-3 px-6 pt-4">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <div className="flex items-end gap-0.5 flex-1" style={{ height: 32 }}>
              {amplitude.map((v, i) => (
                <div
                  key={i}
                  className="flex-1 bg-red-400 rounded-full transition-all duration-75"
                  style={{ height: `${Math.max(3, v * 32)}px` }}
                />
              ))}
            </div>
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

        {/* Error */}
        {voiceError && (
          <div className="px-6 py-2 text-sm text-red-600 bg-red-50 border-t border-red-100">
            {voiceError}
          </div>
        )}

        {/* Voice Info Panel - shown when clicking voice button without config */}
        {showVoiceInfo && (
          <div className="px-6 py-4 border-t border-parchment-dark bg-amber-50/50">
            <div className="flex items-start gap-3">
              <Settings className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-ink-primary">
                  Voice capture is not configured. Download a Whisper model to enable offline dictation.
                </p>
                <button
                  onClick={() => {
                    setShowVoiceInfo(false)
                    onClose()
                    onOpenSettings?.()
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover transition-colors"
                >
                  Go to Rule → Voice
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={() => setShowVoiceInfo(false)}
                className="p-1 text-ink-muted hover:text-ink-primary rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Voice Capture Button */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-parchment-dark">
          <button
            onClick={handleVoiceClick}
            disabled={voiceState === 'stopping'}
            title={
              isListening
                ? 'Stop recording'
                : voiceConfigured
                ? 'Start voice capture'
                : 'Set up voice in Rule → Voice'
            }
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              isListening
                ? 'text-white bg-red-500 hover:bg-red-600'
                : voiceConfigured
                ? 'text-ink-muted hover:text-ink-primary hover:bg-parchment-sidebar'
                : 'text-ink-muted hover:text-ink-primary hover:bg-parchment-sidebar'
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
