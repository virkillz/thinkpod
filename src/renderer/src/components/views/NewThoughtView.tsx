import { useState, useCallback, useEffect, useRef } from 'react'
import { Mic, MicOff, Square, Settings, ArrowRight } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'
import captureWorkletUrl from '../../audio/captureWorklet.js?url'

type VoiceState = 'idle' | 'listening' | 'stopping'

export function NewThoughtView() {
  const [content, setContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [voiceConfigured, setVoiceConfigured] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [showVoiceInfo, setShowVoiceInfo] = useState(false)
  const [amplitude, setAmplitude] = useState<number[]>(Array(24).fill(0))
  const { refreshFileTree, setCurrentView } = useAppStore()

  const audioCtxRef = useRef<AudioContext | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const transcriptBufRef = useRef<string>('')

  const now = new Date()
  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0

  useEffect(() => {
    window.electronAPI.getWhisperConfig().then(({ config }) => {
      setVoiceConfigured(config !== null)
    })
  }, [])

  useEffect(() => {
    const cleanup = window.electronAPI.onVoiceTranscript(({ text }) => {
      if (text === '…') return
      transcriptBufRef.current += (transcriptBufRef.current ? ' ' : '') + text
      setContent(transcriptBufRef.current)
    })
    return cleanup
  }, [])

  const handleSave = useCallback(async () => {
    if (!content.trim()) return
    setIsSaving(true)
    try {
      const date = new Date()
      const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const slug =
        content
          .slice(0, 30)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'thought'
      const filename = `${timestamp}-${slug}.md`
      await window.electronAPI.writeFile(`_thoughts/${filename}`, content)
      await refreshFileTree()
      setContent('')
      transcriptBufRef.current = ''
      setCurrentView('thoughts')
    } catch (error) {
      console.error('Failed to save thought:', error)
    } finally {
      setIsSaving(false)
    }
  }, [content, refreshFileTree, setCurrentView])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave()
      if (e.key === 'Escape' && voiceState === 'idle') setCurrentView('thoughts')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, voiceState, setCurrentView])

  useEffect(() => {
    return () => {
      if (voiceState === 'listening') stopVoice()
    }
  }, [voiceState])

  const startAmplitudeLoop = (analyser: AnalyserNode) => {
    const data = new Uint8Array(analyser.fftSize)
    const tick = () => {
      analyser.getByteTimeDomainData(data)
      const bars = Array.from({ length: 24 }, (_, i) => {
        const start = Math.floor((i / 24) * data.length)
        const end = Math.floor(((i + 1) / 24) * data.length)
        let sum = 0
        for (let j = start; j < end; j++) sum += Math.abs(data[j] - 128)
        return Math.min(1, sum / (end - start) / 40)
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
    setAmplitude(Array(24).fill(0))
  }

  const startVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const ctx = new AudioContext({ sampleRate: 16000 })
      audioCtxRef.current = ctx

      await ctx.audioWorklet.addModule(captureWorkletUrl)

      const source = ctx.createMediaStreamSource(stream)

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser
      source.connect(analyser)

      const workletNode = new AudioWorkletNode(ctx, 'whisper-capture-processor')
      workletNodeRef.current = workletNode
      source.connect(workletNode)

      workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        window.electronAPI.sendAudioChunk(e.data)
      }

      await window.electronAPI.startVoiceCapture()
      setVoiceState('listening')
      startAmplitudeLoop(analyser)
    } catch (err) {
      setVoiceState('idle')
      setVoiceError(err instanceof Error ? err.message : 'Failed to start recording')
    }
  }

  const stopVoice = async () => {
    setVoiceState('stopping')
    stopAmplitudeLoop()

    workletNodeRef.current?.disconnect()
    workletNodeRef.current = null
    analyserRef.current?.disconnect()
    analyserRef.current = null

    streamRef.current?.getTracks().forEach((t) => t.stop())
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
      setVoiceError(null)
      startVoice()
    } else if (!voiceConfigured) {
      setShowVoiceInfo(true)
    }
  }

  const isListening = voiceState === 'listening'

  return (
    <div className="flex-1 flex flex-col h-full bg-parchment-base relative group/page">

      {/* Voice setup notification — top right, non-blocking */}
      {showVoiceInfo && (
        <div className="absolute top-5 right-5 z-20 max-w-[280px] bg-parchment-card border border-parchment-dark rounded-xl shadow-lg p-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-3">
            <Settings className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-ink-primary leading-relaxed">
                Voice capture needs a Whisper model to work offline.
              </p>
              <button
                onClick={() => {
                  setShowVoiceInfo(false)
                  setCurrentView('settings')
                }}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
              >
                Set up in Settings <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <button
              onClick={() => setShowVoiceInfo(false)}
              className="text-ink-light hover:text-ink-muted transition-colors flex-shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Error toast */}
      {voiceError && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 bg-parchment-card border border-red-200 text-red-500 text-xs rounded-full px-4 py-2 shadow-sm animate-in fade-in duration-200">
          {voiceError}
        </div>
      )}

      {/* Writing area — full bleed, no chrome */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-10 pt-20 pb-40">

          {/* Date — barely there, anchors the page */}
          <p className="font-serif text-sm text-ink-light mb-12 select-none tracking-wide">
            {dateLabel}
          </p>

          {/* The writing surface — invisible input, pure text */}
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              if (!isListening) transcriptBufRef.current = e.target.value
            }}
            placeholder={isListening ? 'Listening…' : "What's on your mind?"}
            className="w-full min-h-[55vh] bg-transparent border-none outline-none resize-none font-serif text-xl text-ink-primary leading-[1.85] placeholder:text-ink-light/60 focus:outline-none caret-accent"
            autoFocus={!isListening}
            readOnly={isListening}
          />
        </div>
      </div>

      {/* Floating micro-toolbar — fades in on hover or focus */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-7 pointer-events-none">
        <div
          className={`
            pointer-events-auto flex items-center gap-3 px-5 py-2.5
            bg-parchment-card/90 backdrop-blur-sm
            border border-parchment-dark
            rounded-full shadow-sm
            transition-opacity duration-500 ease-out
            ${isListening
              ? 'opacity-100'
              : 'opacity-0 group-hover/page:opacity-100 group-focus-within/page:opacity-100'}
          `}
        >
          {/* Waveform — only while recording */}
          {isListening && (
            <div className="flex items-center gap-0.5 pr-1" style={{ height: 18 }}>
              <span className="relative flex h-1.5 w-1.5 mr-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
              </span>
              {amplitude.map((v, i) => (
                <div
                  key={i}
                  className="w-px bg-red-400 rounded-full transition-all duration-75"
                  style={{ height: `${Math.max(2, v * 18)}px` }}
                />
              ))}
            </div>
          )}

          {/* Mic / Stop button */}
          <button
            onClick={handleVoiceClick}
            disabled={voiceState === 'stopping'}
            title={
              isListening
                ? 'Stop recording'
                : voiceConfigured
                ? 'Voice dictation'
                : 'Set up voice in Settings'
            }
            className={`transition-colors duration-150 ${
              isListening
                ? 'text-red-500 hover:text-red-600'
                : voiceConfigured
                ? 'text-ink-muted hover:text-accent'
                : 'text-ink-light hover:text-ink-muted'
            }`}
          >
            {isListening ? (
              <Square className="w-3.5 h-3.5 fill-current" />
            ) : voiceConfigured ? (
              <Mic className="w-3.5 h-3.5" />
            ) : (
              <MicOff className="w-3.5 h-3.5" />
            )}
          </button>

          <div className="w-px h-3.5 bg-parchment-dark" />

          {/* Word count */}
          <span className="text-xs text-ink-light tabular-nums select-none">
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </span>

          <div className="w-px h-3.5 bg-parchment-dark" />

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={!content.trim() || isSaving || isListening}
            className="text-xs text-ink-muted hover:text-accent disabled:text-ink-light disabled:cursor-not-allowed transition-colors duration-150 font-medium tracking-wide"
          >
            {isSaving ? 'Saving…' : '⌘↵ Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
