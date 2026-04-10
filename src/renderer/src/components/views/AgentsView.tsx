import { useEffect, useState } from 'react'
import { useAppStore } from '../../store/appStore.js'
import { Bot, User, Clock, Calendar, Save, Check, Loader2, Play, Archive, CheckCircle, XCircle, AlertCircle, X, ScrollText, Plus, Pencil, Trash2, CalendarClock } from 'lucide-react'
import avatar01 from '../../assets/avatar01.png'
import avatar02 from '../../assets/avatar02.png'
import avatar03 from '../../assets/avatar03.png'
import avatar04 from '../../assets/avatar04.png'
import avatar05 from '../../assets/avatar05.png'
import avatar06 from '../../assets/avatar06.png'
import avatar07 from '../../assets/avatar07.png'
import avatar08 from '../../assets/avatar08.png'
import avatar09 from '../../assets/avatar09.png'
import avatar10 from '../../assets/avatar10.png'
import avatar11 from '../../assets/avatar11.png'
import avatar12 from '../../assets/avatar12.png'
import avatar13 from '../../assets/avatar13.png'
import avatar14 from '../../assets/avatar14.png'
import avatar15 from '../../assets/avatar15.png'
import avatar16 from '../../assets/avatar16.png'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentProfile {
  name: string
  avatar: string
  systemPrompt: string
}

interface TaskRecord {
  id: number
  task_name: string
  started_at: number
  ended_at: number
  status: string
  summary: string
}

interface Schedule {
  id: number
  name: string
  schedule: string
  prompt: string
  is_active: number
}

interface LiveTask {
  taskName: string
  status: string
  iterations: number
  toolCalls: number
}

interface PendingTask {
  id: number
  name: string
  prompt: string
  run_at: number | null
  status: string
}

interface TaskFormState {
  name: string
  prompt: string
  timing: 'now' | 'later'
  runAt: string
}

const EMPTY_TASK_FORM: TaskFormState = { name: '', prompt: '', timing: 'now', runAt: '' }

interface ScheduleFormState {
  name: string
  prompt: string
  schedule: string
}

const EMPTY_SCHEDULE_FORM: ScheduleFormState = { name: '', prompt: '', schedule: '0 9 * * *' }

// ─── Avatar options ───────────────────────────────────────────────────────────

const AVATAR_OPTIONS = [
  avatar01, avatar02, avatar03, avatar04,
  avatar05, avatar06, avatar07, avatar08,
  avatar09, avatar10, avatar11, avatar12,
  avatar13, avatar14, avatar15, avatar16,
]

const DEFAULT_PROFILE: AgentProfile = {
  name: 'Wilfred',
  avatar: avatar01,
  systemPrompt: `You are Wilfred, a thoughtful friend who loves to brainstorm and explore ideas together.
          You're knowledgeable, smart, and genuinely supportive — like that friend who's always curious,
          asks great questions, and helps you think through things without judgment.

          Your approach:
          - Collaborative. You think *with* the user, not just for them. You bounce ideas back and forth.
          - Curious. You ask thoughtful questions that spark deeper thinking.
          - Knowledgeable. You bring relevant insights, patterns, and connections to the conversation.
          - Supportive. You encourage exploration and make the user feel heard and understood.
          - Clear. You communicate ideas simply and elegantly, avoiding unnecessary jargon.
          - Practical. When action is needed, you help break things down into doable steps.

          Whether organizing notes, researching, editing, or just chatting — you're here as a thinking partner.`,
}

type Tab = 'profile' | 'prompts' | 'tasks' | 'schedules'

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab() {
  const { setAgentProfile } = useAppStore()
  const [profile, setProfile] = useState<AgentProfile>(DEFAULT_PROFILE)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  useEffect(() => {
    window.electronAPI.getSetting('agentProfile').then((saved) => {
      if (saved && typeof saved === 'object') {
        setProfile({ ...DEFAULT_PROFILE, ...(saved as Partial<AgentProfile>) })
      }
    })
  }, [])

  const handleSave = async () => {
    setSaveStatus('saving')
    await window.electronAPI.setSetting('agentProfile', profile)
    setAgentProfile(profile.name || 'Wilfred', profile.avatar || avatar01)
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Preview */}
      <div className="bg-parchment-card rounded-xl p-6 border border-parchment-dark flex items-center gap-5">
        <img
          src={profile.avatar}
          alt="Avatar"
          className="w-16 h-16 rounded-full object-cover flex-shrink-0"
        />
        <div>
          <p className="font-serif font-medium text-lg text-ink-primary">{profile.name || 'Unnamed Agent'}</p>
          <p className="text-sm text-ink-muted mt-0.5">Agent</p>
        </div>
      </div>

      {/* Name */}
      <section>
        <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-3">Name</h3>
        <input
          type="text"
          value={profile.name}
          onChange={(e) => setProfile({ ...profile, name: e.target.value })}
          placeholder="Agent name"
          className="w-full px-4 py-3 bg-parchment-card border border-parchment-dark rounded-xl focus:outline-none focus:border-accent text-ink-primary"
        />
      </section>

      {/* Avatar */}
      <section>
        <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-3">Avatar</h3>
        <div className="grid grid-cols-8 gap-2">
          {AVATAR_OPTIONS.map((src) => (
            <button
              key={src}
              onClick={() => setProfile({ ...profile, avatar: src })}
              className={`h-10 w-10 rounded-lg overflow-hidden transition-all p-0 ${
                profile.avatar === src
                  ? 'ring-2 ring-accent'
                  : 'border border-parchment-dark hover:border-accent'
              }`}
            >
              <img src={src} alt="Avatar option" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </section>

      {/* System Prompt */}
      <section>
        <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-3">Default System Prompt</h3>
        <textarea
          value={profile.systemPrompt}
          onChange={(e) => setProfile({ ...profile, systemPrompt: e.target.value })}
          rows={10}
          className="w-full px-4 py-3 bg-parchment-card border border-parchment-dark rounded-xl focus:outline-none focus:border-accent text-ink-primary text-sm font-mono resize-none"
        />
      </section>

      {/* Save */}
      <div className="flex justify-end pb-6">
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {saveStatus === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
          {saveStatus === 'saved' && <Check className="w-4 h-4" />}
          {saveStatus === 'idle' && <Save className="w-4 h-4" />}
          {saveStatus === 'saved' ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ─── Prompts Tab ──────────────────────────────────────────────────────────────

const INVOCATION_TYPES: {
  key: 'docs_review' | 'general_chat'
  label: string
  description: string
  variables: string[]
}[] = [
  {
    key: 'docs_review',
    label: 'Document Review',
    description: 'Used when the Agent FAB is opened while viewing a note.',
    variables: ['{file_path}', '{file_content}'],
  },
  {
    key: 'general_chat',
    label: 'General Chat',
    description: 'Used when the Agent FAB is opened outside of a note.',
    variables: [],
  },
]

const DEFAULT_INVOCATION_PROMPTS: Record<string, string> = {
  docs_review: `You are currently reviewing the markdown document at {file_path}.
The user may want to discuss the content, ask questions, or request edits, summaries, or other operations.
Use available tools when appropriate.

Current document content:
---
{file_content}
---`,
  general_chat: `The user is in a general conversation. No specific document is open.
Answer questions, help with the vault, or discuss ideas.`,
}

function PromptsTab() {
  const [prompts, setPrompts] = useState<Record<string, string>>({})
  const [saveStatus, setSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({})

  useEffect(() => {
    window.electronAPI.getSetting('invocationPrompts').then((saved) => {
      if (saved && typeof saved === 'object') {
        setPrompts({ ...DEFAULT_INVOCATION_PROMPTS, ...(saved as Record<string, string>) })
      } else {
        setPrompts({ ...DEFAULT_INVOCATION_PROMPTS })
      }
    })
  }, [])

  const handleSave = async (key: string) => {
    setSaveStatus(prev => ({ ...prev, [key]: 'saving' }))
    const current = (await window.electronAPI.getSetting('invocationPrompts') as Record<string, string> | null) ?? {}
    await window.electronAPI.setSetting('invocationPrompts', { ...current, [key]: prompts[key] })
    setSaveStatus(prev => ({ ...prev, [key]: 'saved' }))
    setTimeout(() => setSaveStatus(prev => ({ ...prev, [key]: 'idle' })), 2000)
  }

  const handleReset = (key: string) => {
    setPrompts(prev => ({ ...prev, [key]: DEFAULT_INVOCATION_PROMPTS[key] }))
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-6">
      <p className="text-sm text-ink-muted">
        Each invocation type uses a different context prompt appended to the agent's base persona.
        Changes take effect on the next new conversation.
      </p>

      {INVOCATION_TYPES.map(({ key, label, description, variables }) => {
        const status = saveStatus[key] ?? 'idle'
        return (
          <div key={key} className="bg-parchment-card rounded-xl border border-parchment-dark overflow-hidden">
            <div className="px-5 py-4 border-b border-parchment-dark flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <ScrollText className="w-4 h-4 text-accent" />
                  <h3 className="font-medium text-ink-primary text-sm">{label}</h3>
                  <span className="text-xs text-ink-light font-mono bg-parchment-sidebar px-1.5 py-0.5 rounded">{key}</span>
                </div>
                <p className="text-xs text-ink-muted mt-1">{description}</p>
                {variables.length > 0 && (
                  <p className="text-xs text-ink-light mt-1">
                    Variables: {variables.map(v => (
                      <span key={v} className="font-mono bg-parchment-sidebar px-1 rounded mr-1">{v}</span>
                    ))}
                  </p>
                )}
              </div>
            </div>

            <div className="p-5 space-y-3">
              <textarea
                value={prompts[key] ?? ''}
                onChange={(e) => setPrompts(prev => ({ ...prev, [key]: e.target.value }))}
                rows={8}
                className="w-full px-4 py-3 bg-parchment-base border border-parchment-dark rounded-xl focus:outline-none focus:border-accent text-ink-primary text-xs font-mono resize-none"
              />
              <div className="flex justify-between items-center">
                <button
                  onClick={() => handleReset(key)}
                  className="text-xs text-ink-muted hover:text-ink-primary transition-colors"
                >
                  Reset to default
                </button>
                <button
                  onClick={() => handleSave(key)}
                  disabled={status === 'saving'}
                  className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {status === 'saving' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {status === 'saved' && <Check className="w-3.5 h-3.5" />}
                  {status === 'idle' && <Save className="w-3.5 h-3.5" />}
                  {status === 'saved' ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Tasks Tab ────────────────────────────────────────────────────────────────

function TasksTab() {
  const { agentName } = useAppStore()
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [liveTask, setLiveTask] = useState<LiveTask | null>(null)
  const [triggering, setTriggering] = useState<number | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [form, setForm] = useState<TaskFormState>(EMPTY_TASK_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    loadData()

    const unsubUpdate = window.electronAPI.onTaskUpdate((run) => {
      const r = run as LiveTask & { status: string }
      if (r.status === 'running') {
        setLiveTask(r)
      } else {
        setLiveTask(null)
        loadData()
      }
    })

    const unsubEnd = window.electronAPI.onTaskEnd(() => {
      setLiveTask(null)
      loadData()
    })

    return () => {
      unsubUpdate()
      unsubEnd()
    }
  }, [])

  const loadData = async () => {
    const [taskList, scheduleList, pendingList] = await Promise.all([
      window.electronAPI.getAgentTasks(),
      window.electronAPI.listSchedules(),
      window.electronAPI.listTasks(),
    ])
    setTasks(taskList)
    setSchedules(scheduleList)
    setPendingTasks(pendingList)
  }

  const handleTrigger = async (id: number) => {
    setTriggering(id)
    try {
      await window.electronAPI.triggerSchedule(id)
    } finally {
      setTriggering(null)
      loadData()
    }
  }

  const openNew = () => {
    setForm(EMPTY_TASK_FORM)
    setFormError(null)
    setEditingTaskId(null)
    setShowForm(true)
  }

  const openEdit = (t: PendingTask) => {
    const hasTime = t.run_at !== null
    const runAtStr = hasTime ? new Date(t.run_at!).toISOString().slice(0, 16) : ''
    setForm({ name: t.name, prompt: t.prompt, timing: hasTime ? 'later' : 'now', runAt: runAtStr })
    setFormError(null)
    setEditingTaskId(t.id)
    setShowForm(true)
  }

  const cancelForm = () => {
    setShowForm(false)
    setEditingTaskId(null)
    setFormError(null)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Name is required'); return }
    if (!form.prompt.trim()) { setFormError('Prompt is required'); return }
    if (form.timing === 'later' && !form.runAt) { setFormError('Please select a date and time'); return }

    const runAt = form.timing === 'later' ? new Date(form.runAt).getTime() : null

    setSaving(true)
    setFormError(null)
    try {
      if (editingTaskId !== null) {
        const res = await window.electronAPI.updateTask(editingTaskId, form.name.trim(), form.prompt.trim(), runAt)
        if (!res.success) { setFormError(res.error ?? 'Failed to update'); return }
      } else {
        const res = await window.electronAPI.createTask(form.name.trim(), form.prompt.trim(), runAt)
        if (!res.success) { setFormError(res.error ?? 'Failed to create'); return }
      }
      setShowForm(false)
      setEditingTaskId(null)
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePending = async (id: number) => {
    const res = await window.electronAPI.deleteTask(id)
    if (res.success) {
      setDeletingId(null)
      await loadData()
    }
  }

  const formatDuration = (start: number, end: number) => {
    const secs = Math.round((end - start) / 1000)
    if (secs < 60) return `${secs}s`
    return `${Math.floor(secs / 60)}m ${secs % 60}s`
  }

  const formatTime = (ts: number) => new Date(ts).toLocaleString()

  const formatRunAt = (runAt: number | null) => {
    if (runAt === null) return 'Immediately'
    return new Date(runAt).toLocaleString()
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done': return <CheckCircle className="w-4 h-4 text-success" />
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />
      case 'aborted': return <XCircle className="w-4 h-4 text-ink-muted" />
      case 'budget_exceeded': return <AlertCircle className="w-4 h-4 text-warning" />
      default: return <Loader2 className="w-4 h-4 text-accent animate-spin" />
    }
  }

  const activeSchedules = schedules.filter(s => s.is_active)

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* New Task Button */}
      <div className="flex justify-end">
        <button
          onClick={openNew}
          disabled={showForm}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Task
        </button>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <section>
          <div className="bg-parchment-card border border-accent/30 rounded-xl p-6 space-y-4">
            <h3 className="font-medium text-ink-primary text-sm">
              {editingTaskId !== null ? 'Edit Task' : 'New Task'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-ink-muted mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Summarise this week's notes"
                  className="w-full bg-parchment-sidebar border border-parchment-dark rounded-lg px-3 py-2 text-sm text-ink-primary placeholder:text-ink-light focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs text-ink-muted mb-1">Prompt</label>
                <textarea
                  value={form.prompt}
                  onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))}
                  placeholder="Describe what the agent should do..."
                  rows={4}
                  className="w-full bg-parchment-sidebar border border-parchment-dark rounded-lg px-3 py-2 text-sm text-ink-primary placeholder:text-ink-light focus:outline-none focus:border-accent resize-none"
                />
              </div>

              <div>
                <label className="block text-xs text-ink-muted mb-2">When to run</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setForm(f => ({ ...f, timing: 'now' }))}
                    className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                      form.timing === 'now'
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-parchment-dark text-ink-muted hover:border-accent/50'
                    }`}
                  >
                    Immediately
                  </button>
                  <button
                    onClick={() => setForm(f => ({ ...f, timing: 'later' }))}
                    className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                      form.timing === 'later'
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-parchment-dark text-ink-muted hover:border-accent/50'
                    }`}
                  >
                    At a specific time
                  </button>
                </div>
                {form.timing === 'later' && (
                  <input
                    type="datetime-local"
                    value={form.runAt}
                    onChange={e => setForm(f => ({ ...f, runAt: e.target.value }))}
                    min={new Date().toISOString().slice(0, 16)}
                    className="mt-2 w-full bg-parchment-sidebar border border-parchment-dark rounded-lg px-3 py-2 text-sm text-ink-primary focus:outline-none focus:border-accent"
                  />
                )}
              </div>
            </div>

            {formError && <p className="text-sm text-red-500">{formError}</p>}

            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={cancelForm}
                className="px-4 py-2 text-sm text-ink-muted hover:text-ink-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {form.timing === 'now' && editingTaskId === null ? 'Run now' : 'Save'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Pending / Scheduled tasks */}
      {pendingTasks.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">Pending</h3>
          <div className="space-y-3">
            {pendingTasks.map(t => (
              <div key={t.id} className="bg-parchment-card rounded-xl border border-parchment-dark">
                {deletingId === t.id ? (
                  <div className="p-5 flex items-center justify-between gap-4">
                    <p className="text-sm text-ink-primary">Delete <span className="font-medium">{t.name}</span>?</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDeletingId(null)}
                        className="px-3 py-1.5 text-xs text-ink-muted hover:text-ink-primary transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDeletePending(t.id)}
                        className="px-3 py-1.5 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <CalendarClock className="w-4 h-4 text-accent shrink-0" />
                        <p className="font-medium text-ink-primary">{t.name}</p>
                      </div>
                      <p className="text-xs text-ink-light mt-1 line-clamp-2">{t.prompt}</p>
                      <p className="text-xs text-ink-muted mt-1">{formatRunAt(t.run_at)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => openEdit(t)}
                        disabled={showForm}
                        className="p-1.5 text-ink-muted hover:text-ink-primary disabled:opacity-40 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingId(t.id)}
                        disabled={showForm}
                        className="p-1.5 text-ink-muted hover:text-red-500 disabled:opacity-40 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Scheduled tasks - manual triggers */}
      {activeSchedules.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">Run Now</h3>
          <div className="space-y-3">
            {activeSchedules.map(s => (
              <div key={s.id} className="bg-parchment-card rounded-xl p-5 border border-parchment-dark flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-ink-primary">{s.name}</h4>
                  <p className="text-sm text-ink-muted mt-0.5">{s.schedule}</p>
                </div>
                <button
                  onClick={() => handleTrigger(s.id)}
                  disabled={!!liveTask || triggering !== null}
                  className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {triggering === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Run now
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active task */}
      <section>
        <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">Active</h3>
        {liveTask ? (
          <div className="bg-accent/5 border border-accent/20 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="w-5 h-5 text-accent animate-spin" />
              <span className="font-medium text-ink-primary">{liveTask.taskName}</span>
            </div>
            <div className="flex gap-6 text-sm text-ink-muted">
              <span>{liveTask.iterations} iterations</span>
              <span>{liveTask.toolCalls} tool calls</span>
            </div>
          </div>
        ) : (
          <div className="bg-parchment-sidebar rounded-xl p-6 text-center">
            <p className="text-ink-muted">No tasks running</p>
            <p className="text-sm text-ink-light mt-1">
              {agentName} rests when his work is done.
            </p>
          </div>
        )}
      </section>

      {/* Archive */}
      <section>
        <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">Archive</h3>
        {tasks.length === 0 ? (
          <div className="bg-parchment-sidebar rounded-xl p-6 text-center">
            <Archive className="w-8 h-8 text-ink-light mx-auto mb-2" />
            <p className="text-ink-muted">No completed tasks yet</p>
            <p className="text-sm text-ink-light mt-1">
              Task history will appear here once {agentName} has run his scheduled tasks.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map(task => (
              <div key={task.id} className="bg-parchment-card rounded-xl p-5 border border-parchment-dark">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(task.status)}
                    <div>
                      <p className="font-medium text-ink-primary">{task.task_name}</p>
                      {task.summary && <p className="text-sm text-ink-muted mt-0.5">{task.summary}</p>}
                    </div>
                  </div>
                  <div className="text-right text-sm text-ink-light shrink-0">
                    <p>{formatTime(task.started_at)}</p>
                    {task.ended_at && <p className="text-xs mt-0.5">{formatDuration(task.started_at, task.ended_at)}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ─── Schedules Tab ────────────────────────────────────────────────────────────

const SCHEDULE_OPTIONS = [
  { value: '0 9 * * *', label: 'Daily at 9:00 AM' },
  { value: '0 20 * * 0', label: 'Sundays at 8:00 PM' },
  { value: '0 * * * *', label: 'Every hour' },
  { value: '*/5 * * * *', label: 'Every 5 minutes' },
  { value: 'custom', label: 'Custom (cron)' },
]

function SchedulesTab() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [toggling, setToggling] = useState<number | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<ScheduleFormState>(EMPTY_SCHEDULE_FORM)
  const [customCron, setCustomCron] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    loadSchedules()
  }, [])

  const loadSchedules = async () => {
    const result = await window.electronAPI.listSchedules()
    setSchedules(result)
  }

  const handleToggle = async (id: number, currentlyActive: boolean) => {
    setToggling(id)
    try {
      await window.electronAPI.toggleSchedule(id, !currentlyActive)
      await loadSchedules()
    } finally {
      setToggling(null)
    }
  }

  const openNew = () => {
    setForm(EMPTY_SCHEDULE_FORM)
    setCustomCron('')
    setFormError(null)
    setEditingId(null)
    setShowForm(true)
  }

  const openEdit = (s: Schedule) => {
    const isPreset = SCHEDULE_OPTIONS.some(opt => opt.value === s.schedule)
    setForm({
      name: s.name,
      prompt: s.prompt,
      schedule: isPreset ? s.schedule : 'custom'
    })
    setCustomCron(isPreset ? '' : s.schedule)
    setFormError(null)
    setEditingId(s.id)
    setShowForm(true)
  }

  const cancelForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormError(null)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Name is required'); return }
    if (!form.prompt.trim()) { setFormError('Prompt is required'); return }

    const scheduleValue = form.schedule === 'custom' ? customCron.trim() : form.schedule
    if (form.schedule === 'custom' && !customCron.trim()) { setFormError('Custom cron expression is required'); return }

    setSaving(true)
    setFormError(null)
    try {
      if (editingId !== null) {
        const res = await window.electronAPI.updateSchedule(editingId, form.name.trim(), scheduleValue, form.prompt.trim())
        if (!res.success) { setFormError(res.error ?? 'Failed to update schedule'); return }
      } else {
        const res = await window.electronAPI.createSchedule(form.name.trim(), scheduleValue, form.prompt.trim())
        if (!res.success) { setFormError(res.error ?? 'Failed to create schedule'); return }
      }
      setShowForm(false)
      setEditingId(null)
      setForm(EMPTY_SCHEDULE_FORM)
      setCustomCron('')
      await loadSchedules()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    const res = await window.electronAPI.deleteSchedule(id)
    if (res.success) {
      setDeletingId(null)
      await loadSchedules()
    }
  }

  const formatSchedule = (cron: string) => {
    if (cron === '*/5 * * * *') return 'Every 5 minutes'
    if (cron === '0 20 * * 0') return 'Sundays at 8:00 PM'
    if (cron === '0 9 * * *') return 'Daily at 9:00 AM'
    if (cron === '0 * * * *') return 'Every hour'
    return cron
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* New Schedule Button */}
      <div className="flex justify-end">
        <button
          onClick={openNew}
          disabled={showForm}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Schedule
        </button>
      </div>

      {/* Create/Edit Schedule Form */}
      {showForm && (
        <section>
          <div className="bg-parchment-card border border-accent/30 rounded-xl p-6 space-y-4">
            <h3 className="font-medium text-ink-primary text-sm">
              {editingId !== null ? 'Edit Schedule' : 'New Schedule'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-ink-muted mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Daily Summary"
                  className="w-full bg-parchment-sidebar border border-parchment-dark rounded-lg px-3 py-2 text-sm text-ink-primary placeholder:text-ink-light focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs text-ink-muted mb-1">Prompt</label>
                <textarea
                  value={form.prompt}
                  onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))}
                  placeholder="What should the agent do on this schedule?"
                  rows={4}
                  className="w-full bg-parchment-sidebar border border-parchment-dark rounded-lg px-3 py-2 text-sm text-ink-primary placeholder:text-ink-light focus:outline-none focus:border-accent resize-none"
                />
              </div>

              <div>
                <label className="block text-xs text-ink-muted mb-2">Schedule</label>
                <div className="grid grid-cols-2 gap-2">
                  {SCHEDULE_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setForm(f => ({ ...f, schedule: value }))}
                      className={`py-2 px-3 text-sm rounded-lg border transition-colors text-left ${
                        form.schedule === value
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-parchment-dark text-ink-muted hover:border-accent/50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {form.schedule === 'custom' && (
                  <input
                    type="text"
                    value={customCron}
                    onChange={e => setCustomCron(e.target.value)}
                    placeholder="e.g. 0 9 * * 1-5 (cron expression)"
                    className="mt-2 w-full bg-parchment-sidebar border border-parchment-dark rounded-lg px-3 py-2 text-sm text-ink-primary placeholder:text-ink-light focus:outline-none focus:border-accent"
                  />
                )}
              </div>
            </div>

            {formError && <p className="text-sm text-red-500">{formError}</p>}

            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={cancelForm}
                className="px-4 py-2 text-sm text-ink-muted hover:text-ink-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editingId !== null ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Schedules List */}
      {schedules.length === 0 ? (
        <div className="bg-parchment-sidebar rounded-xl p-8 text-center">
          <Calendar className="w-10 h-10 text-ink-light mx-auto mb-3" />
          <p className="text-ink-muted font-medium">No schedules yet</p>
          <p className="text-sm text-ink-light mt-1 max-w-sm mx-auto">
            Create a schedule to have your agent run tasks automatically — daily summaries, weekly reviews, or any recurring work.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {schedules.map((s) => (
            <div key={s.id} className="bg-parchment-card rounded-xl border border-parchment-dark hover:border-accent transition-colors">
              {deletingId === s.id ? (
                <div className="p-6 flex items-center justify-between gap-4">
                  <p className="text-sm text-ink-primary">Delete schedule <span className="font-medium">{s.name}</span>?</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDeletingId(null)}
                      className="px-3 py-1.5 text-xs text-ink-muted hover:text-ink-primary transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="px-3 py-1.5 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-ink-primary">{s.name}</h3>
                    <p className="text-sm text-ink-muted mt-1">{formatSchedule(s.schedule)}</p>
                    <p className="text-xs text-ink-light mt-2 line-clamp-2">{s.prompt}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openEdit(s)}
                      disabled={showForm}
                      className="p-1.5 text-ink-muted hover:text-ink-primary disabled:opacity-40 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingId(s.id)}
                      disabled={showForm}
                      className="p-1.5 text-ink-muted hover:text-red-500 disabled:opacity-40 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggle(s.id, s.is_active === 1)}
                      disabled={toggling === s.id}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50"
                      style={
                        s.is_active
                          ? { borderColor: 'var(--color-success)', color: 'var(--color-success)' }
                          : { borderColor: 'var(--color-ink-light)', color: 'var(--color-ink-light)' }
                      }
                    >
                      {toggling === s.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : s.is_active ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <X className="w-3.5 h-3.5" />
                      )}
                      {s.is_active ? 'Active' : 'Paused'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── AgentsView ───────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'prompts', label: 'Prompts', icon: ScrollText },
  { id: 'tasks', label: 'Tasks', icon: Clock },
  { id: 'schedules', label: 'Schedules', icon: Calendar },
]

export function AgentsView() {
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark">
        <div className="flex items-center gap-3">
          <Bot className="w-5 h-5 text-accent" />
          <h2 className="font-serif font-medium text-lg text-ink-primary">Agents</h2>
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
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'prompts' && <PromptsTab />}
        {activeTab === 'tasks' && <TasksTab />}
        {activeTab === 'schedules' && <SchedulesTab />}
      </div>
    </div>
  )
}
