import { useState, useEffect, useRef } from 'react'
import type { NoteTemplate } from '@main/vault/noteTemplates.js'
import { DEFAULT_TEMPLATES } from '@main/vault/noteTemplates.js'
import { Settings, Folder, Check, X, Loader2, Save, AlertTriangle, Trash2, Mic, Download, Zap, Palette, User, FileText, Plus, Pencil, Cpu, FileSearch, Copy } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'
import type { ThemeId, UserProfile, LLMProfile, LLMProvider } from '../../store/appStore.js'

type TestStatus = 'idle' | 'testing' | 'success' | 'error'
type VoiceDownloadState = 'idle' | 'downloading' | 'error'
type VoiceConfig = { modelName: string; language: 'en' | 'auto' }
type SettingsTab = 'general' | 'appearance' | 'inference' | 'voice' | 'templates' | 'advanced'
type DownloadStatus = 'idle' | 'downloading' | 'done' | 'error'

const QUANT_OPTIONS = [
  { quant: 'Q3_K_M', label: 'Light',       description: 'Smaller and faster',      detail: 'Good for 8 GB RAM',     sizeMb: 1400 },
  { quant: 'Q4_K_M', label: 'Balanced',    description: 'Best quality-to-size ratio', detail: 'Recommended — works on most Macs', sizeMb: 1800 },
  { quant: 'Q5_K_M', label: 'Quality',    description: 'Higher output quality',   detail: 'Needs 16 GB RAM or more', sizeMb: 2100 },
]

const VOICE_TIER_MODELS = [
  { name: 'small.en',       label: 'Fast · English',         sizeMb: 466  },
  { name: 'small',          label: 'Fast · Multilingual',    sizeMb: 466  },
  { name: 'large-v3-turbo', label: 'Accurate (recommended)', sizeMb: 805  },
  { name: 'medium.en',      label: 'Medium · English',       sizeMb: 1533 },
  { name: 'medium',         label: 'Medium · Multilingual',  sizeMb: 1533 },
  { name: 'large-v3',       label: 'Large v3',               sizeMb: 3094 },
]

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: 'general',    label: 'General',    icon: Folder   },
  { id: 'appearance', label: 'Appearance', icon: Palette  },
  { id: 'inference',  label: 'Inference',  icon: Zap      },
  { id: 'voice',      label: 'Voice',      icon: Mic      },
  { id: 'templates',  label: 'Templates',  icon: FileText },
  { id: 'advanced',   label: 'Advanced',   icon: Settings },
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
    description: 'Warm amber & serif — the classic ThinkPod look',
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
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Deep blue tones with a crisp marine feel',
    swatches: ['#0C1929', '#162033', '#0EA5E9', '#E0F2FE'],
    dark: true,
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm amber to purple gradient, perfect for evening writing',
    swatches: ['#1F1410', '#2D1F1A', '#F59E0B', '#FECACA'],
    dark: true,
  },
  {
    id: 'nordic',
    name: 'Nordic',
    description: 'Clean minimal whites and cool grays with subtle blue accents',
    swatches: ['#F8FAFC', '#F1F5F9', '#94A3B8', '#1E293B'],
    dark: false,
  },
  {
    id: 'lavender',
    name: 'Lavender',
    description: 'Soft purple tones for a calm, creative atmosphere',
    swatches: ['#FAF5FF', '#EDE9FE', '#A855F7', '#2E1065'],
    dark: false,
  },
  {
    id: 'cherry',
    name: 'Cherry',
    description: 'Dark elegance with subtle pink accents',
    swatches: ['#1A0A10', '#241115', '#F472B6', '#FECDD3'],
    dark: true,
  },
  {
    id: 'onyx',
    name: 'Onyx',
    description: 'Classic monochrome — black, grey, and white',
    swatches: ['#0D0D0D', '#1A1A1A', '#E5E5E5', '#FFFFFF'],
    dark: true,
  },
]

// ─── Appearance Tab ───────────────────────────────────────────────────────────

function AppearanceTab() {
  const { theme, setTheme, showStatusBar, setShowStatusBar } = useAppStore()

  const handleToggleStatusBar = (value: boolean) => {
    setShowStatusBar(value)
    window.electronAPI.setSetting('showStatusBar', value)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <section>
        <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">Interface</h3>
        <div className="bg-parchment-card rounded-xl p-6 border border-parchment-dark">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="font-medium text-ink-primary text-sm">Show status bar</span>
              <p className="text-xs text-ink-muted mt-0.5">
                Display vault name, LLM status, and version at the bottom of the window
              </p>
            </div>
            <button
              role="switch"
              aria-checked={showStatusBar}
              onClick={() => handleToggleStatusBar(!showStatusBar)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                showStatusBar ? 'bg-accent' : 'bg-ink-light'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                  showStatusBar ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </label>
        </div>
      </section>

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

// ─── Profile Section ──────────────────────────────────────────────────────────

function ProfileSection() {
  const { userProfile, setUserProfile } = useAppStore()
  const [name, setName] = useState(userProfile.name)
  const [bio, setBio] = useState(userProfile.bio)
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(userProfile.avatarDataUrl)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarClick = async () => {
    const dataUrl = await window.electronAPI.selectUserImage()
    if (dataUrl) setAvatarDataUrl(dataUrl)
  }

  const handleSave = async () => {
    const profile: UserProfile = { name: name.trim() || 'Chief', bio, avatarDataUrl }
    setUserProfile(profile)
    await window.electronAPI.setSetting('userProfile', profile)
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }

  return (
    <section>
      <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">Your Profile</h3>
      <div className="bg-parchment-card rounded-xl p-6 border border-parchment-dark space-y-5">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleAvatarClick}
            className="relative w-16 h-16 rounded-full border-2 border-parchment-dark hover:border-accent overflow-hidden flex-shrink-0 transition-colors group"
          >
            {avatarDataUrl ? (
              <img src={avatarDataUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-parchment-sidebar flex items-center justify-center">
                <User className="w-7 h-7 text-ink-muted" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-xs font-medium">Change</span>
            </div>
          </button>
          <div className="text-sm text-ink-muted">
            <p className="font-medium text-ink-primary">Profile picture</p>
            <p className="text-xs mt-0.5">Click to select an image</p>
          </div>
          {/* Hidden input kept for fallback — not used directly */}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" />
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-ink-primary mb-2">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setSaveStatus('idle') }}
            placeholder="Chief"
            className="w-full px-4 py-3 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent text-sm"
          />
        </div>

        {/* Bio */}
        <div>
          <label className="block text-sm font-medium text-ink-primary mb-2">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => { setBio(e.target.value); setSaveStatus('idle') }}
            placeholder="A brief note about yourself…"
            rows={3}
            className="w-full px-4 py-3 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent text-sm resize-none"
          />
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
        >
          {saveStatus === 'saved' ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saveStatus === 'saved' ? 'Saved' : 'Save'}
        </button>
      </div>
    </section>
  )
}

// ─── General Tab ──────────────────────────────────────────────────────────────

function GeneralTab() {
  const { vault, showSystemFolders, setShowSystemFolders } = useAppStore()

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <ProfileSection />

      <section>
        <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">Vault</h3>
        <div className="bg-parchment-card rounded-xl p-6 border border-parchment-dark">
          <div className="flex items-center gap-3 mb-4">
            <Folder className="w-5 h-5 text-accent" />
            <span className="font-medium text-ink-primary">Vault Path</span>
          </div>
          <div className="bg-parchment-sidebar rounded-lg px-4 py-3 font-mono text-sm text-ink-primary break-all">
            {vault?.path || 'No workspace configured'}
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
                Display _inbox, _thoughts, and .thinkpod in the file tree
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

const PROVIDER_META: Record<LLMProvider, { label: string; baseUrl: string; needsKey: boolean; badge: string }> = {
  ollama:   { label: 'Ollama',    baseUrl: 'http://localhost:11434/v1',           needsKey: false, badge: 'bg-purple-500/15 text-purple-400'  },
  lmstudio: { label: 'LM Studio', baseUrl: 'http://localhost:1234/v1',            needsKey: false, badge: 'bg-blue-500/15 text-blue-400'      },
  openai:   { label: 'OpenAI',    baseUrl: 'https://api.openai.com/v1',           needsKey: true,  badge: 'bg-emerald-500/15 text-emerald-400' },
  groq:     { label: 'Groq',      baseUrl: 'https://api.groq.com/openai/v1',      needsKey: true,  badge: 'bg-orange-500/15 text-orange-400'  },
  custom:   { label: 'Custom',    baseUrl: '',                                    needsKey: false, badge: 'bg-ink-muted/20 text-ink-muted'    },
  builtin:  { label: 'Built-in',  baseUrl: '',                                    needsKey: false, badge: 'bg-accent/15 text-accent'          },
}

function ProviderBadge({ provider }: { provider: LLMProvider }) {
  const meta = PROVIDER_META[provider]
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${meta.badge}`}>
      {meta.label}
    </span>
  )
}

// ─── Builtin server status strip ─────────────────────────────────────────────

type ServerStatus = 'loading' | 'ready' | 'stopped' | 'error'

function BuiltinServerStatus({ status, url, quant, onStatusChange }: {
  status: ServerStatus
  url: string | null
  quant: string
  onStatusChange: (s: ServerStatus) => void
}) {
  if (status === 'loading') return (
    <div className="flex items-center gap-2 text-sm text-ink-muted">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Starting server…
    </div>
  )
  if (status === 'ready') return (
    <div className="flex items-center gap-2 text-sm bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-1.5 text-green-400">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
      <span className="truncate">Running at {url}</span>
      <button onClick={async () => { onStatusChange('loading'); await window.electronAPI.stopBuiltinLLM(); onStatusChange('stopped') }}
        className="ml-auto text-xs underline opacity-70 hover:opacity-100 shrink-0">Stop</button>
    </div>
  )
  if (status === 'stopped') return (
    <div className="flex items-center gap-2 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5 text-amber-400">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
      Server not running
      <button onClick={async () => { onStatusChange('loading'); await window.electronAPI.startBuiltinLLM(quant) }}
        className="ml-auto text-xs underline opacity-70 hover:opacity-100 shrink-0">Start</button>
    </div>
  )
  return (
    <div className="flex items-center gap-2 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5 text-red-400">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
      Server error
      <button onClick={async () => { onStatusChange('loading'); await window.electronAPI.startBuiltinLLM(quant) }}
        className="ml-auto text-xs underline opacity-70 hover:opacity-100 shrink-0">Retry</button>
    </div>
  )
}

// ─── Profile edit/create form ─────────────────────────────────────────────────

function ProfileForm({ initialProfile, onSave, onCancel }: {
  initialProfile?: LLMProfile
  onSave: (profile: LLMProfile) => void
  onCancel: () => void
}) {
  const [name, setName]               = useState(initialProfile?.name ?? '')
  const [provider, setProvider]       = useState<LLMProvider>(initialProfile?.provider ?? 'ollama')
  const [baseUrl, setBaseUrl]         = useState(initialProfile?.baseUrl ?? PROVIDER_META.ollama.baseUrl)
  const [model, setModel]             = useState(initialProfile?.model ?? '')
  const [apiKey, setApiKey]           = useState(initialProfile?.apiKey ?? '')
  const [builtinQuant, setBuiltinQuant] = useState(initialProfile?.builtinQuant ?? 'Q4_K_M')
  const [testStatus, setTestStatus]   = useState<TestStatus>('idle')
  const [testError, setTestError]     = useState<string | null>(null)
  const [dlStatus, setDlStatus]       = useState<DownloadStatus>('idle')
  const [dlProgress, setDlProgress]   = useState(0)
  const [dlError, setDlError]         = useState<string | null>(null)
  const [downloadedModels, setDownloadedModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (provider !== 'builtin') return
    setLoadingModels(true)
    window.electronAPI.getLLMModelInfo().then((info) => {
      setDownloadedModels(info.downloaded)
      setLoadingModels(false)
    })
  }, [provider])

  useEffect(() => {
    unsubRef.current?.()
    if (provider !== 'builtin') return
    const unsub = window.electronAPI.onLLMDownloadProgress(({ quant, progress }) => {
      if (quant !== builtinQuant) return
      setDlProgress(progress)
      if (progress >= 100) {
        setDlStatus('done')
        setDownloadedModels(prev => prev.includes(quant) ? prev : [...prev, quant])
      }
    })
    unsubRef.current = unsub
    return () => unsub()
  }, [provider, builtinQuant])

  const handleProviderChange = (p: LLMProvider) => {
    setProvider(p)
    if (p !== 'builtin' && p !== 'custom') setBaseUrl(PROVIDER_META[p].baseUrl)
    setTestStatus('idle')
    setTestError(null)
  }

  const handleTest = async () => {
    setTestStatus('testing')
    setTestError(null)
    try {
      const result = await window.electronAPI.testLLMConnection({ baseUrl, model, apiKey: apiKey || undefined })
      if (result.success) { setTestStatus('success') }
      else { setTestStatus('error'); setTestError(result.error ?? 'Connection failed') }
    } catch (err) { setTestStatus('error'); setTestError((err as Error).message) }
  }

  const handleDownload = async () => {
    setDlStatus('downloading'); setDlProgress(0); setDlError(null)
    const result = await window.electronAPI.downloadLLMModel(builtinQuant)
    if (result.alreadyExists) {
      setDlStatus('done')
      setDownloadedModels(prev => prev.includes(builtinQuant) ? prev : [...prev, builtinQuant])
    } else if (!result.success && !result.cancelled) {
      setDlStatus('error'); setDlError(result.error ?? 'Download failed')
    }
  }

  const handleSave = () => {
    onSave({
      id: initialProfile?.id ?? crypto.randomUUID(),
      name: name.trim() || PROVIDER_META[provider].label,
      provider,
      baseUrl: provider === 'builtin' ? '' : baseUrl,
      model: provider === 'builtin' ? 'gemma-4-e4b-builtin' : model,
      apiKey,
      builtinQuant: provider === 'builtin' ? builtinQuant : undefined,
    })
  }

  const isDownloaded = downloadedModels.includes(builtinQuant) || dlStatus === 'done'
  const quantSizeMb = QUANT_OPTIONS.find(o => o.quant === builtinQuant)?.sizeMb ?? 0

  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-ink-muted mb-1">Profile name</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder={PROVIDER_META[provider].label}
          className="w-full px-3 py-2 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent text-sm text-ink-primary" />
      </div>

      {/* Provider picker */}
      <div>
        <label className="block text-xs font-medium text-ink-muted mb-1.5">Provider</label>
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.keys(PROVIDER_META) as LLMProvider[]).map(p => (
            <button key={p} onClick={() => handleProviderChange(p)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                provider === p ? 'border-accent bg-accent/10 text-ink-primary' : 'border-parchment-dark text-ink-muted hover:border-ink-muted'
              }`}>
              {PROVIDER_META[p].label}
            </button>
          ))}
        </div>
      </div>

      {/* External fields */}
      {provider !== 'builtin' && (<>
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Base URL</label>
          <input type="text" value={baseUrl} onChange={e => { setBaseUrl(e.target.value); setTestStatus('idle') }}
            placeholder="http://localhost:8000/v1"
            className="w-full px-3 py-2 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent text-sm text-ink-primary" />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Model</label>
          <input type="text" value={model} onChange={e => { setModel(e.target.value); setTestStatus('idle') }}
            placeholder={provider === 'openai' ? 'gpt-4o' : provider === 'groq' ? 'llama-3.3-70b-versatile' : 'model-name'}
            className="w-full px-3 py-2 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent text-sm text-ink-primary" />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">
            API Key {!PROVIDER_META[provider].needsKey && <span className="font-normal opacity-60">(optional)</span>}
          </label>
          <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
            placeholder={PROVIDER_META[provider].needsKey ? 'sk-…' : 'Leave blank if not required'}
            className="w-full px-3 py-2 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent text-sm text-ink-primary" />
        </div>
      </>)}

      {/* Built-in fields */}
      {provider === 'builtin' && (
        <div className="space-y-3">
          {loadingModels ? (
            <div className="flex items-center gap-2 text-sm text-ink-muted"><Loader2 className="w-4 h-4 animate-spin" /> Checking downloads…</div>
          ) : (<>
            <div className="space-y-1.5">
              {QUANT_OPTIONS.map(opt => {
                const downloaded = downloadedModels.includes(opt.quant)
                return (
                  <button key={opt.quant}
                    onClick={() => { setBuiltinQuant(opt.quant); setDlStatus('idle'); setDlError(null) }}
                    disabled={dlStatus === 'downloading'}
                    className={`w-full p-3 rounded-lg border text-left transition-all ${builtinQuant === opt.quant ? 'border-accent bg-accent/5' : 'border-parchment-dark hover:border-ink-muted'} disabled:opacity-50`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full border-2 shrink-0 ${builtinQuant === opt.quant ? 'border-accent bg-accent' : 'border-ink-muted'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-ink-primary">{opt.label}</span>
                          <span className="text-xs text-ink-muted">— {opt.description}</span>
                          {downloaded && <span className="ml-auto flex items-center gap-1 text-xs text-success"><Check className="w-3 h-3" /> Downloaded</span>}
                        </div>
                        <div className="text-xs text-ink-muted mt-0.5">{opt.detail} · {opt.sizeMb >= 1000 ? `${(opt.sizeMb/1000).toFixed(1)} GB` : `${opt.sizeMb} MB`}</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
            {!isDownloaded ? (
              <div className="space-y-2">
                {dlStatus === 'downloading' ? (<>
                  <div className="flex items-center justify-between text-sm text-ink-muted">
                    <span>Downloading…</span><span>{dlProgress}%</span>
                  </div>
                  <div className="h-1.5 bg-parchment-dark rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${dlProgress}%` }} />
                  </div>
                  <button onClick={async () => { await window.electronAPI.cancelLLMModelDownload(); setDlStatus('idle'); setDlProgress(0) }}
                    className="text-sm text-ink-muted hover:text-error transition-colors">Cancel</button>
                </>) : (<>
                  <button onClick={handleDownload}
                    className="flex items-center gap-2 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors">
                    <Download className="w-3.5 h-3.5" />
                    Download {quantSizeMb >= 1000 ? `${(quantSizeMb/1000).toFixed(1)} GB` : `${quantSizeMb} MB`}
                  </button>
                  {dlStatus === 'error' && dlError && (
                    <span className="text-sm text-red-500 flex items-center gap-1"><X className="w-3 h-3" />{dlError}</span>
                  )}
                </>)}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-sm text-success"><Check className="w-4 h-4" /> Model ready</div>
            )}
          </>)}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-parchment-dark">
        {provider !== 'builtin' && (
          <button onClick={handleTest} disabled={testStatus === 'testing' || !baseUrl || !model}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors disabled:cursor-not-allowed ${
              testStatus === 'success' ? 'border-green-600 bg-green-600 text-white'
              : testStatus === 'error' ? 'border-red-600 bg-red-600 text-white'
              : 'border-accent text-accent hover:bg-accent hover:text-white disabled:border-parchment-dark disabled:text-ink-muted'
            }`}>
            {testStatus === 'testing' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {testStatus === 'success' && <Check className="w-3.5 h-3.5" />}
            {testStatus === 'error'   && <X     className="w-3.5 h-3.5" />}
            {testStatus === 'testing' ? 'Testing…' : testStatus === 'success' ? 'Connected' : testStatus === 'error' ? 'Failed' : 'Test'}
          </button>
        )}
        <button onClick={handleSave}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors">
          <Save className="w-3.5 h-3.5" /> Save
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-ink-muted hover:text-ink-primary text-sm transition-colors">
          Cancel
        </button>
        {testError && <span className="text-xs text-red-500 ml-1">{testError}</span>}
      </div>
    </div>
  )
}

// ─── Inference Tab root ───────────────────────────────────────────────────────

function InferenceTab() {
  const { llmProfiles, activeProfileId, setLLMStorage } = useAppStore()
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [activateError, setActivateError] = useState<string | null>(null)
  const [serverStatus, setServerStatus] = useState<ServerStatus>('stopped')
  const [serverUrl, setServerUrl] = useState<string | null>(null)

  useEffect(() => {
    window.electronAPI.getLLMModelInfo().then((info) => {
      if (info.serverRunning) { setServerStatus('ready'); setServerUrl(info.serverUrl) }
    })
    const unsub = window.electronAPI.onLLMStatus((status: string) => {
      if      (status === 'loading') setServerStatus('loading')
      else if (status === 'ready')   setServerStatus('ready')
      else if (status === 'stopped') setServerStatus('stopped')
      else if (status === 'error')   setServerStatus('error')
    })
    return unsub
  }, [])

  const persist = (profiles: LLMProfile[], activeId: string | null) => {
    setLLMStorage(profiles, activeId)
    window.electronAPI.setSetting('llmConfig', { profiles, activeId })
  }

  const handleSaveProfile = (profile: LLMProfile) => {
    const exists = llmProfiles.some(p => p.id === profile.id)
    const updated = exists ? llmProfiles.map(p => p.id === profile.id ? profile : p) : [...llmProfiles, profile]
    persist(updated, activeProfileId)
    setEditingId(null)
  }

  const handleDeleteProfile = (id: string) => {
    const updated = llmProfiles.filter(p => p.id !== id)
    const newActive = activeProfileId === id ? (updated[0]?.id ?? null) : activeProfileId
    persist(updated, newActive)
    if (editingId === id) setEditingId(null)
  }

  const handleActivate = async (id: string) => {
    const profile = llmProfiles.find(p => p.id === id)
    if (!profile) return
    setActivatingId(id)
    setActivateError(null)
    if (profile.provider === 'builtin') {
      setServerStatus('loading')
      const result = await window.electronAPI.startBuiltinLLM(profile.builtinQuant ?? 'Q4_K_M')
      if (result.success) {
        setServerStatus('ready')
        setServerUrl(result.url ?? null)
        persist(llmProfiles, id)
      } else {
        setServerStatus('error')
        setActivateError(result.error ?? 'Failed to start model')
      }
    } else {
      persist(llmProfiles, id)
    }
    setActivatingId(null)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink-primary">Connection Profiles</h3>
          <p className="text-xs text-ink-muted mt-0.5">Switch between providers and models for experimentation.</p>
        </div>
        <button onClick={() => setEditingId('new')} disabled={editingId === 'new'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Profile
        </button>
      </div>

      {/* Profile list */}
      <div className="space-y-2">
        {llmProfiles.length === 0 && editingId !== 'new' && (
          <div className="bg-parchment-card border border-parchment-dark rounded-xl p-8 text-center">
            <Cpu className="w-8 h-8 text-ink-light mx-auto mb-3" />
            <p className="text-sm text-ink-muted">No profiles yet. Add one to connect Wilfred to a language model.</p>
          </div>
        )}

        {llmProfiles.map(profile => {
          const isActive = profile.id === activeProfileId
          const isActivating = activatingId === profile.id
          const isEditing = editingId === profile.id
          const modelLabel = profile.provider === 'builtin'
            ? (QUANT_OPTIONS.find(q => q.quant === profile.builtinQuant)?.label ?? profile.builtinQuant)
            : profile.model

          return (
            <div key={profile.id}
              className={`bg-parchment-card border rounded-xl overflow-hidden transition-all ${isActive ? 'border-accent/40' : 'border-parchment-dark'}`}>

              {/* Row */}
              <div className="flex items-center gap-3 p-4">
                <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-green-500' : 'bg-ink-light'}`} />
                <ProviderBadge provider={profile.provider} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-ink-primary">{profile.name}</span>
                  {modelLabel && <span className="text-xs text-ink-muted ml-2">{modelLabel}</span>}
                </div>
                {isActive ? (
                  <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full shrink-0">Active</span>
                ) : (
                  <button onClick={() => handleActivate(profile.id)} disabled={isActivating}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-accent text-accent hover:bg-accent hover:text-white disabled:opacity-50 transition-colors shrink-0">
                    {isActivating && <Loader2 className="w-3 h-3 animate-spin" />}
                    Activate
                  </button>
                )}
                <button onClick={() => setEditingId(isEditing ? null : profile.id)}
                  className={`p-1.5 rounded-lg transition-colors ${isEditing ? 'text-accent bg-accent/10' : 'text-ink-muted hover:text-ink-primary hover:bg-parchment-dark'}`}>
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDeleteProfile(profile.id)}
                  className="p-1.5 rounded-lg text-ink-muted hover:text-red-500 hover:bg-red-500/10 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Server status (active builtin only) */}
              {isActive && profile.provider === 'builtin' && (
                <div className="px-4 pb-3">
                  <BuiltinServerStatus status={serverStatus} url={serverUrl}
                    quant={profile.builtinQuant ?? 'Q4_K_M'} onStatusChange={setServerStatus} />
                </div>
              )}

              {/* Activate error */}
              {activateError && activatingId === null && isActive && (
                <p className="px-4 pb-3 text-xs text-red-500">{activateError}</p>
              )}

              {/* Edit form */}
              {isEditing && (
                <div className="border-t border-parchment-dark p-4">
                  <ProfileForm initialProfile={profile} onSave={handleSaveProfile} onCancel={() => setEditingId(null)} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* New profile form */}
      {editingId === 'new' && (
        <div className="bg-parchment-card border border-parchment-dark rounded-xl p-4">
          <p className="text-sm font-medium text-ink-primary mb-4">New Profile</p>
          <ProfileForm onSave={handleSaveProfile} onCancel={() => setEditingId(null)} />
        </div>
      )}
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

// ─── Templates Tab ────────────────────────────────────────────────────────────

function TemplatesTab() {
  const [templates, setTemplates] = useState<NoteTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<NoteTemplate | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    const saved = await window.electronAPI.getSetting('noteTemplates') as NoteTemplate[] | null
    if (saved && Array.isArray(saved) && saved.length > 0) {
      const savedIds = new Set(saved.map(t => t.id))
      const newDefaults = DEFAULT_TEMPLATES.filter(t => !savedIds.has(t.id))
      const merged = [...saved, ...newDefaults]
      setTemplates(merged)
      if (newDefaults.length > 0) {
        await window.electronAPI.setSetting('noteTemplates', merged)
      }
    } else {
      setTemplates(DEFAULT_TEMPLATES)
      await window.electronAPI.setSetting('noteTemplates', DEFAULT_TEMPLATES)
    }
    setLoading(false)
  }

  const persist = async (updated: NoteTemplate[]) => {
    setTemplates(updated)
    await window.electronAPI.setSetting('noteTemplates', updated)
  }

  const handleToggle = (id: string) => {
    persist(templates.map(t => t.id === id ? { ...t, isEnabled: !t.isEnabled } : t))
  }

  const handleDelete = (id: string) => {
    persist(templates.filter(t => t.id !== id))
    setDeleteConfirmId(null)
  }

  const handleEdit = (template: NoteTemplate) => {
    setEditDraft({ ...template })
    setEditingId(template.id)
  }

  const handleNew = () => {
    const draft: NoteTemplate = {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      isEnabled: true,
      format: '',
      defaultFolder: '',
      requireTags: true,
    }
    setEditDraft(draft)
    setEditingId('new')
  }

  const handleSaveEdit = async () => {
    if (!editDraft) return
    const isNew = editingId === 'new'
    const updated = isNew
      ? [...templates, editDraft]
      : templates.map(t => t.id === editDraft.id ? editDraft : t)
    await persist(updated)
    setEditingId(null)
    setEditDraft(null)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditDraft(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-ink-muted" />
      </div>
    )
  }

  // ── Edit / New panel ──────────────────────────────────────────────────────
  if (editingId !== null && editDraft) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={handleCancelEdit} className="text-ink-muted hover:text-ink-primary text-sm transition-colors">
            ← Back
          </button>
          <span className="text-parchment-dark">|</span>
          <h3 className="text-sm font-medium text-ink-primary">
            {editingId === 'new' ? 'New Template' : 'Edit Template'}
          </h3>
        </div>

        <div className="bg-parchment-card rounded-xl p-6 border border-parchment-dark space-y-5">
          <div>
            <label className="block text-sm font-medium text-ink-primary mb-2">Title</label>
            <input
              type="text"
              value={editDraft.title}
              onChange={e => setEditDraft({ ...editDraft, title: e.target.value })}
              placeholder="e.g. Meeting Notes"
              className="w-full px-4 py-3 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-primary mb-2">Description</label>
            <input
              type="text"
              value={editDraft.description}
              onChange={e => setEditDraft({ ...editDraft, description: e.target.value })}
              placeholder="One-line description used by AI to classify notes"
              className="w-full px-4 py-3 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-primary mb-2">Default Folder</label>
            <input
              type="text"
              value={editDraft.defaultFolder}
              onChange={e => setEditDraft({ ...editDraft, defaultFolder: e.target.value })}
              placeholder="e.g. meetings/"
              className="w-full px-4 py-3 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-primary mb-1">Template Format</label>
            <p className="text-xs text-ink-muted mb-2">Markdown template. Use [brackets] for placeholders.</p>
            <textarea
              value={editDraft.format}
              onChange={e => setEditDraft({ ...editDraft, format: e.target.value })}
              rows={14}
              placeholder={'# Title\n\n## Section\n\n[content here]'}
              className="w-full px-4 py-3 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent text-sm font-mono resize-none leading-relaxed"
            />
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-parchment-dark">
            <button
              onClick={handleSaveEdit}
              disabled={!editDraft.title.trim() || !editDraft.format.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:bg-ink-light disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Template
            </button>
            <button
              onClick={handleCancelEdit}
              className="px-4 py-2 text-ink-muted hover:text-ink-primary text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-ink-muted">
          Templates used by AI to classify and reformat notes during triage.
        </p>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-3 py-1.5 border border-accent text-accent hover:bg-accent hover:text-white rounded-lg text-sm font-medium transition-colors flex-shrink-0 ml-4"
        >
          <Plus className="w-4 h-4" />
          Add New
        </button>
      </div>

      <div className="space-y-2">
        {templates.map(template => (
          <div
            key={template.id}
            className="bg-parchment-card rounded-xl border border-parchment-dark overflow-hidden"
          >
            <div className="flex items-center gap-4 px-4 py-3.5">
              {/* Enable/disable toggle */}
              <button
                role="switch"
                aria-checked={template.isEnabled}
                onClick={() => handleToggle(template.id)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                  template.isEnabled ? 'bg-accent' : 'bg-ink-light'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${
                    template.isEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-medium text-sm ${template.isEnabled ? 'text-ink-primary' : 'text-ink-muted'}`}>
                    {template.title}
                  </span>
                  <span className="text-xs font-mono text-ink-light">{template.defaultFolder}</span>
                </div>
                {template.description && (
                  <p className="text-xs text-ink-muted mt-0.5 truncate">{template.description}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {deleteConfirmId === template.id ? (
                  <>
                    <span className="text-xs text-red-600 mr-1">Delete?</span>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-2 py-1 text-ink-muted hover:text-ink-primary text-xs transition-colors"
                    >
                      No
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleEdit(template)}
                      className="p-1.5 text-ink-muted hover:text-ink-primary hover:bg-parchment-sidebar rounded transition-colors"
                      title="Edit template"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(template.id)}
                      className="p-1.5 text-ink-muted hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Logs Section ──────────────────────────────────────────────────────────────

function LogsSection() {
  const [logs, setLogs] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadLogs = async () => {
    setLoading(true)
    const result = await window.electronAPI.getAppLogs()
    if (result.success) {
      setLogs(result.content)
    } else {
      setLogs(`// Failed to load logs: ${result.error}`)
    }
    setLoading(false)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(logs)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExport = () => {
    const blob = new Blob([logs], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `thinkpod-logs-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide">Application Logs</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={loadLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-parchment-dark text-ink-primary hover:border-accent hover:text-accent rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            <FileSearch className="w-3.5 h-3.5" />
            {loading ? 'Loading…' : logs ? 'Refresh' : 'Load Logs'}
          </button>
          {logs && (
            <>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-parchment-dark text-ink-primary hover:border-accent hover:text-accent rounded-lg text-xs font-medium transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-parchment-dark text-ink-primary hover:border-accent hover:text-accent rounded-lg text-xs font-medium transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
            </>
          )}
        </div>
      </div>

      {logs ? (
        <pre className="bg-parchment-sidebar rounded-xl p-4 border border-parchment-dark text-xs font-mono text-ink-primary overflow-x-auto max-h-80 whitespace-pre-wrap break-all">
          {logs}
        </pre>
      ) : (
        <div className="bg-parchment-card rounded-xl p-6 border border-parchment-dark text-center">
          <FileSearch className="w-8 h-8 text-ink-light mx-auto mb-2" />
          <p className="text-sm text-ink-muted">No logs loaded yet.</p>
          <button onClick={loadLogs} className="mt-3 text-xs text-accent hover:underline">
            Load logs
          </button>
        </div>
      )}
    </section>
  )
}

// ─── Advanced Tab ─────────────────────────────────────────────────────────────

function AdvancedTab() {
  const { setSetupComplete, setVault } = useAppStore()
  const [resetStage, setResetStage] = useState<'idle' | 'confirm' | 'resetting'>('idle')
  const [resetError, setResetError] = useState<string | null>(null)

  const handleReset = async () => {
    setResetStage('resetting')
    setResetError(null)
    try {
      const result = await window.electronAPI.resetVault()
      if (result.success) {
        setVault(null)
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
      <LogsSection />

      <section>
        <h3 className="text-sm font-medium text-red-500 uppercase tracking-wide mb-4">Danger Zone</h3>
        <div className="bg-parchment-card rounded-xl p-6 border border-red-200">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <span className="font-medium text-ink-primary text-sm">Reset Vault</span>
              <p className="text-xs text-ink-muted mt-0.5">
                Deletes <code className="font-mono bg-parchment-sidebar px-1 rounded">_inbox</code>,{' '}
                <code className="font-mono bg-parchment-sidebar px-1 rounded">_thoughts</code>, and{' '}
                <code className="font-mono bg-parchment-sidebar px-1 rounded">.thinkpod</code> from your
                vault folder. Your other notes are kept. The app will return to the setup wizard.
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
  const { pendingSettingsTab, setPendingSettingsTab } = useAppStore()
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    (pendingSettingsTab as SettingsTab) || 'general'
  )

  useEffect(() => {
    if (pendingSettingsTab) {
      setActiveTab(pendingSettingsTab as SettingsTab)
      setPendingSettingsTab(null)
    }
  }, [])

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
        {activeTab === 'templates'  && <TemplatesTab />}
        {activeTab === 'advanced'   && <AdvancedTab />}
      </div>
    </div>
  )
}
