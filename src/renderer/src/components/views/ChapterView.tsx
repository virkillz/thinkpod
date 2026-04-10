import { useEffect, useState } from 'react'
import { Clock, Play, Archive, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

interface TaskRecord {
  id: number
  task_name: string
  started_at: number
  ended_at: number
  status: string
  summary: string
}

interface CanonicalHour {
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

export function ChapterView() {
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [hours, setHours] = useState<CanonicalHour[]>([])
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
    const [taskList, hourList] = await Promise.all([
      window.electronAPI.getAgentTasks(),
      window.electronAPI.listHours(),
    ])
    setTasks(taskList)
    setHours(hourList)
  }

  const handleTrigger = async (id: number) => {
    setTriggering(id)
    try {
      await window.electronAPI.triggerHour(id)
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

  const activeHours = hours.filter(h => h.is_active)

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-accent" />
          <h2 className="font-serif font-medium text-lg text-ink-primary">Chapter</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8">

          {/* Canonical Hours — manual triggers */}
          {activeHours.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">
                Ring the Bell
              </h3>
              <div className="space-y-3">
                {activeHours.map(hour => (
                  <div
                    key={hour.id}
                    className="bg-white rounded-xl p-5 border border-parchment-dark flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-medium text-ink-primary">{hour.name}</h4>
                      <p className="text-sm text-ink-muted mt-0.5">{hour.schedule}</p>
                    </div>
                    <button
                      onClick={() => handleTrigger(hour.id)}
                      disabled={!!liveTask || triggering !== null}
                      className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {triggering === hour.id ? (
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
                  Wilfred rests when his work is done.
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
                  Task history will appear here once Wilfred has run his canonical hours.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map(task => (
                  <div
                    key={task.id}
                    className="bg-white rounded-xl p-5 border border-parchment-dark"
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
