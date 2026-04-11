import { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import {
  Mic, MicOff, Square, Settings, ArrowRight,
  Sparkles, BookOpen, Pencil, X, Loader2, AlertTriangle, Check, SlidersHorizontal,
} from 'lucide-react'
import { WritingCanvas, WritingCanvasHandle } from './WritingCanvas.js'
import { MarkdownPreview } from '../codex/MarkdownPreview.js'
import { EditorSettingsModal } from './EditorSettingsModal.js'
import { useEditorSettings } from '../../hooks/useEditorSettings.js'
import captureWorkletUrl from '../../audio/captureWorklet.js?url'

// ─── AI Edit ──────────────────────────────────────────────────────────────────

type VoiceState = 'idle' | 'listening' | 'stopping'
type ViewMode = 'edit' | 'view'
type WizardStep = 'select' | 'processing' | 'preview'
type EditMode = 'replace' | 'append'
type SaveStatus = 'idle' | 'saving' | 'saved'

const PRESET_ACTIONS = [
  { label: 'Summarize', instruction: 'Summarize this text concisely.' },
  { label: 'Improve writing', instruction: 'Improve the writing: fix grammar, clarity, and flow.' },
  { label: 'Fix typos', instruction: 'Fix all spelling and grammar mistakes only, do not change anything else.' },
  { label: 'Fix format', instruction: 'Fix formatting issues: proper headings, lists, code blocks, and spacing. Use Markdown format.' },
  { label: 'Make it formal', instruction: 'Rewrite in a formal, professional tone.' },
  { label: 'Make it casual', instruction: 'Rewrite in a friendly, casual tone.' },
]

// ─── Handle ───────────────────────────────────────────────────────────────────

export interface UniversalEditorHandle {
  undo(): void
  redo(): void
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface UniversalEditorProps {
  // Content source
  mode: 'new' | 'edit'
  filePath?: string        // edit mode: auto-loads and auto-saves
  reloadTrigger?: number   // increment to force reload from disk

  // New-mode config
  saveToFolder?: string    // default '_thoughts'
  onSaved?: () => void     // called after new thought saved to disk
  onCancel?: () => void    // called on Escape (new mode)

  // Feature flags (defaults: voice+aiEdit always on; viewToggle only in edit mode)
  showVoice?: boolean
  showAiEdit?: boolean
  showViewToggle?: boolean

  // Callback for parents that need to track content (e.g. ThoughtsView → TriageWizard)
  onContentChange?: (content: string) => void

  placeholder?: string
  initialContent?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export const UniversalEditor = forwardRef<UniversalEditorHandle, UniversalEditorProps>(function UniversalEditor({
  mode,
  filePath,
  reloadTrigger = 0,
  saveToFolder = '_thoughts',
  onSaved,
  onCancel,
  showVoice = true,
  showAiEdit = true,
  showViewToggle,
  onContentChange,
  placeholder: placeholderProp,
  initialContent = '',
}: UniversalEditorProps, ref) {
  // ── Content ───────────────────────────────────────────────────────────────
  const [content, setContent] = useState(initialContent)
  const canvasRef = useRef<WritingCanvasHandle>(null)

  useImperativeHandle(ref, () => ({
    undo() { canvasRef.current?.undo() },
    redo() { canvasRef.current?.redo() },
  }))
  const lastSavedRef = useRef('')   // tracks what's on disk — skip redundant saves

  // ── View ──────────────────────────────────────────────────────────────────
  const canToggleView = showViewToggle ?? mode === 'edit'
  const [viewMode, setViewMode] = useState<ViewMode>('edit')

  // ── Save ──────────────────────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [isSaving, setIsSaving] = useState(false)   // new-mode one-shot save

  // ── Voice ─────────────────────────────────────────────────────────────────
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [voiceConfigured, setVoiceConfigured] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [showVoiceInfo, setShowVoiceInfo] = useState(false)
  const [amplitude, setAmplitude] = useState<number[]>(Array(24).fill(0))

  const audioCtxRef = useRef<AudioContext | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)

  // ── Editor Settings ───────────────────────────────────────────────────────
  const { settings, updateSettings, resetSettings } = useEditorSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)

  // ── AI Edit wizard ────────────────────────────────────────────────────────
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState<WizardStep>('select')
  const [selectedAction, setSelectedAction] = useState<typeof PRESET_ACTIONS[0] | null>(null)
  const [customInstruction, setCustomInstruction] = useState('')
  const [editMode, setEditMode] = useState<EditMode>('replace')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [pendingEdit, setPendingEdit] = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  // ── Derived ───────────────────────────────────────────────────────────────
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0
  const isListening = voiceState === 'listening'

  const now = new Date()
  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  // ── Init: check voice config ──────────────────────────────────────────────
  useEffect(() => {
    window.electronAPI.getWhisperConfig().then(({ config }) => {
      setVoiceConfigured(config !== null)
    })
  }, [])

  // ── Voice transcript handler ──────────────────────────────────────────────
  useEffect(() => {
    const cleanup = window.electronAPI.onVoiceTranscript(({ text }) => {
      if (text === '…') return
      canvasRef.current?.appendText(text)
    })
    return cleanup
  }, [])

  // ── File loading (edit mode) ──────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'edit' || !filePath) return
    let cancelled = false
    const load = async () => {
      try {
        const result = await window.electronAPI.readFile(filePath)
        if (cancelled) return
        const loaded = result.content ?? ''
        setContent(loaded)
        lastSavedRef.current = loaded
        canvasRef.current?.reinitialize(loaded)
      } catch {
        if (!cancelled) setContent('')
      }
    }
    load()
    return () => { cancelled = true }
  }, [filePath, mode, reloadTrigger])

  // ── Auto-save (edit mode) ─────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'edit' || !filePath) return
    if (content === lastSavedRef.current) return

    const timer = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        await window.electronAPI.writeFile(filePath, content)
        lastSavedRef.current = content
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch {
        setSaveStatus('idle')
      }
    }, 1500)

    return () => clearTimeout(timer)
  }, [content, filePath, mode])

  // ── Notify parent of content changes ─────────────────────────────────────
  const onContentChangeRef = useRef(onContentChange)
  useEffect(() => { onContentChangeRef.current = onContentChange }, [onContentChange])
  useEffect(() => { onContentChangeRef.current?.(content) }, [content])

  // ── Keyboard: Cmd+S force-save ────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (mode === 'edit' && filePath && content !== lastSavedRef.current) {
          setSaveStatus('saving')
          window.electronAPI.writeFile(filePath, content).then(() => {
            lastSavedRef.current = content
            setSaveStatus('saved')
            setTimeout(() => setSaveStatus('idle'), 2000)
          }).catch(() => setSaveStatus('idle'))
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, filePath, content])

  // ── Stop voice on unmount ─────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (voiceState === 'listening') stopVoice()
    }
  }, [voiceState]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Amplitude loop ────────────────────────────────────────────────────────
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
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null }
    setAmplitude(Array(24).fill(0))
  }

  // ── Voice start / stop ────────────────────────────────────────────────────
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
    workletNodeRef.current?.disconnect(); workletNodeRef.current = null
    analyserRef.current?.disconnect(); analyserRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null
    await audioCtxRef.current?.close(); audioCtxRef.current = null
    await window.electronAPI.stopVoiceCapture()
    setVoiceState('idle')
  }

  const handleVoiceClick = () => {
    if (voiceState === 'listening') { stopVoice(); return }
    if (voiceState === 'idle' && voiceConfigured) { setVoiceError(null); startVoice(); return }
    if (!voiceConfigured) setShowVoiceInfo(true)
  }

  // ── AI Edit ───────────────────────────────────────────────────────────────
  const resetWizard = useCallback(() => {
    setWizardOpen(false)
    setWizardStep('select')
    setSelectedAction(null)
    setCustomInstruction('')
    setEditMode('replace')
    setAiError(null)
    setPendingEdit(null)
  }, [])

  const runAiEdit = async () => {
    const instruction = selectedAction?.instruction ?? customInstruction.trim()
    if (!instruction) return
    setWizardStep('processing')
    setAiError(null)
    setAiLoading(true)
    try {
      const result = await window.electronAPI.editText(content, instruction)
      if (result.success && result.content) {
        setPendingEdit(result.content)
        setWizardStep('preview')
      } else {
        setAiError(result.error ?? 'Unknown error')
        setWizardStep('select')
      }
    } catch (err) {
      setAiError((err as Error).message)
      setWizardStep('select')
    } finally {
      setAiLoading(false)
    }
  }

  const acceptEdit = async () => {
    if (pendingEdit === null) return
    const finalContent = editMode === 'append' ? content + '\n\n' + pendingEdit : pendingEdit
    canvasRef.current?.replaceContent(finalContent)
    // Force immediate save for AI edits rather than waiting for debounce
    if (mode === 'edit' && filePath) {
      await window.electronAPI.writeFile(filePath, finalContent)
      lastSavedRef.current = finalContent
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }
    resetWizard()
  }

  // ── New-mode save ─────────────────────────────────────────────────────────
  const handleNewSave = useCallback(async () => {
    if (!content.trim() || isSaving) return
    setIsSaving(true)
    try {
      const date = new Date()
      const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const slug = content.slice(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'thought'
      const filename = `${timestamp}-${slug}.md`
      await window.electronAPI.writeFile(`${saveToFolder}/${filename}`, content)
      onSaved?.()
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setIsSaving(false)
    }
  }, [content, isSaving, saveToFolder, onSaved])

  // ── Canvas callbacks ──────────────────────────────────────────────────────
  const handleChange = useCallback((newContent: string) => setContent(newContent), [])

  const handleCmdEnter = useCallback(() => {
    if (mode === 'new') handleNewSave()
  }, [mode, handleNewSave])

  const handleEscape = useCallback(() => {
    if (voiceState === 'idle' && mode === 'new') onCancel?.()
  }, [voiceState, mode, onCancel])

  const defaultPlaceholder = mode === 'new' ? "What's on your mind?" : 'Start writing…'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col h-full relative group/page">

      {/* Voice setup notification */}
      {showVoiceInfo && (
        <div className="absolute top-5 right-5 z-20 max-w-[280px] bg-parchment-card border border-parchment-dark rounded-xl shadow-lg p-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-3">
            <Settings className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-ink-primary leading-relaxed">
                Voice capture needs a Whisper model to work offline.
              </p>
              <button
                onClick={() => setShowVoiceInfo(false)}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
              >
                Set up in Settings <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <button onClick={() => setShowVoiceInfo(false)} className="text-ink-light hover:text-ink-muted transition-colors flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Voice error toast */}
      {voiceError && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 bg-parchment-card border border-red-200 text-red-500 text-xs rounded-full px-4 py-2 shadow-sm animate-in fade-in duration-200">
          {voiceError}
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-16 pt-20 pb-32">

          {/* Date label — new mode only */}
          {mode === 'new' && (
            <p className="font-serif text-sm text-ink-light mb-12 select-none tracking-wide">
              {dateLabel}
            </p>
          )}

          {/* Editor or preview */}
          {viewMode === 'edit' || !canToggleView ? (
            <WritingCanvas
              ref={canvasRef}
              initialContent={content}
              onChange={handleChange}
              onCmdEnter={handleCmdEnter}
              onEscape={handleEscape}
              placeholderText={placeholderProp ?? defaultPlaceholder}
              autoFocus={mode === 'new'}
              settings={settings}
            />
          ) : (
            <MarkdownPreview content={content} />
          )}
        </div>
      </div>

      {/* Floating micro-toolbar */}
      <div className="sticky bottom-0 left-0 right-0 flex justify-center pb-7 pointer-events-none z-10 bg-gradient-to-t from-parchment-card via-parchment-card/80 to-transparent pt-8">
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
          {/* Waveform */}
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

          {/* Mic / Stop */}
          {showVoice && (
            <button
              onClick={handleVoiceClick}
              disabled={voiceState === 'stopping'}
              title={
                isListening ? 'Stop recording'
                : voiceConfigured ? 'Voice dictation'
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
          )}

          <div className="w-px h-3.5 bg-parchment-dark" />

          {/* Word count */}
          <span className="text-xs text-ink-light tabular-nums select-none">
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </span>

          {/* View toggle */}
          {canToggleView && (
            <>
              <div className="w-px h-3.5 bg-parchment-dark" />
              <button
                onClick={() => setViewMode(viewMode === 'edit' ? 'view' : 'edit')}
                title={viewMode === 'edit' ? 'Switch to reading view' : 'Switch to editing view'}
                className="text-ink-muted hover:text-accent transition-colors duration-150"
              >
                {viewMode === 'edit' ? <BookOpen className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
              </button>
            </>
          )}

          {/* AI Edit */}
          {showAiEdit && (
            <>
              <div className="w-px h-3.5 bg-parchment-dark" />
              <button
                onClick={() => { setWizardOpen(true); setWizardStep('select') }}
                disabled={aiLoading || isListening}
                title="AI Edit"
                className="flex items-center gap-1 text-xs text-ink-muted hover:text-accent disabled:text-ink-light disabled:cursor-not-allowed transition-colors duration-150 font-medium"
              >
                <Sparkles className="w-3.5 h-3.5" />
                AI Edit
              </button>
            </>
          )}

          {/* Editor Settings */}
          <div className="w-px h-3.5 bg-parchment-dark" />
          <button
            onClick={() => setSettingsOpen(true)}
            disabled={isListening}
            title="Editor Settings"
            className="text-ink-muted hover:text-accent disabled:text-ink-light disabled:cursor-not-allowed transition-colors duration-150"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-3.5 bg-parchment-dark" />

          {/* Save button (new mode) or status (edit mode) */}
          {mode === 'new' ? (
            <button
              onClick={handleNewSave}
              disabled={!content.trim() || isSaving || isListening}
              className="text-xs text-ink-muted hover:text-accent disabled:text-ink-light disabled:cursor-not-allowed transition-colors duration-150 font-medium tracking-wide"
            >
              {isSaving ? 'Saving…' : '⌘↵ Save'}
            </button>
          ) : (
            saveStatus !== 'idle' && (
              <span className={`text-xs font-medium transition-colors ${
                saveStatus === 'saving' ? 'text-ink-muted' : 'text-accent'
              }`}>
                {saveStatus === 'saving' ? 'Saving…' : '✓ Saved'}
              </span>
            )
          )}
        </div>
      </div>

      {/* AI Edit wizard modal */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => wizardStep === 'processing' ? setShowCancelConfirm(true) : resetWizard()}
          />
          <div className="relative bg-parchment-card border border-parchment-dark rounded-2xl shadow-xl w-full max-w-3xl mx-4 overflow-hidden">

            {/* Wizard header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-parchment-dark">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <span className="font-serif font-medium text-ink-primary">
                  {wizardStep === 'select' && 'AI Edit'}
                  {wizardStep === 'processing' && 'Processing…'}
                  {wizardStep === 'preview' && 'Review Changes'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {(['select', 'processing', 'preview'] as WizardStep[]).map((s) => (
                  <span key={s} className={`w-2 h-2 rounded-full ${wizardStep === s ? 'bg-accent' : 'bg-accent/30'}`} />
                ))}
              </div>
              <button
                onClick={() => wizardStep === 'processing' ? setShowCancelConfirm(true) : resetWizard()}
                disabled={wizardStep === 'processing'}
                className="text-ink-muted hover:text-ink-primary ml-2 disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step 1: Select */}
            {wizardStep === 'select' && (
              <div className="p-5">
                <p className="text-sm text-ink-muted mb-4">Choose a transformation and edit the prompt before sending:</p>
                <div className="flex gap-4">
                  <div className="w-48 flex-shrink-0 space-y-1">
                    {PRESET_ACTIONS.map((action) => (
                      <button
                        key={action.label}
                        onClick={() => { setSelectedAction(action); setCustomInstruction(action.instruction) }}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
                          selectedAction?.label === action.label
                            ? 'bg-accent/10 text-ink-primary border border-accent/30'
                            : 'text-ink-secondary hover:bg-parchment-dark hover:text-ink-primary'
                        }`}
                      >
                        {action.label}
                      </button>
                    ))}
                    <div className="border-t border-parchment-dark my-2 pt-1">
                      <button
                        onClick={() => { setSelectedAction(null); setCustomInstruction('') }}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
                          !selectedAction
                            ? 'bg-accent/10 text-ink-primary border border-accent/30'
                            : 'text-ink-secondary hover:bg-parchment-dark hover:text-ink-primary'
                        }`}
                      >
                        Custom…
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col">
                    <label className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-2">
                      Prompt (editable)
                    </label>
                    <textarea
                      value={customInstruction}
                      onChange={(e) => setCustomInstruction(e.target.value)}
                      placeholder="Select a transformation or type your custom instruction…"
                      rows={6}
                      className="flex-1 w-full px-3 py-2.5 rounded-lg bg-parchment border border-parchment-dark text-ink-primary text-sm leading-relaxed placeholder:text-ink-light resize-none focus:outline-none focus:border-accent/50"
                    />
                    <p className="text-xs text-ink-light mt-2">
                      {selectedAction ? `Based on: ${selectedAction.label}` : 'Custom instruction'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-5 mb-4">
                  <span className="text-sm text-ink-muted">Apply as:</span>
                  <div className="flex rounded-lg border border-parchment-dark overflow-hidden">
                    {(['replace', 'append'] as EditMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setEditMode(m)}
                        className={`px-3 py-1.5 text-sm capitalize transition-colors ${
                          editMode === m ? 'bg-accent text-white' : 'bg-parchment text-ink-secondary hover:text-ink-primary'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                {aiError && (
                  <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {aiError}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button onClick={resetWizard} className="px-4 py-2 rounded-lg text-sm text-ink-muted hover:text-ink-primary transition-colors">
                    Cancel
                  </button>
                  <button
                    disabled={!customInstruction.trim()}
                    onClick={runAiEdit}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-40 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Processing */}
            {wizardStep === 'processing' && (
              <div className="p-8 flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
                <p className="text-ink-secondary text-sm">AI is working on your text…</p>
                <p className="text-ink-light text-xs mt-1">This may take a few moments</p>
              </div>
            )}

            {/* Step 3: Preview */}
            {wizardStep === 'preview' && pendingEdit !== null && (
              <div className="p-5">
                <p className="text-sm text-ink-muted mb-3">
                  Review the {editMode === 'append' ? 'appended' : 'updated'} content before applying:
                </p>
                <div className="bg-parchment rounded-lg border border-parchment-dark p-4 max-h-80 overflow-y-auto mb-4">
                  <pre className="text-sm text-ink-secondary whitespace-pre-wrap font-sans leading-relaxed">
                    {pendingEdit}
                  </pre>
                  {editMode === 'append' && (
                    <div className="mt-4 pt-4 border-t border-parchment-dark">
                      <span className="text-xs text-accent font-medium">This will be appended to your document</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setWizardStep('select')} className="px-4 py-2 rounded-lg text-sm text-ink-muted hover:text-ink-primary transition-colors">
                    Back
                  </button>
                  <button onClick={resetWizard} className="px-4 py-2 rounded-lg text-sm text-ink-muted hover:text-ink-primary transition-colors">
                    Discard
                  </button>
                  <button
                    onClick={acceptEdit}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Apply {editMode === 'append' ? 'Append' : 'Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cancel AI processing confirmation */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCancelConfirm(false)} />
          <div className="relative bg-parchment-card border border-parchment-dark rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-ink-primary mb-1">Cancel processing?</h3>
                <p className="text-sm text-ink-secondary">
                  The AI is still working. Cancelling now means starting over.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCancelConfirm(false)} className="px-4 py-2 rounded-lg text-sm text-ink-muted hover:text-ink-primary transition-colors">
                Continue waiting
              </button>
              <button
                onClick={() => { setShowCancelConfirm(false); resetWizard() }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
              >
                Cancel anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Settings Modal */}
      <EditorSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdate={updateSettings}
        onReset={resetSettings}
      />
    </div>
  )
})
