import { useEffect, useState } from 'react'
import { Calendar, Check, X, Loader2 } from 'lucide-react'

interface CanonicalHour {
  id: number
  name: string
  schedule: string
  prompt: string
  is_active: number
}

export function HoursView() {
  const [hours, setHours] = useState<CanonicalHour[]>([])
  const [toggling, setToggling] = useState<number | null>(null)

  useEffect(() => {
    loadHours()
  }, [])

  const loadHours = async () => {
    const result = await window.electronAPI.listHours()
    setHours(result)
  }

  const handleToggle = async (id: number, currentlyActive: boolean) => {
    setToggling(id)
    try {
      await window.electronAPI.toggleHour(id, !currentlyActive)
      await loadHours()
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
          <h2 className="font-serif font-medium text-lg text-ink-primary">Canonical Hours</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {hours.length === 0 ? (
            <div className="text-center py-16 text-ink-muted">
              No canonical hours defined.
            </div>
          ) : (
            hours.map((hour) => (
              <div
                key={hour.id}
                className="bg-white rounded-xl p-6 border border-parchment-dark hover:border-accent transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-medium text-ink-primary">{hour.name}</h3>
                    <p className="text-sm text-ink-muted mt-1">
                      {formatSchedule(hour.schedule)}
                    </p>
                    <p className="text-xs text-ink-light mt-2 line-clamp-2">
                      {hour.prompt}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggle(hour.id, hour.is_active === 1)}
                    disabled={toggling === hour.id}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50"
                    style={
                      hour.is_active
                        ? { borderColor: 'var(--color-success)', color: 'var(--color-success)' }
                        : { borderColor: 'var(--color-ink-light)', color: 'var(--color-ink-light)' }
                    }
                  >
                    {toggling === hour.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : hour.is_active ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <X className="w-3.5 h-3.5" />
                    )}
                    {hour.is_active ? 'Active' : 'Paused'}
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
