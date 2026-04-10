import { useState, useEffect } from 'react'
import { Settings, Folder, Key, Check, X, Loader2, Save, AlertTriangle, Trash2, Mic, Download, Wrench, Zap, Palette } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'
import type { ThemeId } from '../../store/appStore.js'

type TestStatus = 'idle' | 'testing' | 'success' | 'error'
type VoiceDownloadState = 'idle' | 'downloading' | 'error'
type VoiceConfig = { modelName: string; language: 'en' | 'auto' }
type SettingsTab = 'general' | 'appearance' | 'inference' | 'voice' | 'advanced'

const VOICE_TIER_MODELS = [
  { name: 'small.en',       label: 'Fast · English',         sizeMb: 466  },
  { name: 'small',          label: 'Fast · Multilingual',    sizeMb: 466  },
  { name: 'large-v3-turbo', label: 'Accurate (recommended)', sizeMb: 805  },
  { name: 'medium.en',      label: 'Medium · English',       sizeMb: 1533 },
  { name: 'medium',         label: 'Medium · Multilingual',  sizeMb: 1533 },
  { name: 'large-v3',       label: 'Large v3',               sizeMb: 3094 },
]

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: 'general',    label: 'General',    icon: Folder  },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'inference',  label: 'Inference',  icon: Zap     },
  { id: 'voice',      label: 'Voice',      icon: Mic     },
  { id: 'advanced',   label: 'Advanced',   icon: Wrench  },
]

// ─── Theme definitions (UI metadata) ─────────────────────────────────────────

const THEMES: {
  id: ThemeId
  name: string
  description: string
  swatches: string[]
  dark: boolean
}[] = [
  {
    id: 'parchment',
    name: 'Parchment',
    description: 'Warm amber & serif — the classic scriptorium look',
    swatches: ['#F5F0E8', '#EDE8DC', '#8B6914', '#1C1917'],
    dark: false,
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep indigo with a crisp sans-serif',
    swatches: ['#1A1B2E', '#22243A', '#818CF8', '#E2E8F0'],
    dark: true,
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Mossy greens with a warm editor font',
    swatches: ['#1C2616', '#243020', '#6DB33F', '#D4E6B5'],
    dark: true,
  },
  {
    id: 'slate',
    name: 'Slate',
    description: 'Clean cool-gray with blue accents',
    swatches: ['#F8FAFC', '#F1F5F9', '#3B82F6', '#0F172A'],
    dark: false,
  },
  {
    id: 'rose',
    name: 'Rose',
    description: 'Soft pink warmth with a classic serif',
    swatches: ['#FFF1F2', '#FFE4E6', '#E11D48', '#1C0A0B'],
    dark: false,
  },
]

// ─── Appearance Tab ───────────────────────────────────────────────────────────

function AppearanceTab() {
  const { theme, setTheme } = useAppStore()

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <section>
        <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">Theme</h3>
        <div className="grid grid-cols-1 gap-3">
          {THEMES.map((t) => {
            const active = theme === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                  active
                    ? 'border-accent bg-accent/5'
                    : 'border-parchment-dark bg-parchment-card hover:border-ink-light'
                }`}
              >
                {/* Swatches */}
                <div className="flex gap-1 flex-shrink-0">
                  {t.swatches.map((color, i) => (
                    <span
                      key={i}
                      className="w-6 h-6 rounded-full border border-black/10 flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-ink-primary">{t.name}</span>
                    {t.dark && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-ink-light/20 text-ink-muted">Dark</span>
                    )}
                  </div>
                  <p className="text-xs text-ink-muted mt-0.5">{t.description}</p>
                </div>

                {/* Selected indicator */}
                {active && <Check className="w-4 h-4 text-accent flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}

// ─── General Tab ──────────────────────────────────────────────────────────────

function GeneralTab() {
  const { abbey, showSystemFolders, setShowSystemFolders } = useAppStore()

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <section>
        <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">Abbey</h3>
        <div className="bg-parchment-card rounded-xl p-6 border border-parchment-dark">
          <div className="flex items-center gap-3 mb-4">
            <Folder className="w-5 h-5 text-accent" />
            <span className="font-medium text-ink-primary">Vault Path</span>
          </div>
          <div className="bg-parchment-sidebar rounded-lg px-4 py-3 font-mono text-sm text-ink-primary break-all">
            {abbey?.path || 'No workspace configured'}
          </div>
          <p className="text-sm text-ink-muted mt-3">
            All your notes are stored here as plain markdown files.
          </p>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">Notes</h3>
        <div className="bg-parchment-card rounded-xl p-6 border border-parchment-dark">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="font-medium text-ink-primary text-sm">Show system folders</span>
              <p className="text-xs text-ink-muted mt-0.5">
                Display _inbox, _drafts, and .scriptorium in the file tree
              </p>
            </div>
            <button
              role="switch"
              aria-checked={showSystemFolders}
              onClick={() => setShowSystemFolders(!showSystemFolders)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                showSystemFolders ? 'bg-accent' : 'bg-ink-light'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                  showSystemFolders ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </label>
        </div>
      </section>
    </div>
  )
}

// ─── Inference Tab ────────────────────────────────────────────────────────────

function InferenceTab() {
  const { llmConfig, setLLMConfig } = useAppStore()

  const [baseUrl, setBaseUrl] = useState(llmConfig.baseUrl)
  const [model, setModel] = useState(llmConfig.model)
  const [apiKey, setApiKey] = useState(llmConfig.apiKey)
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testError, setTestError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle')

  const handleInputChange = (setter: (v: string) => void, value: string) => {
    setter(value)
    setTestStatus('idle')
    setTestError(null)
    setSaveStatus('idle')
  }

  const handleTest = async () => {
    setTestStatus('testing')
    setTestError(null)
    try {
      const result = await window.electronAPI.testLLMConnection({ baseUrl, model, apiKey: apiKey || undefined })
      if (result.success) {
        setTestStatus('success')
      } else {
        setTestStatus('error')
        setTestError(result.error || 'Connection failed')
      }
    } catch (err) {
      setTestStatus('error')
      setTestError((err as Error).message)
    }
  }

  const handleSave = async () => {
    const config = { baseUrl, model, apiKey }
    setLLMConfig(config)
    await window.electronAPI.setSetting('llmConfig', config)
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-parchment-card rounded-xl p-6 border border-parchment-dark space-y-6">
        <div>
          <label className="block text-sm font-medium text-ink-primary mb-2">Base URL</label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => handleInputChange(setBaseUrl, e.target.value)}
            className="w-full px-4 py-3 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-primary mb-2">Model Name</label>
          <input
            type="text"
            value={model}
            onChange={(e) => handleInputChange(setModel, e.target.value)}
            className="w-full px-4 py-3 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-ink-primary mb-2">
            <Key className="w-4 h-4" />
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => handleInputChange(setApiKey, e.target.value)}
            placeholder="Optional — for cloud providers"
            className="w-full px-4 py-3 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-parchment-dark">
          <button
            onClick={handleTest}
            disabled={testStatus === 'testing' || !baseUrl || !model}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed ${
              testStatus === 'success'
                ? 'bg-green-600 text-white'
                : testStatus === 'error'
                ? 'bg-red-600 text-white'
                : 'border border-accent text-accent hover:bg-accent hover:text-white disabled:border-parchment-dark disabled:text-ink-muted'
            }`}
          >
            {testStatus === 'testing' && <Loader2 className="w-4 h-4 animate-spin" />}
            {testStatus === 'success' && <Check className="w-4 h-4" />}
            {testStatus === 'error' && <X className="w-4 h-4" />}
            {testStatus === 'testing' ? 'Testing…' : testStatus === 'success' ? 'Connected' : testStatus === 'error' ? 'Failed' : 'Test Connection'}
          </button>

          <button
            onClick={handleSave}
            disabled={!baseUrl || !model}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:bg-ink-light disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            {saveStatus === 'saved' ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saveStatus === 'saved' ? 'Saved' : 'Save'}
          </button>

          {testError && <span className="text-sm text-red-600">{testError}</span>}
        </div>
      </div>
    </div>
  )
}

// ─── Voice Tab ────────────────────────────────────────────────────────────────

function VoiceTab() {
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig | null>(null)
  const [voiceShowPicker, setVoiceShowPicker] = useState(false)
  const [voicePickerModel, setVoicePickerModel] = useState('large-v3-turbo')
  const [voicePickerLang, setVoicePickerLang] = useState<'en' | 'auto'>('en')
  const [voiceDownloadState, setVoiceDownloadState] = useState<VoiceDownloadState>('idle')
  const [voiceProgress, setVoiceProgress] = useState(0)
  const [voiceError, setVoiceError] = useState<string | null>(null)

  useEffect(() => {
    window.electronAPI.getWhisperConfig().then(({ config }) => {
      setVoiceConfig(config)
    })
  }, [])

  useEffect(() => {
    const cleanup = window.electronAPI.onVoiceDownloadProgress(({ modelName, progress }) => {
      if (modelName === voicePickerModel) setVoiceProgress(progress)
    })
    return cleanup
  }, [voicePickerModel])

  const handleVoiceDownload = async () => {
    setVoiceDownloadState('downloading')
    setVoiceProgress(0)
    setVoiceError(null)

    const result = await window.electronAPI.downloadWhisperModel(voicePickerModel)
    if (result.success) {
      const newConfig: VoiceConfig = { modelName: voicePickerModel, language: voicePickerLang }
      await window.electronAPI.setWhisperConfig(newConfig)
      setVoiceConfig(newConfig)
      setVoiceDownloadState('idle')
      setVoiceShowPicker(false)
    } else if (!result.cancelled) {
      setVoiceDownloadState('error')
      setVoiceError(result.error ?? 'Download failed')
    } else {
      setVoiceDownloadState('idle')
    }
  }

  const handleVoiceCancelDownload = async () => {
    await window.electronAPI.cancelWhisperDownload()
    setVoiceDownloadState('idle')
    setVoiceProgress(0)
  }

  const handleVoiceRemove = async () => {
    if (!voiceConfig) return
    await window.electronAPI.deleteWhisperModel(voiceConfig.modelName)
    setVoiceConfig(null)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-parchment-card rounded-xl p-6 border border-parchment-dark space-y-4">
        {voiceConfig && !voiceShowPicker && (
          <div className="flex items-center gap-3">
            <Mic className="w-5 h-5 text-accent flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-medium text-ink-primary text-sm block">
                {VOICE_TIER_MODELS.find(m => m.name === voiceConfig.modelName)?.label ?? voiceConfig.modelName}
              </span>
              <span className="text-xs text-ink-muted">
                Language: {voiceConfig.language === 'en' ? 'English only' : 'Auto-detect'}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => { setVoicePickerModel(voiceConfig.modelName); setVoicePickerLang(voiceConfig.language); setVoiceShowPicker(true) }}
                className="px-3 py-1.5 border border-accent text-accent hover:bg-accent hover:text-white rounded-lg text-xs font-medium transition-colors"
              >
                Change
              </button>
              <button
                onClick={handleVoiceRemove}
                className="px-3 py-1.5 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        )}

        {!voiceConfig && !voiceShowPicker && (
          <>
            <p className="text-sm text-ink-muted">
              Voice capture lets you dictate drafts offline using Whisper.
              Download a model to enable it.
            </p>
            <button
              onClick={() => setVoiceShowPicker(true)}
              className="flex items-center gap-2 px-4 py-2 border border-accent text-accent hover:bg-accent hover:text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Set Up Voice
            </button>
          </>
        )}

        {voiceShowPicker && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink-primary mb-2">Language</label>
              <div className="flex gap-2">
                {(['en', 'auto'] as const).map(lang => (
                  <button
                    key={lang}
                    onClick={() => setVoicePickerLang(lang)}
                    disabled={voiceDownloadState === 'downloading'}
                    className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 ${
                      voicePickerLang === lang
                        ? 'border-accent bg-accent/5 text-accent'
                        : 'border-parchment-dark text-ink-muted hover:border-ink-muted'
                    }`}
                  >
                    {lang === 'en' ? 'English only' : 'Multilingual'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-primary mb-2">Model</label>
              <select
                value={voicePickerModel}
                onChange={e => setVoicePickerModel(e.target.value)}
                disabled={voiceDownloadState === 'downloading'}
                className="w-full px-3 py-2 bg-parchment-base border border-parchment-dark rounded-lg text-sm text-ink-primary focus:outline-none focus:border-accent disabled:opacity-50"
              >
                {VOICE_TIER_MODELS.map(m => (
                  <option key={m.name} value={m.name}>
                    {m.label} — {m.sizeMb >= 1000 ? `${(m.sizeMb / 1000).toFixed(1)} GB` : `${m.sizeMb} MB`}
                  </option>
                ))}
              </select>
            </div>

            {voiceDownloadState === 'idle' && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleVoiceDownload}
                  className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={() => { setVoiceShowPicker(false); setVoiceError(null) }}
                  className="px-4 py-2 text-ink-muted hover:text-ink-primary text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {voiceDownloadState === 'downloading' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-ink-muted">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Downloading…
                  </span>
                  <span>{voiceProgress}%</span>
                </div>
                <div className="h-1.5 bg-parchment-dark rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-300"
                    style={{ width: `${voiceProgress}%` }}
                  />
                </div>
                <button
                  onClick={handleVoiceCancelDownload}
                  className="text-xs text-ink-muted hover:text-ink-primary transition-colors"
                >
                  Cancel download
                </button>
              </div>
            )}

            {voiceDownloadState === 'error' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <X className="w-3.5 h-3.5 flex-shrink-0" />
                  {voiceError}
                </div>
                <button onClick={() => setVoiceDownloadState('idle')} className="text-xs text-accent hover:underline">
                  Try again
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Advanced Tab ─────────────────────────────────────────────────────────────

function AdvancedTab() {
  const { setSetupComplete, setAbbey } = useAppStore()
  const [resetStage, setResetStage] = useState<'idle' | 'confirm' | 'resetting'>('idle')
  const [resetError, setResetError] = useState<string | null>(null)

  const handleReset = async () => {
    setResetStage('resetting')
    setResetError(null)
    try {
      const result = await window.electronAPI.resetAbbey()
      if (result.success) {
        setAbbey(null)
        setSetupComplete(false)
      } else {
        setResetError(result.error || 'Reset failed')
        setResetStage('confirm')
      }
    } catch (err) {
      setResetError((err as Error).message)
      setResetStage('confirm')
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <section>
        <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">Tools</h3>
        <div className="bg-parchment-card rounded-xl p-6 border border-parchment-dark">
          <p className="text-sm text-ink-muted">
            Tool management will be available in a future update.
            Currently, the agent has access to: read_file, write_file, move_file,
            list_files, add_comment, write_epistle.
          </p>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium text-red-500 uppercase tracking-wide mb-4">Danger Zone</h3>
        <div className="bg-parchment-card rounded-xl p-6 border border-red-200">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <span className="font-medium text-ink-primary text-sm">Reset Abbey</span>
              <p className="text-xs text-ink-muted mt-0.5">
                Deletes <code className="font-mono bg-parchment-sidebar px-1 rounded">_inbox</code>,{' '}
                <code className="font-mono bg-parchment-sidebar px-1 rounded">_drafts</code>, and{' '}
                <code className="font-mono bg-parchment-sidebar px-1 rounded">.scriptorium</code> from your
                abbey folder. Your other notes are kept. The app will return to the setup wizard.
              </p>
              {resetError && <p className="text-xs text-red-600 mt-2">{resetError}</p>}
            </div>

            {resetStage === 'idle' && (
              <button
                onClick={() => setResetStage('confirm')}
                className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
                Reset
              </button>
            )}

            {resetStage === 'confirm' && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Are you sure?
                </div>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Yes, reset
                </button>
                <button
                  onClick={() => { setResetStage('idle'); setResetError(null) }}
                  className="px-3 py-2 text-ink-muted hover:text-ink-primary text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {resetStage === 'resetting' && (
              <div className="flex items-center gap-2 text-ink-muted text-sm flex-shrink-0">
                <Loader2 className="w-4 h-4 animate-spin" />
                Resetting…
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

// ─── SettingsView ─────────────────────────────────────────────────────────────

export function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-accent" />
          <h2 className="font-serif font-medium text-lg text-ink-primary">Settings</h2>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-4 border-b border-parchment-dark">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              activeTab === id
                ? 'text-accent border-accent'
                : 'text-ink-muted border-transparent hover:text-ink-primary'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'general'    && <GeneralTab />}
        {activeTab === 'appearance' && <AppearanceTab />}
        {activeTab === 'inference'  && <InferenceTab />}
        {activeTab === 'voice'      && <VoiceTab />}
        {activeTab === 'advanced'   && <AdvancedTab />}
      </div>
    </div>
  )
}
