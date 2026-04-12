import { useState, useEffect, useCallback } from 'react'
import { Mail, Clock, SlidersHorizontal, X } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'
import { WilfredObservation } from './widgets/WilfredObservation.js'
import { QuickCapture } from './widgets/QuickCapture.js'
import { OnThisDay } from './widgets/OnThisDay.js'
import { PickUp } from './widgets/PickUp.js'
import { UnfinishedThoughts } from './widgets/UnfinishedThoughts.js'
import { TopTags } from './widgets/TopTags.js'
import { LastNotes } from './widgets/LastNotes.js'
import { WidgetToggleRow } from './widgets/WidgetToggleRow.js'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WidgetConfig {
  wilfredObservation: boolean
  quickCapture: boolean
  onThisDay: boolean
  pickUp: boolean
  unfinishedThoughts: boolean
  lastNotes: boolean
  topTags: boolean
}

const DEFAULT_WIDGETS: WidgetConfig = {
  wilfredObservation: true,
  quickCapture: true,
  onThisDay: true,
  pickUp: true,
  unfinishedThoughts: true,
  lastNotes: true,
  topTags: false,
}

const WIDGET_LABELS: Record<keyof WidgetConfig, { label: string; description: string; panel: 'main' | 'right' }> = {
  wilfredObservation: { label: "Wilfred's Observation", description: 'A daily insight from your writing patterns', panel: 'main' },
  quickCapture:       { label: 'Quick Capture',         description: 'Capture a thought without leaving the dashboard', panel: 'main' },
  onThisDay:          { label: 'On This Day',           description: 'A note you wrote on this date in a prior year', panel: 'right' },
  pickUp:             { label: 'Pick Up Where You Left Off', description: 'Your most recently created thought', panel: 'right' },
  unfinishedThoughts: { label: 'Unfinished Thoughts',   description: 'Dormant drafts worth revisiting', panel: 'right' },
  lastNotes:          { label: 'Last Notes',            description: 'Your 5 most recently modified notes', panel: 'right' },
  topTags:            { label: 'Top Tags',              description: 'Most frequently used tags in your vault', panel: 'right' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDateFromFilename(name: string): Date | null {
  const m = name.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/)
  if (!m) return null
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`)
}

function slugToTitle(name: string): string {
  return name
    .replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-?/, '')
    .replace(/\.md$/, '')
    .replace(/-/g, ' ')
    .trim() || name.replace(/\.md$/, '')
}

function getGreeting(name: string): string {
  const h = new Date().getHours()
  const tod = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  return `Good ${tod}, ${name}.`
}

function weeksAgo(d: Date): number {
  return Math.floor((Date.now() - d.getTime()) / (7 * 24 * 60 * 60 * 1000))
}

function formatLastThought(ts: number): string {
  const ms = Date.now() - ts * 1000
  const h = Math.floor(ms / 3_600_000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── DashboardView ────────────────────────────────────────────────────────────

export function DashboardView() {
  const {
    userProfile,
    agentName,
    unreadInbox,
    setUnreadInbox,
    setAgentChatOpen,
    setCurrentView,
    setSelectedFile,
  } = useAppStore()

  // Wilfred observation
  const [obsText, setObsText] = useState<string | null>(null)
  const [obsLoading, setObsLoading] = useState(true)

  // Quick capture
  const [captureText, setCaptureText] = useState('')
  const [justSaved, setJustSaved] = useState(false)

  // Right-panel cards
  const [onThisDay, setOnThisDay] = useState<{ title: string; path: string; teaser: string } | null>(null)
  const [pickUp, setPickUp] = useState<{ title: string; path: string; teaser: string; daysAgo: number } | null>(null)
  const [dormant, setDormant] = useState<{ title: string; path: string; weeks: number }[]>([])
  const [lastNotes, setLastNotes] = useState<{ path: string; title: string; modified_at: number }[]>([])
  const [topTags, setTopTags] = useState<{ tag: string; count: number }[]>([])

  // Footer
  const [streak, setStreak] = useState(0)
  const [lastThought, setLastThought] = useState<string | null>(null)

  // Preferences panel
  const [prefOpen, setPrefOpen] = useState(false)
  const [widgets, setWidgets] = useState<WidgetConfig>(DEFAULT_WIDGETS)

  // ── Load widget config ─────────────────────────────────────────────────────
  useEffect(() => {
    window.electronAPI.getSetting('dashboardWidgets')
      .then((val) => { if (val && typeof val === 'object') setWidgets({ ...DEFAULT_WIDGETS, ...val }) })
      .catch(() => {})
  }, [])

  const toggleWidget = (key: keyof WidgetConfig) => {
    const next = { ...widgets, [key]: !widgets[key] }
    setWidgets(next)
    window.electronAPI.setSetting('dashboardWidgets', next).catch(() => {})
  }

  // ── Inbox ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    window.electronAPI.listInbox()
      .then((items) => setUnreadInbox(items.filter((i) => i.status !== 'read').length))
      .catch(() => {})
  }, [setUnreadInbox])

  // ── Agent tasks ────────────────────────────────────────────────────────────
  useEffect(() => {
    window.electronAPI.getAgentTasks()
      .then((tasks) => {
        if (tasks.length > 0) {
          const last = tasks[tasks.length - 1]
          if (last.ended_at) setLastThought(formatLastThought(last.ended_at))
        }
      })
      .catch(() => {})
  }, [])

  // ── Thoughts: pick up + dormant + streak + On This Day ────────────────────
  useEffect(() => {
    window.electronAPI.listFiles('_thoughts')
      .then((files) => {
        const thoughts = files
          .filter((f) => !f.isDirectory && f.name.endsWith('.md'))
          .map((f) => ({ name: f.name, path: f.path, date: parseDateFromFilename(f.name) }))
          .filter((t): t is typeof t & { date: Date } => t.date !== null)
          .sort((a, b) => b.date.getTime() - a.date.getTime()) // newest first

        // Pick Up Where You Left Off: most recently created thought
        const recent = thoughts[0]
        if (recent) {
          const daysAgo = Math.floor((Date.now() - recent.date.getTime()) / (24 * 60 * 60 * 1000))
          window.electronAPI.readFile(recent.path)
            .then(({ content }) =>
              setPickUp({ title: slugToTitle(recent.name), path: recent.path, teaser: content.slice(0, 120).trim(), daysAgo })
            )
            .catch(() => {})
        }

        // Dormant: ≥ 2 weeks old, max 4
        const dormantList = [...thoughts]
          .sort((a, b) => a.date.getTime() - b.date.getTime())
          .filter((t) => weeksAgo(t.date) >= 2)
          .slice(0, 4)
          .map((t) => ({ title: slugToTitle(t.name), path: t.path, weeks: weeksAgo(t.date) }))
        setDormant(dormantList)

        // Writing streak: consecutive days ending today
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const writtenDays = new Set(
          thoughts.map((t) => {
            const d = new Date(t.date)
            d.setHours(0, 0, 0, 0)
            return d.getTime()
          })
        )
        let s = 0
        const cursor = new Date(today)
        while (writtenDays.has(cursor.getTime())) {
          s++
          cursor.setDate(cursor.getDate() - 1)
        }
        setStreak(s)

        // On This Day: same month+day, prior year
        const mm = today.getMonth()
        const dd = today.getDate()
        const priorYear = thoughts.filter(
          (t) => t.date.getMonth() === mm && t.date.getDate() === dd && t.date.getFullYear() < today.getFullYear()
        )
        if (priorYear.length > 0) {
          const pick = priorYear[Math.floor(Math.random() * priorYear.length)]
          window.electronAPI.readFile(pick.path)
            .then(({ content }) =>
              setOnThisDay({ title: slugToTitle(pick.name), path: pick.path, teaser: content.slice(0, 140).trim() })
            )
            .catch(() => {})
        }
      })
      .catch(() => {})
  }, [])

  // ── Last Notes ─────────────────────────────────────────────────────────────
  useEffect(() => {
    window.electronAPI.getRecentFiles(5)
      .then((files) => setLastNotes(files))
      .catch(() => {})
  }, [])

  // ── Top Tags ───────────────────────────────────────────────────────────────
  useEffect(() => {
    window.electronAPI.getStatsOverview()
      .then((data) => setTopTags(data.topTags.slice(0, 10)))
      .catch(() => {})
  }, [])

  // ── Wilfred observation ────────────────────────────────────────────────────
  useEffect(() => {
    setObsLoading(true)
    const prompt =
      `You are ${agentName}, a thoughtful AI writing companion. ` +
      `Generate exactly one short, specific observation (1–2 sentences) about the user's recent writing — ` +
      `a pattern, recurring theme, or unresolved tension worth exploring. ` +
      `Be warm, direct, personal. No preamble. Just the observation.`
    window.electronAPI.agentChat(prompt)
      .then((r) => setObsText(r.success && r.content ? r.content.trim() : null))
      .catch(() => setObsText(null))
      .finally(() => setObsLoading(false))
  }, [agentName])

  // ── Quick capture ──────────────────────────────────────────────────────────
  const handleCapture = useCallback(async () => {
    if (!captureText.trim()) return
    const now = new Date()
    const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const slug =
      captureText.slice(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'thought'
    await window.electronAPI.writeFile(`_thoughts/${ts}-${slug}.md`, captureText)
    setCaptureText('')
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 2200)
  }, [captureText])

  const openNote = (path: string) => {
    setSelectedFile(path)
    setCurrentView('notes')
  }

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const mainWidgets = (Object.keys(WIDGET_LABELS) as (keyof WidgetConfig)[]).filter(k => WIDGET_LABELS[k].panel === 'main')
  const rightWidgets = (Object.keys(WIDGET_LABELS) as (keyof WidgetConfig)[]).filter(k => WIDGET_LABELS[k].panel === 'right')

  return (
    <div className="flex h-full overflow-hidden bg-parchment-base">

      {/* ── Main Panel ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-w-0">
        <div className="max-w-2xl mx-auto w-full px-8 py-14 flex flex-col gap-10">

          {/* Greeting */}
          <header className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-serif text-[1.85rem] leading-tight text-ink-primary tracking-tight">
                {getGreeting(userProfile.name)}
              </h1>
              <p className="text-sm text-ink-muted mt-1 font-sans">{dateLabel}</p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 mt-1">
              {unreadInbox > 0 && (
                <button
                  onClick={() => setCurrentView('inbox')}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-parchment-dark
                             text-sm text-ink-muted hover:text-ink-primary hover:border-ink-muted
                             transition-all duration-150"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span className="font-sans">Inbox</span>
                  <span className="bg-accent text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium font-sans">
                    {unreadInbox}
                  </span>
                </button>
              )}
              <button
                onClick={() => setPrefOpen(true)}
                className="p-1.5 rounded-lg text-ink-light hover:text-ink-muted hover:bg-parchment-dark
                           transition-all duration-150"
                title="Dashboard preferences"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>
          </header>

          {/* Wilfred's Observation */}
          {widgets.wilfredObservation && (
            <WilfredObservation
              agentName={agentName}
              obsLoading={obsLoading}
              obsText={obsText}
              onExplore={() => setAgentChatOpen(true)}
            />
          )}

          {/* Quick Capture */}
          {widgets.quickCapture && (
            <QuickCapture
              captureText={captureText}
              setCaptureText={setCaptureText}
              justSaved={justSaved}
              onCapture={handleCapture}
            />
          )}

          {/* Footer */}
          {(streak > 0 || lastThought) && (
            <footer className="flex items-center gap-3 text-xs text-ink-light font-sans pb-2">
              {streak > 0 && (
                <span>You've written {streak} {streak === 1 ? 'day' : 'days'} in a row.</span>
              )}
              {streak > 0 && lastThought && <span>·</span>}
              {lastThought && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {agentName} last thought: {lastThought}
                </span>
              )}
            </footer>
          )}

        </div>
      </div>

      {/* ── Right Panel ─────────────────────────────────────────────────────── */}
      <aside className="w-72 border-l border-parchment-dark overflow-y-auto flex-shrink-0">
        <div className="px-6 py-14 flex flex-col gap-10">

          {widgets.onThisDay && onThisDay && (
            <OnThisDay item={onThisDay} onOpen={openNote} />
          )}

          {widgets.pickUp && pickUp && (
            <PickUp item={pickUp} onOpen={openNote} />
          )}

          {widgets.unfinishedThoughts && dormant.length > 0 && (
            <UnfinishedThoughts agentName={agentName} dormant={dormant} onOpen={openNote} />
          )}

          {widgets.lastNotes && lastNotes.length > 0 && (
            <LastNotes notes={lastNotes} onOpen={openNote} />
          )}

          {widgets.topTags && topTags.length > 0 && (
            <TopTags tags={topTags} />
          )}

        </div>
      </aside>

      {/* ── Preferences Panel ───────────────────────────────────────────────── */}
      {prefOpen && (
        <>
          {/* Backdrop */}
          <div
            className="absolute inset-0 z-10"
            onClick={() => setPrefOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 top-0 h-full w-80 bg-parchment-sidebar border-l border-parchment-dark
                          shadow-xl z-20 flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-parchment-dark">
              <div>
                <h2 className="font-sans text-sm font-medium text-ink-primary">Dashboard</h2>
                <p className="text-xs text-ink-muted font-sans mt-0.5">Choose what appears on your dashboard</p>
              </div>
              <button
                onClick={() => setPrefOpen(false)}
                className="p-1.5 rounded-lg text-ink-light hover:text-ink-muted hover:bg-parchment-dark transition-all duration-150"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Widget list */}
            <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-8">

              {/* Main panel widgets */}
              <div className="flex flex-col gap-4">
                <p className="text-[10px] font-sans font-medium uppercase tracking-widest text-ink-light">
                  Main panel
                </p>
                <div className="flex flex-col gap-3">
                  {mainWidgets.map((key) => (
                    <WidgetToggleRow
                      key={key}
                      label={WIDGET_LABELS[key].label}
                      description={WIDGET_LABELS[key].description}
                      enabled={widgets[key]}
                      onToggle={() => toggleWidget(key)}
                    />
                  ))}
                </div>
              </div>

              {/* Right panel widgets */}
              <div className="flex flex-col gap-4">
                <p className="text-[10px] font-sans font-medium uppercase tracking-widest text-ink-light">
                  Context panel
                </p>
                <div className="flex flex-col gap-3">
                  {rightWidgets.map((key) => (
                    <WidgetToggleRow
                      key={key}
                      label={WIDGET_LABELS[key].label}
                      description={WIDGET_LABELS[key].description}
                      enabled={widgets[key]}
                      onToggle={() => toggleWidget(key)}
                    />
                  ))}
                </div>
              </div>

            </div>
          </div>
        </>
      )}

    </div>
  )
}
