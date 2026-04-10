import { useEffect, useState } from 'react'
import { Bot, User, Clock, Calendar, Save, Check, Loader2, Play, Archive, CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'

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

// ─── Avatar options ───────────────────────────────────────────────────────────

const AVATAR_OPTIONS = ['✦', '✧', '⚜', '🤖', '🦉', '🧙', '🦊', '🔮', '📜', '⚗️', '🌟', '🪄', '🕊️', '🏰', '🌙', '⭐']

const DEFAULT_PROFILE: AgentProfile = {
  name: 'Wilfred',
  avatar: '✦',
  systemPrompt: `You are Wilfred, a diligent monk in the Scriptorium. Your purpose is to organise and tend to the Abbey's manuscripts with care and patience.

Your character:
- Methodical. You work through tasks step by step.
- Humble. When you do not know where something belongs, you ask.
- Brief. Your epistles are clear and concise — a monk does not ramble.
- Faithful. You do exactly what the Rule asks, no more, no less.`,
}

type Tab = 'profile' | 'tasks' | 'schedules'

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab() {
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
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Preview */}
      <div className="bg-white rounded-xl p-6 border border-parchment-dark flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center text-3xl flex-shrink-0">
          {profile.avatar}
        </div>
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
          className="w-full px-4 py-3 bg-white border border-parchment-dark rounded-xl focus:outline-none focus:border-accent text-ink-primary"
        />
      </section>

      {/* Avatar */}
      <section>
        <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-3">Avatar</h3>
        <div className="grid grid-cols-8 gap-2">
          {AVATAR_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => setProfile({ ...profile, avatar: emoji })}
              className={`h-10 w-10 rounded-lg text-xl flex items-center justify-center transition-all ${
                profile.avatar === emoji
                  ? 'bg-accent/15 ring-2 ring-accent'
                  : 'bg-white border border-parchment-dark hover:border-accent hover:bg-accent/5'
              }`}
            >
              {emoji}
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
          className="w-full px-4 py-3 bg-white border border-parchment-dark rounded-xl focus:outline-none focus:border-accent text-ink-primary text-sm font-mono resize-none"
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

// ─── Tasks Tab ────────────────────────────────────────────────────────────────

function TasksTab() {
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [liveTask, setLiveTask] = useState<LiveTask | null>(null)
  const [triggering, setTriggering] = useState<number | null>(null)

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
    const [taskList, scheduleList] = await Promise.all([
      window.electronAPI.getAgentTasks(),
      window.electronAPI.listSchedules(),
    ])
    setTasks(taskList)
    setSchedules(scheduleList)
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

  const formatDuration = (start: number, end: number) => {
    const secs = Math.round((end - start) / 1000)
    if (secs < 60) return `${secs}s`
    return `${Math.floor(secs / 60)}m ${secs % 60}s`
  }

  const formatTime = (ts: number) => new Date(ts).toLocaleString()

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
      {activeSchedules.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">Run Now</h3>
          <div className="space-y-3">
            {activeSchedules.map(s => (
              <div key={s.id} className="bg-white rounded-xl p-5 border border-parchment-dark flex items-center justify-between">
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
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">Archive</h3>
        {tasks.length === 0 ? (
          <div className="bg-parchment-sidebar rounded-xl p-6 text-center">
            <Archive className="w-8 h-8 text-ink-light mx-auto mb-2" />
            <p className="text-ink-muted">No completed tasks yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map(task => (
              <div key={task.id} className="bg-white rounded-xl p-5 border border-parchment-dark">
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

function SchedulesTab() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [toggling, setToggling] = useState<number | null>(null)

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

  const formatSchedule = (cron: string) => {
    if (cron === '*/5 * * * *') return 'Every 5 minutes'
    if (cron === '0 20 * * 0') return 'Sundays at 8:00 PM'
    if (cron === '0 9 * * *') return 'Daily at 9:00 AM'
    if (cron === '0 * * * *') return 'Every hour'
    return cron
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {schedules.length === 0 ? (
        <div className="text-center py-16 text-ink-muted">No scheduled tasks defined.</div>
      ) : (
        schedules.map((s) => (
          <div key={s.id} className="bg-white rounded-xl p-6 border border-parchment-dark hover:border-accent transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-medium text-ink-primary">{s.name}</h3>
                <p className="text-sm text-ink-muted mt-1">{formatSchedule(s.schedule)}</p>
                <p className="text-xs text-ink-light mt-2 line-clamp-2">{s.prompt}</p>
              </div>
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
        ))
      )}
    </div>
  )
}

// ─── AgentsView ───────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Profile', icon: User },
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
        {activeTab === 'tasks' && <TasksTab />}
        {activeTab === 'schedules' && <SchedulesTab />}
      </div>
    </div>
  )
}
