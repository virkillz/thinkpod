import { useState, useEffect } from 'react'
import { Mic, Check, Loader2, ChevronRight, X } from 'lucide-react'

interface StepVoiceProps {
  onContinue: () => void
  onBack: () => void
  onSkip: () => void
}

type DownloadState = 'idle' | 'downloading' | 'done' | 'error'
type LanguageChoice = 'en' | 'auto'

// Models shown in the wizard (simple tier selection)
const TIER_MODELS = {
  en: [
    { name: 'small.en',  label: 'Fast',     description: 'Small — 466 MB', recommended: false },
    { name: 'large-v3-turbo', label: 'Accurate', description: 'Large Turbo — 805 MB', recommended: true },
  ],
  auto: [
    { name: 'small',     label: 'Fast',     description: 'Small — 466 MB', recommended: false },
    { name: 'large-v3-turbo', label: 'Accurate', description: 'Large Turbo — 805 MB', recommended: true },
  ],
}

export function StepVoice({ onContinue, onBack, onSkip }: StepVoiceProps) {
  const [language, setLanguage] = useState<LanguageChoice>('en')
  const [selectedModel, setSelectedModel] = useState<string>('large-v3-turbo')
  const [downloadState, setDownloadState] = useState<DownloadState>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Keep selected model valid when language changes
  useEffect(() => {
    const models = TIER_MODELS[language]
    if (!models.find(m => m.name === selectedModel)) {
      setSelectedModel(models.find(m => m.recommended)?.name ?? models[0].name)
    }
  }, [language, selectedModel])

  // Listen for download progress push events
  useEffect(() => {
    const cleanup = window.electronAPI.onVoiceDownloadProgress(({ modelName, progress: p }) => {
      if (modelName === selectedModel) {
        setProgress(p)
      }
    })
    return cleanup
  }, [selectedModel])

  const handleDownload = async () => {
    setDownloadState('downloading')
    setProgress(0)
    setError(null)

    const result = await window.electronAPI.downloadWhisperModel(selectedModel)

    if (result.success) {
      await window.electronAPI.setWhisperConfig({ modelName: selectedModel, language })
      setDownloadState('done')
    } else if (result.cancelled) {
      setDownloadState('idle')
      setProgress(0)
    } else {
      setDownloadState('error')
      setError(result.error ?? 'Download failed')
    }
  }

  const handleCancel = async () => {
    await window.electronAPI.cancelWhisperDownload()
    setDownloadState('idle')
    setProgress(0)
  }

  const models = TIER_MODELS[language]

  return (
    <div className="flex flex-col h-full">
      <div className="mb-8">
        <div className="text-sm text-ink-muted mb-1">Step 4 of 4</div>
        <h2 className="text-2xl font-serif font-medium text-ink-primary">
          Set Up Voice Capture
        </h2>
      </div>

      <p className="text-ink-muted mb-8">
        Dictate notes with your voice. Transcription runs entirely offline on your device
        — nothing leaves your machine.
      </p>

      {/* Language choice */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-ink-primary mb-3">Language</label>
        <div className="flex gap-3">
          {(['en', 'auto'] as LanguageChoice[]).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                language === lang
                  ? 'border-accent bg-accent/5 text-accent'
                  : 'border-parchment-dark text-ink-muted hover:border-ink-muted'
              }`}
            >
              {lang === 'en' ? 'English only' : 'Multilingual'}
              {lang === 'en' && (
                <span className="block text-xs font-normal mt-0.5 text-ink-muted">faster & more accurate</span>
              )}
              {lang === 'auto' && (
                <span className="block text-xs font-normal mt-0.5 text-ink-muted">auto-detect language</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Model tier picker */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-ink-primary mb-3">Model</label>
        <div className="flex gap-3">
          {models.map((m) => (
            <button
              key={m.name}
              onClick={() => setSelectedModel(m.name)}
              disabled={downloadState === 'downloading' || downloadState === 'done'}
              className={`flex-1 px-4 py-3 rounded-lg border text-sm transition-colors text-left relative ${
                selectedModel === m.name
                  ? 'border-accent bg-accent/5'
                  : 'border-parchment-dark hover:border-ink-muted'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {m.recommended && (
                <span className="absolute top-2 right-2 text-[10px] font-medium bg-accent text-white px-1.5 py-0.5 rounded-full">
                  recommended
                </span>
              )}
              <span className={`font-medium block mb-0.5 ${selectedModel === m.name ? 'text-accent' : 'text-ink-primary'}`}>
                {m.label}
              </span>
              <span className="text-xs text-ink-muted">{m.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Download area */}
      <div className="mb-8">
        {downloadState === 'idle' && (
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors"
          >
            <Mic className="w-4 h-4" />
            Download Model
          </button>
        )}

        {downloadState === 'downloading' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-ink-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
                Downloading…
              </span>
              <span className="text-ink-muted">{progress}%</span>
            </div>
            <div className="h-2 bg-parchment-dark rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <button
              onClick={handleCancel}
              className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink-primary transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          </div>
        )}

        {downloadState === 'done' && (
          <div className="flex items-center gap-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <Check className="w-4 h-4" />
            Model ready — voice capture is enabled
          </div>
        )}

        {downloadState === 'error' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <X className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
            <button
              onClick={handleDownload}
              className="text-sm text-accent hover:underline"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-auto flex items-center justify-between">
        <button
          onClick={onBack}
          disabled={downloadState === 'downloading'}
          className="px-6 py-2 text-ink-muted hover:text-ink-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Back
        </button>

        <div className="flex items-center gap-4">
          {downloadState !== 'done' && (
            <button
              onClick={onSkip}
              disabled={downloadState === 'downloading'}
              className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Skip for now
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
          {downloadState === 'done' && (
            <button
              onClick={onContinue}
              className="px-8 py-3 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors"
            >
              Finish
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
