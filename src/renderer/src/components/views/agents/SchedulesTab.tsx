import { useEffect, useState } from 'react'
import { Calendar, Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'

interface Schedule {
  id: number
  name: string
  schedule: string
  prompt: string
  is_active: number
}

interface ScheduleFormState {
  name: string
  prompt: string
  schedule: string
}

const EMPTY_SCHEDULE_FORM: ScheduleFormState = { name: '', prompt: '', schedule: '0 9 * * *' }

const SCHEDULE_OPTIONS = [
  { value: '0 9 * * *', label: 'Daily at 9:00 AM' },
  { value: '0 20 * * 0', label: 'Sundays at 8:00 PM' },
  { value: '0 * * * *', label: 'Every hour' },
  { value: '*/5 * * * *', label: 'Every 5 minutes' },
  { value: 'custom', label: 'Custom (cron)' },
]

function formatSchedule(cron: string): string {
  const map: Record<string, string> = {
    '*/5 * * * *': 'Every 5 minutes',
    '0 20 * * 0': 'Sundays at 8:00 PM',
    '0 9 * * *': 'Daily at 9:00 AM',
    '0 * * * *': 'Every hour',
  }
  return map[cron] ?? cron
}

export function SchedulesTab() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [toggling, setToggling] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<ScheduleFormState>(EMPTY_SCHEDULE_FORM)
  const [customCron, setCustomCron] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => { loadSchedules() }, [])

  const loadSchedules = async () => {
    const result = await window.electronAPI.listSchedules()
    setSchedules(result)
  }

  const handleToggle = async (id: number, currentlyActive: boolean) => {
    setToggling(id)
    try { await window.electronAPI.toggleSchedule(id, !currentlyActive); await loadSchedules() }
    finally { setToggling(null) }
  }

  const openNew = () => { setForm(EMPTY_SCHEDULE_FORM); setCustomCron(''); setFormError(null); setEditingId(null); setShowForm(true) }
  const openEdit = (s: Schedule) => {
    const isPreset = SCHEDULE_OPTIONS.some(opt => opt.value === s.schedule)
    setForm({ name: s.name, prompt: s.prompt, schedule: isPreset ? s.schedule : 'custom' })
    setCustomCron(isPreset ? '' : s.schedule)
    setFormError(null); setEditingId(s.id); setShowForm(true)
  }
  const cancelForm = () => { setShowForm(false); setEditingId(null); setFormError(null) }

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Name is required'); return }
    if (!form.prompt.trim()) { setFormError('Prompt is required'); return }
    const scheduleValue = form.schedule === 'custom' ? customCron.trim() : form.schedule
    if (form.schedule === 'custom' && !customCron.trim()) { setFormError('Custom cron expression is required'); return }
    setSaving(true); setFormError(null)
    try {
      if (editingId !== null) {
        const res = await window.electronAPI.updateSchedule(editingId, form.name.trim(), scheduleValue, form.prompt.trim())
        if (!res.success) { setFormError(res.error ?? 'Failed to update schedule'); return }
      } else {
        const res = await window.electronAPI.createSchedule(form.name.trim(), scheduleValue, form.prompt.trim())
        if (!res.success) { setFormError(res.error ?? 'Failed to create schedule'); return }
      }
      setShowForm(false); setEditingId(null); setForm(EMPTY_SCHEDULE_FORM); setCustomCron(''); await loadSchedules()
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    const res = await window.electronAPI.deleteSchedule(id)
    if (res.success) { setDeletingId(null); await loadSchedules() }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex justify-end">
        <button onClick={openNew} disabled={showForm} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors">
          <Plus className="w-4 h-4" /> New Schedule
        </button>
      </div>

      {showForm && (
        <section>
          <div className="bg-parchment-card border border-accent/30 rounded-xl p-6 space-y-4">
            <h3 className="font-medium text-ink-primary text-sm">{editingId !== null ? 'Edit Schedule' : 'New Schedule'}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-ink-muted mb-1">Name</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Daily Summary" className="w-full bg-parchment-sidebar border border-parchment-dark rounded-lg px-3 py-2 text-sm text-ink-primary placeholder:text-ink-light focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-xs text-ink-muted mb-1">Prompt</label>
                <textarea value={form.prompt} onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))} placeholder="What should the agent do on this schedule?" rows={4} className="w-full bg-parchment-sidebar border border-parchment-dark rounded-lg px-3 py-2 text-sm text-ink-primary placeholder:text-ink-light focus:outline-none focus:border-accent resize-none" />
              </div>
              <div>
                <label className="block text-xs text-ink-muted mb-2">Schedule</label>
                <div className="grid grid-cols-2 gap-2">
                  {SCHEDULE_OPTIONS.map(({ value, label }) => (
                    <button key={value} onClick={() => setForm(f => ({ ...f, schedule: value }))} className={`py-2 px-3 text-sm rounded-lg border transition-colors text-left ${form.schedule === value ? 'border-accent bg-accent/10 text-accent' : 'border-parchment-dark text-ink-muted hover:border-accent/50'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {form.schedule === 'custom' && (
                  <input type="text" value={customCron} onChange={e => setCustomCron(e.target.value)} placeholder="e.g. 0 9 * * 1-5 (cron expression)" className="mt-2 w-full bg-parchment-sidebar border border-parchment-dark rounded-lg px-3 py-2 text-sm text-ink-primary placeholder:text-ink-light focus:outline-none focus:border-accent" />
                )}
              </div>
            </div>
            {formError && <p className="text-sm text-red-500">{formError}</p>}
            <div className="flex items-center gap-2 justify-end">
              <button onClick={cancelForm} className="px-4 py-2 text-sm text-ink-muted hover:text-ink-primary transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editingId !== null ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </section>
      )}

      {schedules.length === 0 ? (
        <div className="bg-parchment-sidebar rounded-xl p-8 text-center">
          <Calendar className="w-10 h-10 text-ink-light mx-auto mb-3" />
          <p className="font-serif italic text-ink-primary mb-2">"Time, once harnessed, becomes your ally."</p>
          <p className="text-xs text-ink-muted max-w-sm mx-auto">Create a schedule for daily summaries, weekly reviews, or any recurring task.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {schedules.map((s) => (
            <div key={s.id} className="bg-parchment-card rounded-xl border border-parchment-dark hover:border-accent transition-colors">
              {deletingId === s.id ? (
                <div className="p-6 flex items-center justify-between gap-4">
                  <p className="text-sm text-ink-primary">Delete schedule <span className="font-medium">{s.name}</span>?</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setDeletingId(null)} className="px-3 py-1.5 text-xs text-ink-muted hover:text-ink-primary transition-colors">Cancel</button>
                    <button onClick={() => handleDelete(s.id)} className="px-3 py-1.5 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">Delete</button>
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
                    <button onClick={() => openEdit(s)} disabled={showForm} className="p-1.5 text-ink-muted hover:text-ink-primary disabled:opacity-40 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeletingId(s.id)} disabled={showForm} className="p-1.5 text-ink-muted hover:text-red-500 disabled:opacity-40 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    <button
                      onClick={() => handleToggle(s.id, s.is_active === 1)}
                      disabled={toggling === s.id}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50"
                      style={s.is_active ? { borderColor: 'var(--color-success)', color: 'var(--color-success)' } : { borderColor: 'var(--color-ink-light)', color: 'var(--color-ink-light)' }}
                    >
                      {toggling === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : s.is_active ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
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
