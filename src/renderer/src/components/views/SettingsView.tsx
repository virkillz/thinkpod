import { useState, useEffect, useRef } from 'react'
import { Settings, Folder, Key, Check, X, Loader2, Save, AlertTriangle, Trash2, Mic, Download, Zap, Palette, User, TriangleAlert, FileText, Plus, Pencil } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'
import type { ThemeId, UserProfile } from '../../store/appStore.js'

type TestStatus = 'idle' | 'testing' | 'success' | 'error'
type VoiceDownloadState = 'idle' | 'downloading' | 'error'
type VoiceConfig = { modelName: string; language: 'en' | 'auto' }
type SettingsTab = 'general' | 'appearance' | 'inference' | 'voice' | 'templates' | 'advanced'

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

// ─── Templates Tab ────────────────────────────────────────────────────────────

export interface NoteTemplate {
  id: string
  title: string
  description: string
  isEnabled: boolean
  format: string
  defaultFolder: string
}

const DEFAULT_TEMPLATES: NoteTemplate[] = [
  {
    id: 'journal',
    title: 'Journal',
    description: 'Daily reflection and personal notes',
    isEnabled: true,
    defaultFolder: 'Journal/',
    format: `# Journal — [date]

## How am I feeling?

[Write freely here]

## What's the plan for today?

[Write freely or bullet points]

# Journal — [date]

## What is actually happening?

[Write freely or bullet points]

## Reflection

[What did I learn or notice?]`,
  },
  {
    id: 'meeting',
    title: 'Meeting Notes',
    description: 'Structured notes from a meeting with agenda and action items',
    isEnabled: true,
    defaultFolder: 'Meetings/',
    format: `# Meeting: [Subject]

**Attendees:** [Name 1, Name 2]
**Date:** [Date]

## Agenda

[Agenda description]

## Notes

- [Note 1]
- [Note 2]

## Action Items

- [ ] [Who] — [What]`,
  },
  {
    id: 'project',
    title: 'Project Note',
    description: 'Progress notes for a project including goals and blockers',
    isEnabled: true,
    defaultFolder: 'Projects/',
    format: `# Project: [Name]

**Status:** [Active / On Hold / Done]

## Goal

[What are we trying to achieve?]

## Progress

[What has been done?]

## Blockers

- [Blocker 1]

## Next Steps

- [ ] [Next action]`,
  },
  {
    id: 'todo',
    title: 'Todo',
    description: 'A simple checklist of tasks',
    isEnabled: true,
    defaultFolder: 'Todos/',
    format: `# Todo: [Subject]

## Tasks

- [ ] [Task 1]
- [ ] [Task 2]
- [ ] [Task 3]

## Notes

[Optional context]`,
  },
  {
    id: 'bookmark',
    title: 'Bookmark',
    description: 'A saved link with context and tags',
    isEnabled: true,
    defaultFolder: 'Bookmarks/',
    format: `# [Page Title]

**URL:** [URL]
**Saved:** [Date]
**Tags:** [tag1, tag2]

## Why I saved this

[Reason]

## Key takeaways

- [Point 1]
- [Point 2]`,
  },
  {
    id: 'ideas',
    title: 'Ideas',
    description: 'A captured idea with description and next steps',
    isEnabled: true,
    defaultFolder: 'Ideas/',
    format: `# Idea: [Title]

## What is it?

[Describe the idea]

## Why it matters

[Motivation or potential impact]

## Next Steps

- [ ] [First step]`,
  },
  {
    id: 'braindump',
    title: 'Braindump',
    description: "Unstructured catch-all for anything that doesn't fit elsewhere",
    isEnabled: true,
    defaultFolder: 'Others/',
    format: `# Braindump — [date]

[Write anything here, no structure needed]`,
  },
]

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
      setTemplates(saved)
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
        {activeTab === 'templates'  && <TemplatesTab />}
        {activeTab === 'advanced'   && <AdvancedTab />}
      </div>
    </div>
  )
}
