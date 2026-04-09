import { Clock, Play, Archive, Calendar } from 'lucide-react'

export function ChapterView() {
  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-accent" />
          <h2 className="font-serif font-medium text-lg text-ink-primary">Chapter</h2>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors">
          <Play className="w-4 h-4" />
          Ring the Bell
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Upcoming */}
          <section>
            <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">
              Upcoming
            </h3>
            <div className="bg-white rounded-xl p-6 border border-parchment-dark">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h4 className="font-medium text-ink-primary">Terce — Triage Folios</h4>
                    <p className="text-sm text-ink-muted">Next run in 4 minutes</p>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 bg-accent/10 text-accent rounded">
                  Scheduled
                </span>
              </div>
            </div>
          </section>

          {/* Active */}
          <section>
            <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">
              Active
            </h3>
            <div className="bg-parchment-sidebar rounded-xl p-6 text-center">
              <p className="text-ink-muted">No tasks running</p>
              <p className="text-sm text-ink-light mt-1">
                Wilfred rests when his work is done.
              </p>
            </div>
          </section>

          {/* Archive */}
          <section>
            <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">
              Archive
            </h3>
            <div className="bg-parchment-sidebar rounded-xl p-6 text-center">
              <Archive className="w-8 h-8 text-ink-light mx-auto mb-2" />
              <p className="text-ink-muted">No completed tasks yet</p>
              <p className="text-sm text-ink-light mt-1">
                Task history will appear here once Wilfred has run his canonical hours.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
