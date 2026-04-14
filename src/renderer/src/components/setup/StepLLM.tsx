import { useState, useEffect, useRef } from 'react'
import { Check, X, Loader2, Download, Cpu, Globe, Zap } from 'lucide-react'
import type { LLMProfile } from '../../store/appStore.js'

interface StepLLMProps {
  onContinue: (profile: LLMProfile) => void
  onBack: () => void
}

type Mode = 'builtin' | 'external'
type BuiltinBackend = 'gguf' | 'mlx'
type DownloadStatus = 'idle' | 'downloading' | 'done' | 'error'
type TestStatus = 'idle' | 'testing' | 'success' | 'error'

// ── GGUF quant options (llama.cpp backend) ────────────────────────────────────

const QUANT_OPTIONS = [
  { quant: 'Q3_K_M', label: 'Light',    description: 'Smaller and faster',          detail: 'Good for 8 GB RAM',          sizeMb: 1400 },
  { quant: 'Q4_K_M', label: 'Balanced', description: 'Best quality-to-size ratio',  detail: 'Recommended — works on most Macs', sizeMb: 1800 },
  { quant: 'Q5_K_M', label: 'Quality',  description: 'Higher output quality',        detail: 'Needs 16 GB RAM or more',     sizeMb: 2100 },
]

// ── MLX model presets (Apple Silicon only) ────────────────────────────────────

const MLX_PRESETS = [
  {
    hfRepo: 'mlx-community/gemma-3n-E2B-it-lm-4bit',
    label: 'Fast',
    description: 'Gemma 3n E2B — ~1 GB',
    detail: 'Entry-level Macs · ~2B effective params',
  },
  {
    hfRepo: 'mlx-community/gemma-3n-E4B-it-lm-4bit',
    label: 'Balanced',
    description: 'Gemma 3n E4B — ~2 GB',
    detail: 'Recommended default · ~4B effective params',
    recommended: true,
  },
  {
    hfRepo: 'mlx-community/gemma-3n-E4B-it-lm-bf16',
    label: 'Quality',
    description: 'Gemma 3n E4B bf16 — ~8 GB',
    detail: '16 GB+ unified memory only',
  },
]

function formatMb(mb: number): string {
  return mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${mb} MB`
}

export function StepLLM({ onContinue, onBack }: StepLLMProps) {
  const [mode, setMode] = useState<Mode>('builtin')

  // Platform
  const [isAppleSilicon, setIsAppleSilicon] = useState(false)

  // Built-in shared
  const [builtinBackend, setBuiltinBackend] = useState<BuiltinBackend>('gguf')

  // GGUF state
  const [selectedQuant, setSelectedQuant] = useState('Q4_K_M')
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle')
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloadedModels, setDownloadedModels] = useState<string[]>([])
  const [loadingInfo, setLoadingInfo] = useState(true)

  // MLX state
  const [selectedMlxRepo, setSelectedMlxRepo] = useState(MLX_PRESETS[1].hfRepo)
  const [customMlxRepo, setCustomMlxRepo] = useState('')
  const [mlxDownloadStatus, setMlxDownloadStatus] = useState<DownloadStatus>('idle')
  const [mlxDownloadError, setMlxDownloadError] = useState<string | null>(null)

  // External state
  const [baseUrl, setBaseUrl] = useState('http://localhost:8000/v1')
  const [model, setModel] = useState('gemma-4-e4b-it')
  const [apiKey, setApiKey] = useState('')
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testError, setTestError] = useState<string | null>(null)
  const [testedConfig, setTestedConfig] = useState<{ baseUrl: string; model: string } | null>(null)

  const unsubRef = useRef<(() => void) | null>(null)
  const mlxUnsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    window.electronAPI.getLLMModelInfo().then((info) => {
      setDownloadedModels(info.downloaded)
      if (info.config?.quant) setSelectedQuant(info.config.quant)
      setIsAppleSilicon(info.isAppleSilicon)
      // Default to MLX on Apple Silicon
      if (info.isAppleSilicon) setBuiltinBackend('mlx')
      setLoadingInfo(false)
    })

    const mlxUnsub = window.electronAPI.onLLMMlxDownloadProgress(({ status }) => {
      if (status === 'done') setMlxDownloadStatus('done')
      else if (status === 'error') setMlxDownloadStatus('error')
    })
    mlxUnsubRef.current = mlxUnsub

    return () => {
      unsubRef.current?.()
      mlxUnsubRef.current?.()
    }
  }, [])

  // Re-subscribe GGUF progress when selectedQuant changes
  useEffect(() => {
    unsubRef.current?.()
    const unsub = window.electronAPI.onLLMDownloadProgress(({ quant, progress }) => {
      if (quant === selectedQuant) {
        setDownloadProgress(progress)
        if (progress >= 100) {
          setDownloadStatus('done')
          setDownloadedModels((prev) => (prev.includes(quant) ? prev : [...prev, quant]))
        }
      }
    })
    unsubRef.current = unsub
    return () => unsub()
  }, [selectedQuant])

  // ── GGUF actions ────────────────────────────────────────────────────────────

  const handleDownload = async () => {
    setDownloadStatus('downloading')
    setDownloadProgress(0)
    setDownloadError(null)
    const result = await window.electronAPI.downloadLLMModel(selectedQuant)
    if (result.alreadyExists) {
      setDownloadStatus('done')
      setDownloadedModels((prev) => (prev.includes(selectedQuant) ? prev : [...prev, selectedQuant]))
    } else if (!result.success && !result.cancelled) {
      setDownloadStatus('error')
      setDownloadError(result.error ?? 'Download failed')
    }
  }

  const handleCancelDownload = async () => {
    await window.electronAPI.cancelLLMModelDownload()
    setDownloadStatus('idle')
    setDownloadProgress(0)
  }

  // ── MLX actions ─────────────────────────────────────────────────────────────

  const effectiveMlxRepo = customMlxRepo.trim() || selectedMlxRepo

  const handleMlxDownload = async () => {
    setMlxDownloadStatus('downloading')
    setMlxDownloadError(null)
    const result = await window.electronAPI.downloadMLXModel(effectiveMlxRepo)
    if (!result.success) {
      setMlxDownloadStatus('error')
      setMlxDownloadError(result.error ?? 'Download failed')
    }
  }

  // ── External actions ────────────────────────────────────────────────────────

  const handleTestConnection = async () => {
    setTestStatus('testing')
    setTestError(null)
    try {
      const result = await window.electronAPI.testLLMConnection({ baseUrl, model, apiKey: apiKey || undefined })
      if (result.success) {
        setTestStatus('success')
        setTestedConfig({ baseUrl, model })
      } else {
        setTestStatus('error')
        setTestError(result.error ?? 'Connection failed')
      }
    } catch (err) {
      setTestStatus('error')
      setTestError((err as Error).message)
    }
  }

  // ── Continue ────────────────────────────────────────────────────────────────

  const handleContinue = () => {
    if (mode === 'builtin') {
      if (builtinBackend === 'mlx') {
        onContinue({
          id: crypto.randomUUID(),
          name: 'Built-in (MLX)',
          provider: 'builtin',
          builtinBackend: 'mlx',
          builtinHfRepo: effectiveMlxRepo,
          baseUrl: '',
          model: effectiveMlxRepo.split('/').pop() ?? 'gemma-3n-mlx',
          apiKey: '',
        })
      } else {
        onContinue({
          id: crypto.randomUUID(),
          name: 'Built-in',
          provider: 'builtin',
          builtinBackend: 'gguf',
          builtinQuant: selectedQuant,
          baseUrl: '',
          model: 'gemma-4-e4b-builtin',
          apiKey: '',
        })
      }
    } else {
      const provider =
        baseUrl.includes('localhost:11434') ? 'ollama' :
        baseUrl.includes('localhost:1234') ? 'lmstudio' :
        baseUrl.includes('api.openai.com') ? 'openai' :
        baseUrl.includes('api.groq.com') ? 'groq' : 'custom'
      onContinue({
        id: crypto.randomUUID(),
        name: provider === 'ollama' ? 'Ollama' : provider === 'lmstudio' ? 'LM Studio' :
              provider === 'openai' ? 'OpenAI' : provider === 'groq' ? 'Groq' : 'External',
        provider,
        baseUrl,
        model,
        apiKey,
      })
    }
  }

  const isGgufReady = downloadedModels.includes(selectedQuant) || downloadStatus === 'done'
  const isMlxReady = mlxDownloadStatus === 'done'
  const isConfigChanged = testedConfig?.baseUrl !== baseUrl || testedConfig?.model !== model
  const canContinue =
    mode === 'external'
      ? testStatus === 'success' && !isConfigChanged
      : builtinBackend === 'mlx'
      ? isMlxReady
      : isGgufReady

  const handleExternalInputChange = (setter: (v: string) => void, value: string) => {
    setter(value)
    if (testedConfig) { setTestedConfig(null); setTestStatus('idle') }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-8">
        <div className="text-sm text-ink-muted mb-1">Step 3 of 4</div>
        <h2 className="text-2xl font-serif font-medium text-ink-primary">
          Set up Wilfred's brain
        </h2>
      </div>

      <p className="text-ink-muted mb-6">
        Wilfred needs a language model to think. You can download one locally or connect to any
        OpenAI-compatible service.
      </p>

      {/* Mode picker */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => setMode('builtin')}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            mode === 'builtin' ? 'border-accent bg-accent/5' : 'border-parchment-dark hover:border-ink-muted'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Cpu className={`w-4 h-4 ${mode === 'builtin' ? 'text-accent' : 'text-ink-muted'}`} />
            <span className={`font-medium text-sm ${mode === 'builtin' ? 'text-ink-primary' : 'text-ink-muted'}`}>
              Built-in
            </span>
            {mode === 'builtin' && (
              <span className="ml-auto text-xs bg-accent text-white px-2 py-0.5 rounded-full">Selected</span>
            )}
          </div>
          <p className="text-xs text-ink-muted leading-snug">
            Download Gemma and run it locally. No internet needed after download.
          </p>
        </button>

        <button
          onClick={() => setMode('external')}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            mode === 'external' ? 'border-accent bg-accent/5' : 'border-parchment-dark hover:border-ink-muted'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Globe className={`w-4 h-4 ${mode === 'external' ? 'text-accent' : 'text-ink-muted'}`} />
            <span className={`font-medium text-sm ${mode === 'external' ? 'text-ink-primary' : 'text-ink-muted'}`}>
              External API
            </span>
            {mode === 'external' && (
              <span className="ml-auto text-xs bg-accent text-white px-2 py-0.5 rounded-full">Selected</span>
            )}
          </div>
          <p className="text-xs text-ink-muted leading-snug">
            Connect to Ollama, LM Studio, OpenAI, Groq, or any OpenAI-compatible endpoint.
          </p>
        </button>
      </div>

      {/* Built-in panel */}
      {mode === 'builtin' && (
        <div className="flex-1 flex flex-col">
          {loadingInfo ? (
            <div className="flex items-center gap-2 text-ink-muted text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking downloaded models…
            </div>
          ) : (
            <>
              {/* Backend selector — shown only on Apple Silicon */}
              {isAppleSilicon && (
                <div className="mb-5">
                  <div className="text-xs font-medium text-ink-muted mb-2">Inference backend</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setBuiltinBackend('mlx')}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        builtinBackend === 'mlx'
                          ? 'border-accent bg-accent/5'
                          : 'border-parchment-dark hover:border-ink-muted'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Zap className={`w-3.5 h-3.5 ${builtinBackend === 'mlx' ? 'text-accent' : 'text-ink-muted'}`} />
                        <span className={`text-sm font-medium ${builtinBackend === 'mlx' ? 'text-ink-primary' : 'text-ink-muted'}`}>
                          MLX
                        </span>
                        <span className="ml-auto text-xs bg-green-500/15 text-green-600 px-1.5 py-0.5 rounded">
                          Recommended
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted">2-3× faster on Apple Silicon</p>
                    </button>
                    <button
                      onClick={() => setBuiltinBackend('gguf')}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        builtinBackend === 'gguf'
                          ? 'border-accent bg-accent/5'
                          : 'border-parchment-dark hover:border-ink-muted'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Cpu className={`w-3.5 h-3.5 ${builtinBackend === 'gguf' ? 'text-accent' : 'text-ink-muted'}`} />
                        <span className={`text-sm font-medium ${builtinBackend === 'gguf' ? 'text-ink-primary' : 'text-ink-muted'}`}>
                          GGUF
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted">llama.cpp — cross-platform</p>
                    </button>
                  </div>
                </div>
              )}

              {/* MLX model picker */}
              {builtinBackend === 'mlx' && (
                <div className="flex-1 flex flex-col">
                  <div className="space-y-2 mb-4">
                    {MLX_PRESETS.map((preset) => {
                      const isSelected = selectedMlxRepo === preset.hfRepo && !customMlxRepo.trim()
                      return (
                        <button
                          key={preset.hfRepo}
                          onClick={() => { setSelectedMlxRepo(preset.hfRepo); setCustomMlxRepo('') }}
                          className={`w-full p-3 rounded-lg border text-left transition-all ${
                            isSelected ? 'border-accent bg-accent/5' : 'border-parchment-dark hover:border-ink-muted'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${
                              isSelected ? 'border-accent bg-accent' : 'border-ink-muted'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-ink-primary">{preset.label}</span>
                                <span className="text-xs text-ink-muted">— {preset.description}</span>
                                {preset.recommended && (
                                  <span className="ml-auto text-xs bg-accent/15 text-accent px-1.5 py-0.5 rounded">
                                    Default
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-ink-muted mt-0.5">{preset.detail}</div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {/* Custom model input */}
                  <div className="mb-4">
                    <label className="block text-xs text-ink-muted mb-1">Custom model (advanced)</label>
                    <input
                      type="text"
                      value={customMlxRepo}
                      onChange={(e) => setCustomMlxRepo(e.target.value)}
                      placeholder="mlx-community/your-model"
                      className="w-full px-3 py-2 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent text-ink-primary text-sm"
                    />
                  </div>

                  {/* MLX download area */}
                  {mlxDownloadStatus === 'done' ? (
                    <div className="flex items-center gap-2 text-sm text-success">
                      <Check className="w-4 h-4" />
                      Model cached — Wilfred will load it on first chat.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {mlxDownloadStatus === 'downloading' ? (
                        <div className="flex items-center gap-2 text-sm text-ink-muted">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Downloading model from Hugging Face…
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={handleMlxDownload}
                            disabled={!effectiveMlxRepo}
                            className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:bg-ink-light disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            Pre-download model
                          </button>
                          <span className="text-xs text-ink-muted">
                            or skip — downloads on first use
                          </span>
                        </div>
                      )}
                      {mlxDownloadStatus === 'error' && mlxDownloadError && (
                        <span className="text-sm text-error flex items-center gap-1">
                          <X className="w-3 h-3" /> {mlxDownloadError}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* GGUF quant picker */}
              {builtinBackend === 'gguf' && (
                <div className="flex-1 flex flex-col">
                  <div className="space-y-2 mb-6">
                    {QUANT_OPTIONS.map((opt) => {
                      const downloaded = downloadedModels.includes(opt.quant)
                      const isSelected = selectedQuant === opt.quant
                      return (
                        <button
                          key={opt.quant}
                          onClick={() => { setSelectedQuant(opt.quant); setDownloadStatus('idle'); setDownloadError(null) }}
                          disabled={downloadStatus === 'downloading'}
                          className={`w-full p-3 rounded-lg border text-left transition-all ${
                            isSelected ? 'border-accent bg-accent/5' : 'border-parchment-dark hover:border-ink-muted'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${
                              isSelected ? 'border-accent bg-accent' : 'border-ink-muted'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-ink-primary">{opt.label}</span>
                                <span className="text-xs text-ink-muted">— {opt.description}</span>
                                {downloaded && (
                                  <span className="ml-auto flex items-center gap-1 text-xs text-success">
                                    <Check className="w-3 h-3" /> Downloaded
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-ink-muted mt-0.5">
                                {opt.detail} · {formatMb(opt.sizeMb)}
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {!isGgufReady ? (
                    <div className="space-y-3">
                      {downloadStatus === 'downloading' ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm text-ink-muted">
                            <span>Downloading {QUANT_OPTIONS.find((o) => o.quant === selectedQuant)?.label}…</span>
                            <span>{downloadProgress}%</span>
                          </div>
                          <div className="h-2 bg-parchment-dark rounded-full overflow-hidden">
                            <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${downloadProgress}%` }} />
                          </div>
                          <button onClick={handleCancelDownload} className="text-sm text-ink-muted hover:text-error transition-colors">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={handleDownload}
                            className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium text-sm transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            Download {formatMb(QUANT_OPTIONS.find((o) => o.quant === selectedQuant)?.sizeMb ?? 0)}
                          </button>
                          {downloadStatus === 'error' && downloadError && (
                            <span className="text-sm text-error flex items-center gap-1">
                              <X className="w-3 h-3" /> {downloadError}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-success">
                      <Check className="w-4 h-4" />
                      Model ready — Wilfred will load it on first chat.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* External API panel */}
      {mode === 'external' && (
        <div className="flex-1 flex flex-col">
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-ink-primary mb-1.5">Base URL</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => handleExternalInputChange(setBaseUrl, e.target.value)}
                className="w-full px-4 py-2.5 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent text-ink-primary text-sm"
                placeholder="http://localhost:8000/v1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-primary mb-1.5">Model name</label>
              <input
                type="text"
                value={model}
                onChange={(e) => handleExternalInputChange(setModel, e.target.value)}
                className="w-full px-4 py-2.5 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent text-ink-primary text-sm"
                placeholder="gemma-4-e4b-it"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-primary mb-1.5">
                API key <span className="text-ink-muted font-normal">(optional)</span>
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => handleExternalInputChange(setApiKey, e.target.value)}
                className="w-full px-4 py-2.5 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent text-ink-primary text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleTestConnection}
              disabled={testStatus === 'testing' || !baseUrl || !model}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                testStatus === 'success' && !isConfigChanged
                  ? 'bg-success text-white'
                  : testStatus === 'error'
                  ? 'bg-error text-white'
                  : 'border border-accent text-accent hover:bg-accent hover:text-white disabled:bg-parchment-dark disabled:text-ink-muted disabled:border-transparent'
              }`}
            >
              {testStatus === 'testing' && <Loader2 className="w-4 h-4 animate-spin" />}
              {testStatus === 'success' && !isConfigChanged && <Check className="w-4 h-4" />}
              {testStatus === 'error' && <X className="w-4 h-4" />}
              {testStatus === 'testing' ? 'Testing…'
                : testStatus === 'success' && !isConfigChanged ? 'Connected'
                : testStatus === 'error' ? 'Failed — retry'
                : 'Test connection'}
            </button>
            {testError && <span className="text-sm text-error">{testError}</span>}
          </div>
        </div>
      )}

      {/* MLX skip note */}
      {mode === 'builtin' && builtinBackend === 'mlx' && mlxDownloadStatus !== 'done' && (
        <p className="text-xs text-ink-muted mt-3">
          You can skip the pre-download — the model will be fetched from Hugging Face on first use.
        </p>
      )}

      {/* Actions */}
      <div className="mt-auto pt-6 flex items-center justify-between">
        <button onClick={onBack} className="px-6 py-2 text-ink-muted hover:text-ink-primary transition-colors">
          ← Back
        </button>
        <button
          onClick={handleContinue}
          disabled={mode === 'builtin' && builtinBackend !== 'mlx' && !canContinue}
          className="px-8 py-3 bg-accent hover:bg-accent-hover disabled:bg-ink-light disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
