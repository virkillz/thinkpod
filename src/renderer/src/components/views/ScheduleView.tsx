import { useEffect, useState } from 'react'
import { Calendar, Check, X, Loader2 } from 'lucide-react'

interface Schedule {
  id: number
  name: string
  schedule: string
  prompt: string
  is_active: number
}

export function ScheduleView() {
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
    <div className="flex-1 flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-accent" />
          <h2 className="font-serif font-medium text-lg text-ink-primary">Schedule</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {schedules.length === 0 ? (
            <div className="text-center py-16 text-ink-muted">
              No scheduled tasks defined.
            </div>
          ) : (
            schedules.map((s) => (
              <div
                key={s.id}
                className="bg-white rounded-xl p-6 border border-parchment-dark hover:border-accent transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-medium text-ink-primary">{s.name}</h3>
                    <p className="text-sm text-ink-muted mt-1">
                      {formatSchedule(s.schedule)}
                    </p>
                    <p className="text-xs text-ink-light mt-2 line-clamp-2">
                      {s.prompt}
                    </p>
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
      </div>
    </div>
  )
}
