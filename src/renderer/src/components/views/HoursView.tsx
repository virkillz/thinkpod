import { Calendar, Plus, Check, X } from 'lucide-react'

export function HoursView() {
  const hours = [
    {
      id: '1',
      name: 'Terce — Triage Folios',
      schedule: '*/5 * * * *',
      isActive: true,
    },
    {
      id: '2',
      name: 'Vespers — Weekly Reflection',
      schedule: '0 20 * * 0',
      isActive: true,
    },
  ]

  const formatSchedule = (cron: string) => {
    if (cron === '*/5 * * * *') return 'Every 5 minutes'
    if (cron === '0 20 * * 0') return 'Sundays at 8:00 PM'
    return cron
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-accent" />
          <h2 className="font-serif font-medium text-lg text-ink-primary">Canonical Hours</h2>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />
          Add Hour
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {hours.map((hour) => (
            <div
              key={hour.id}
              className="bg-white rounded-xl p-6 border border-parchment-dark hover:border-accent transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-ink-primary">{hour.name}</h3>
                  <p className="text-sm text-ink-muted mt-1">
                    {formatSchedule(hour.schedule)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {hour.isActive ? (
                    <span className="flex items-center gap-1.5 text-xs text-success">
                      <Check className="w-3.5 h-3.5" />
                      Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-ink-light">
                      <X className="w-3.5 h-3.5" />
                      Paused
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
