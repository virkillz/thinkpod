import { useEffect, useState } from 'react'
import {
  Brain, Check, ChevronDown, ChevronRight, FileSearch, BookOpen, Search,
  Globe, Heart, Sparkles, Lightbulb, ClipboardList, BarChart2,
  Play, FlaskConical, Pencil, X, Loader2, AlertCircle, CheckCircle,
  Minus, Clock,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CognitiveJob {
  id: number
  name: string
  schedule: string
  is_active: number
  last_run_at: number | null
  last_run_status: 'done' | 'error' | 'skipped' | null
  last_run_summary: string | null
}

interface DryRunStep {
  categoryId: string
  label: string
  status: 'ok' | 'failed' | 'empty'
  output: unknown
}

interface DryRunResult {
  targetFile: string
  steps: DryRunStep[]
  rawLearningPreview: string
}

interface JobResult {
  processed: number
  skipped: number
  errors: number
  dryRun?: DryRunResult
}

// ─── Job metadata ─────────────────────────────────────────────────────────────

const JOB_META: Record<string, { label: string; description: string; icon: React.ElementType }> = {
  process_new_files: {
    label: 'Process New Files',
    description: 'Reads vault notes and extracts learning across 7 categories using the question battery.',
    icon: FileSearch,
  },
  note_review: {
    label: 'Note Review',
    description: 'Consolidates raw learning into dense learning files and manages open questions.',
    icon: BookOpen,
  },
  question_vault_hunt: {
    label: 'Vault Question Hunt',
    description: 'Searches existing notes to answer open questions tagged for internal search.',
    icon: Search,
  },
  question_web_hunt: {
    label: 'Web Question Hunt',
    description: 'Uses web search to answer open questions tagged for external research.',
    icon: Globe,
  },
  know_your_human: {
    label: 'Know Your Human',
    description: 'Identifies knowledge gaps about you and sends a question to your inbox.',
    icon: Heart,
  },
  random_insight: {
    label: 'Random Insight',
    description: 'Picks a random vault note, finds related files, and surfaces a warm observation.',
    icon: Sparkles,
  },
  inspiration_search: {
    label: 'Inspiration Search',
    description: 'Searches the web on topics from your dense learning files and writes inspiration notes.',
    icon: Lightbulb,
  },
  inspiration_to_plan: {
    label: 'Inspiration to Plan',
    description: 'Reviews recent inspiration notes and generates concrete experiments or ideas.',
    icon: ClipboardList,
  },
  synthesize_week: {
    label: 'Synthesize Week',
    description: "Clusters the week's raw learning notes and writes a weekly synthesis.",
    icon: BarChart2,
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function humanCron(cron: string): string {
  const map: Record<string, string> = {
    '*/30 * * * *': 'Every 30 minutes',
    '0 4 * * *': 'Daily at 4:00 AM',
    '0 2 * * *': 'Daily at 2:00 AM',
    '0 3 * * *': 'Daily at 3:00 AM',
    '0 5 * * *': 'Daily at 5:00 AM',
    '0 8,14,20 * * *': '3× daily (8 AM · 2 PM · 8 PM)',
    '0 10 * * 1,3,5': 'Mon / Wed / Fri at 10:00 AM',
    '0 9 * * 1': 'Mondays at 9:00 AM',
    '0 21 * * 0': 'Sundays at 9:00 PM',
  }
  return map[cron] ?? cron
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─── Dry Run Result Panel ─────────────────────────────────────────────────────

function DryRunPanel({ result, onClose }: { result: DryRunResult; onClose: () => void }) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [showPreview, setShowPreview] = useState(false)

  const toggleStep = (id: string) =>
    setExpandedSteps(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const stepIcon = (status: DryRunStep['status']) => {
    if (status === 'ok') return <CheckCircle className="w-4 h-4 text-success shrink-0" />
    if (status === 'empty') return <Minus className="w-4 h-4 text-ink-muted shrink-0" />
    return <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
  }

  return (
    <div className="mt-3 border border-accent/30 rounded-xl bg-parchment-base overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-parchment-dark bg-parchment-card">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium text-ink-primary">Dry Run Result</span>
        </div>
        <button onClick={onClose} className="p-1 text-ink-muted hover:text-ink-primary transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Target file */}
      {result.targetFile && (
        <div className="px-5 py-2.5 border-b border-parchment-dark bg-parchment-sidebar">
          <span className="text-xs text-ink-muted">File: </span>
          <span className="text-xs font-mono text-ink-primary">{result.targetFile}</span>
        </div>
      )}

      {/* Steps */}
      <div className="divide-y divide-parchment-dark">
        {result.steps.map((step) => (
          <div key={step.categoryId}>
            <button
              onClick={() => toggleStep(step.categoryId)}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-parchment-card/50 transition-colors text-left"
            >
              {stepIcon(step.status)}
              <span className="flex-1 text-sm text-ink-primary">{step.label}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                step.status === 'ok' ? 'bg-success/10 text-success' :
                step.status === 'empty' ? 'bg-ink-light/10 text-ink-muted' :
                'bg-red-100 text-red-500'
              }`}>
                {step.status}
              </span>
              {expandedSteps.has(step.categoryId)
                ? <ChevronDown className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                : <ChevronRight className="w-3.5 h-3.5 text-ink-muted shrink-0" />}
            </button>
            {expandedSteps.has(step.categoryId) && (
              <div className="px-5 pb-4">
                <pre className="text-xs font-mono bg-parchment-sidebar rounded-lg p-3 overflow-x-auto text-ink-primary whitespace-pre-wrap">
                  {step.output !== null ? JSON.stringify(step.output, null, 2) : '(null — validation failed)'}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Raw learning preview toggle */}
      <div className="border-t border-parchment-dark">
        <button
          onClick={() => setShowPreview(p => !p)}
          className="w-full flex items-center gap-2 px-5 py-3 text-sm text-ink-muted hover:text-ink-primary transition-colors"
        >
          {showPreview ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          Raw learning note preview
        </button>
        {showPreview && (
          <div className="px-5 pb-4">
            <pre className="text-xs font-mono bg-parchment-sidebar rounded-lg p-3 overflow-x-auto text-ink-primary whitespace-pre-wrap">
              {result.rawLearningPreview}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Schedule Edit Inline Form ────────────────────────────────────────────────

function ScheduleEditForm({
  currentSchedule,
  onSave,
  onCancel,
}: {
  currentSchedule: string
  onSave: (cron: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(currentSchedule)
  return (
    <div className="mt-3 flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        className="flex-1 bg-parchment-sidebar border border-parchment-dark rounded-lg px-3 py-1.5 text-sm font-mono text-ink-primary focus:outline-none focus:border-accent"
        placeholder="cron expression"
        autoFocus
      />
      <button
        onClick={() => onSave(value.trim())}
        disabled={!value.trim()}
        className="px-3 py-1.5 text-xs bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg transition-colors"
      >
        Save
      </button>
      <button onClick={onCancel} className="px-3 py-1.5 text-xs text-ink-muted hover:text-ink-primary transition-colors">
        Cancel
      </button>
    </div>
  )
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({ job, onRefresh }: { job: CognitiveJob; onRefresh: () => void }) {
  const meta = JOB_META[job.name]
  const Icon = meta?.icon ?? Brain

  const [running, setRunning] = useState(false)
  const [dryRunning, setDryRunning] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState(false)
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  const handleToggle = async () => {
    setToggling(true)
    try {
      await window.electronAPI.toggleCognitiveJob(job.name, job.is_active !== 1)
      onRefresh()
    } finally {
      setToggling(false)
    }
  }

  const handleRun = async () => {
    setRunning(true)
    setRunError(null)
    try {
      const res = await window.electronAPI.triggerCognitiveJob(job.name) as { success: boolean; error?: string; result?: JobResult }
      if (!res.success) setRunError(res.error ?? 'Run failed')
      onRefresh()
    } finally {
      setRunning(false)
    }
  }

  const handleDryRun = async () => {
    setDryRunning(true)
    setDryRunResult(null)
    setRunError(null)
    try {
      const res = await window.electronAPI.dryRunCognitiveJob(job.name) as { success: boolean; error?: string; result?: JobResult }
      if (!res.success) { setRunError(res.error ?? 'Dry run failed'); return }
      if (res.result?.dryRun) setDryRunResult(res.result.dryRun)
    } finally {
      setDryRunning(false)
    }
  }

  const handleSaveSchedule = async (cron: string) => {
    await window.electronAPI.editCognitiveJobSchedule(job.name, cron)
    setEditingSchedule(false)
    onRefresh()
  }

  const statusDot = () => {
    if (!job.last_run_status) return null
    const cls = job.last_run_status === 'done' ? 'bg-success' : job.last_run_status === 'error' ? 'bg-red-400' : 'bg-warning'
    return <span className={`inline-block w-2 h-2 rounded-full ${cls} shrink-0`} />
  }

  const isActive = job.is_active === 1
  const isBusy = running || dryRunning

  return (
    <div className={`bg-parchment-card rounded-xl border transition-colors ${isActive ? 'border-parchment-dark hover:border-accent/40' : 'border-parchment-dark opacity-60'}`}>
      <div className="p-5">
        {/* Top row: icon + title + active toggle */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`mt-0.5 p-2 rounded-lg shrink-0 ${isActive ? 'bg-accent/10 text-accent' : 'bg-parchment-sidebar text-ink-muted'}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-ink-primary text-sm">{meta?.label ?? job.name}</p>
              <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">{meta?.description}</p>
            </div>
          </div>

          {/* Active toggle */}
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border shrink-0 transition-colors disabled:opacity-50 ${
              isActive
                ? 'border-success/40 text-success bg-success/5 hover:bg-success/10'
                : 'border-parchment-dark text-ink-muted hover:border-accent/40'
            }`}
          >
            {toggling ? <Loader2 className="w-3 h-3 animate-spin" /> : isActive ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
            {isActive ? 'Active' : 'Paused'}
          </button>
        </div>

        {/* Schedule + last run row */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>{humanCron(job.schedule)}</span>
            <button onClick={() => setEditingSchedule(e => !e)} className="p-0.5 text-ink-light hover:text-accent transition-colors ml-0.5">
              <Pencil className="w-3 h-3" />
            </button>
          </div>
          {job.last_run_at && (
            <div className="flex items-center gap-1.5">
              {statusDot()}
              <span>Last: {relativeTime(job.last_run_at)}</span>
              {job.last_run_status && <span className="text-ink-light">· {job.last_run_status}</span>}
            </div>
          )}
          {!job.last_run_at && <span className="text-ink-light italic">Never run</span>}
        </div>

        {/* Inline schedule editor */}
        {editingSchedule && (
          <ScheduleEditForm
            currentSchedule={job.schedule}
            onSave={handleSaveSchedule}
            onCancel={() => setEditingSchedule(false)}
          />
        )}

        {/* Action buttons */}
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={handleRun}
            disabled={isBusy}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Run now
          </button>
          <button
            onClick={handleDryRun}
            disabled={isBusy}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-parchment-dark hover:border-accent/50 text-ink-muted hover:text-ink-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {dryRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
            Dry run
          </button>
        </div>

        {/* Error */}
        {runError && (
          <p className="mt-2 text-xs text-red-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {runError}
          </p>
        )}
      </div>

      {/* Dry run result panel */}
      {dryRunResult && (
        <div className="px-5 pb-5">
          <DryRunPanel result={dryRunResult} onClose={() => setDryRunResult(null)} />
        </div>
      )}
    </div>
  )
}

// ─── CognitiveSchedulerTab ────────────────────────────────────────────────────

export function CognitiveSchedulerTab() {
  const [jobs, setJobs] = useState<CognitiveJob[]>([])
  const [loading, setLoading] = useState(true)

  const loadJobs = async () => {
    const result = await window.electronAPI.listCognitiveJobs() as CognitiveJob[]
    setJobs(result)
    setLoading(false)
  }

  useEffect(() => { loadJobs() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-ink-muted">
          System-managed jobs that run on a schedule. Use <span className="font-medium">Dry Run</span> to preview LLM output without writing anything.
        </p>
      </div>

      {jobs.map((job) => (
        <JobCard key={job.name} job={job} onRefresh={loadJobs} />
      ))}

      {jobs.length === 0 && (
        <div className="bg-parchment-sidebar rounded-xl p-8 text-center">
          <Brain className="w-8 h-8 text-ink-light mx-auto mb-3" />
          <p className="text-ink-muted">No cognitive jobs found.</p>
          <p className="text-xs text-ink-light mt-1">They are seeded on first vault open.</p>
        </div>
      )}
    </div>
  )
}
