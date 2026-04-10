import { useEffect, useState } from 'react'
import { Calendar, Check, X, Loader2, Plus, Pencil, Trash2 } from 'lucide-react'

interface Schedule {
  id: number
  name: string
  schedule: string
  prompt: string
  is_active: number
}

interface FormState {
  name: string
  schedule: string
  customCron: string
  prompt: string
}

const CRON_PRESETS = [
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Daily at 9 AM', value: '0 9 * * *' },
  { label: 'Sundays at 8 PM', value: '0 20 * * 0' },
  { label: 'Custom', value: 'custom' },
]

function formatCron(cron: string): string {
  const preset = CRON_PRESETS.find(p => p.value === cron)
  return preset && preset.value !== 'custom' ? preset.label : cron
}

const EMPTY_FORM: FormState = { name: '', schedule: '*/5 * * * *', customCron: '', prompt: '' }

export function ScheduleView() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [toggling, setToggling] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    setForm(EMPTY_FORM)
    setError(null)
    setEditingId('new')
  }

  const openEdit = (s: Schedule) => {
    const isPreset = CRON_PRESETS.some(p => p.value !== 'custom' && p.value === s.schedule)
    setForm({
      name: s.name,
      schedule: isPreset ? s.schedule : 'custom',
      customCron: isPreset ? '' : s.schedule,
      prompt: s.prompt,
    })
    setError(null)
    setEditingId(s.id)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setError(null)
  }

  const resolvedCron = form.schedule === 'custom' ? form.customCron.trim() : form.schedule

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    if (!resolvedCron) { setError('Cron expression is required'); return }
    if (!form.prompt.trim()) { setError('Prompt is required'); return }

    setSaving(true)
    setError(null)
    try {
      if (editingId === 'new') {
        const res = await window.electronAPI.createSchedule(form.name.trim(), resolvedCron, form.prompt.trim())
        if (!res.success) { setError(res.error ?? 'Failed to create'); return }
      } else {
        const res = await window.electronAPI.updateSchedule(editingId as number, form.name.trim(), resolvedCron, form.prompt.trim())
        if (!res.success) { setError(res.error ?? 'Failed to update'); return }
      }
      setEditingId(null)
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

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-accent" />
          <h2 className="font-serif font-medium text-lg text-ink-primary">Schedule</h2>
        </div>
        <button
          onClick={openNew}
          disabled={editingId !== null}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Schedule
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-4">

          {/* Create / Edit form */}
          {editingId !== null && (
            <div className="bg-parchment-card border border-accent/30 rounded-xl p-6 space-y-4">
              <h3 className="font-medium text-ink-primary text-sm">
                {editingId === 'new' ? 'New Schedule' : 'Edit Schedule'}
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-ink-muted mb-1">Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Weekly reflection"
                    className="w-full bg-parchment-sidebar border border-parchment-dark rounded-lg px-3 py-2 text-sm text-ink-primary placeholder:text-ink-light focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs text-ink-muted mb-1">Frequency</label>
                  <select
                    value={form.schedule}
                    onChange={e => setForm(f => ({ ...f, schedule: e.target.value }))}
                    className="w-full bg-parchment-sidebar border border-parchment-dark rounded-lg px-3 py-2 text-sm text-ink-primary focus:outline-none focus:border-accent"
                  >
                    {CRON_PRESETS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  {form.schedule === 'custom' && (
                    <input
                      type="text"
                      value={form.customCron}
                      onChange={e => setForm(f => ({ ...f, customCron: e.target.value }))}
                      placeholder="e.g. 0 9 * * 1-5"
                      className="mt-2 w-full bg-parchment-sidebar border border-parchment-dark rounded-lg px-3 py-2 text-sm font-mono text-ink-primary placeholder:text-ink-light focus:outline-none focus:border-accent"
                    />
                  )}
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
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={cancelEdit}
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
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Schedule list */}
          {schedules.length === 0 && editingId === null ? (
            <div className="text-center py-16 text-ink-muted">
              No scheduled tasks yet.
            </div>
          ) : (
            schedules.map((s) => (
              <div
                key={s.id}
                className="bg-parchment-card rounded-xl border border-parchment-dark hover:border-accent/40 transition-colors"
              >
                {deletingId === s.id ? (
                  <div className="p-5 flex items-center justify-between gap-4">
                    <p className="text-sm text-ink-primary">Delete <span className="font-medium">{s.name}</span>?</p>
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
                  <div className="p-5 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-ink-primary">{s.name}</h3>
                      <p className="text-sm text-ink-muted mt-0.5">{formatCron(s.schedule)}</p>
                      <p className="text-xs text-ink-light mt-2 line-clamp-2">{s.prompt}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleToggle(s.id, s.is_active === 1)}
                        disabled={toggling === s.id || editingId !== null}
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
                      <button
                        onClick={() => openEdit(s)}
                        disabled={editingId !== null}
                        className="p-1.5 text-ink-muted hover:text-ink-primary disabled:opacity-40 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingId(s.id)}
                        disabled={editingId !== null}
                        className="p-1.5 text-ink-muted hover:text-red-500 disabled:opacity-40 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
