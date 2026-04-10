import { useEffect, useState } from 'react'
import { Clock, Play, Archive, Loader2, CheckCircle, XCircle, AlertCircle, Plus, Pencil, Trash2, CalendarClock } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'

interface TaskRecord {
  id: number
  task_name: string
  started_at: number
  ended_at: number
  status: string
  summary: string
}

interface PendingTask {
  id: number
  name: string
  prompt: string
  run_at: number | null
  status: string
}

interface Schedule {
  id: number
  name: string
  schedule: string
  is_active: number
}

interface LiveTask {
  taskName: string
  status: string
  iterations: number
  toolCalls: number
}

interface TaskFormState {
  name: string
  prompt: string
  timing: 'now' | 'later'
  runAt: string  // datetime-local string
}

const EMPTY_FORM: TaskFormState = { name: '', prompt: '', timing: 'now', runAt: '' }

export function TasksView() {
  const { agentName } = useAppStore()
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [liveTask, setLiveTask] = useState<LiveTask | null>(null)
  const [triggering, setTriggering] = useState<number | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [form, setForm] = useState<TaskFormState>(EMPTY_FORM)
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
    setForm(EMPTY_FORM)
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
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-accent" />
          <h2 className="font-serif font-medium text-lg text-ink-primary">Tasks</h2>
        </div>
        <button
          onClick={openNew}
          disabled={showForm}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Task
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8">

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
              <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">
                Pending
              </h3>
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

          {/* Scheduled tasks — manual triggers */}
          {activeSchedules.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">
                Run Now
              </h3>
              <div className="space-y-3">
                {activeSchedules.map(s => (
                  <div
                    key={s.id}
                    className="bg-parchment-card rounded-xl p-5 border border-parchment-dark flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-medium text-ink-primary">{s.name}</h4>
                      <p className="text-sm text-ink-muted mt-0.5">{s.schedule}</p>
                    </div>
                    <button
                      onClick={() => handleTrigger(s.id)}
                      disabled={!!liveTask || triggering !== null}
                      className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {triggering === s.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      Run now
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Active task */}
          <section>
            <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">
              Active
            </h3>
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
            <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">
              Archive
            </h3>
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
                  <div
                    key={task.id}
                    className="bg-parchment-card rounded-xl p-5 border border-parchment-dark"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(task.status)}
                        <div>
                          <p className="font-medium text-ink-primary">{task.task_name}</p>
                          {task.summary && (
                            <p className="text-sm text-ink-muted mt-0.5">{task.summary}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-sm text-ink-light shrink-0">
                        <p>{formatTime(task.started_at)}</p>
                        {task.ended_at && (
                          <p className="text-xs mt-0.5">{formatDuration(task.started_at, task.ended_at)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  )
}
