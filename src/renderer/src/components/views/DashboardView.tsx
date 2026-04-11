import { useState, useEffect, useCallback, useRef } from 'react'
import { Mail, ArrowRight, Clock } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'

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
  const captureRef = useRef<HTMLTextAreaElement>(null)
  const [captureText, setCaptureText] = useState('')
  const [justSaved, setJustSaved] = useState(false)

  // Content cards
  const [onThisDay, setOnThisDay] = useState<{ title: string; path: string; teaser: string } | null>(null)
  const [dormant, setDormant] = useState<{ title: string; path: string; weeks: number }[]>([])

  // Footer
  const [streak, setStreak] = useState(0)
  const [lastThought, setLastThought] = useState<string | null>(null)

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

  // ── Thoughts: dormant + streak + On This Day ───────────────────────────────
  useEffect(() => {
    window.electronAPI.listFiles('_thoughts')
      .then((files) => {
        const thoughts = files
          .filter((f) => !f.isDirectory && f.name.endsWith('.md'))
          .map((f) => ({ name: f.name, path: f.path, date: parseDateFromFilename(f.name) }))
          .filter((t): t is typeof t & { date: Date } => t.date !== null)

        // Dormant: ≥ 2 weeks old, max 4
        const dormantList = thoughts
          .filter((t) => weeksAgo(t.date) >= 2)
          .sort((a, b) => a.date.getTime() - b.date.getTime())
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && document.activeElement === captureRef.current) {
        e.preventDefault()
        handleCapture()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleCapture])

  const openNote = (path: string) => {
    setSelectedFile(path)
    setCurrentView('notes')
  }

  const openChat = () => {
    setAgentChatOpen(true)
  }

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-parchment-base">
      <div className="max-w-2xl mx-auto w-full px-8 py-14 flex flex-col gap-10">

        {/* ── 1. Greeting ─────────────────────────────────────────────────── */}
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-[1.85rem] leading-tight text-ink-primary tracking-tight">
              {getGreeting(userProfile.name)}
            </h1>
            <p className="text-sm text-ink-muted mt-1 font-sans">{dateLabel}</p>
          </div>

          {unreadInbox > 0 && (
            <button
              onClick={() => setCurrentView('inbox')}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-parchment-dark
                         text-sm text-ink-muted hover:text-ink-primary hover:border-ink-muted
                         transition-all duration-150 flex-shrink-0 mt-1"
            >
              <Mail className="w-3.5 h-3.5" />
              <span className="font-sans">Inbox</span>
              <span className="bg-accent text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium font-sans">
                {unreadInbox}
              </span>
            </button>
          )}
        </header>

        {/* ── 2. Wilfred's Observation ─────────────────────────────────────── */}
        <section className="border-l-[2.5px] border-accent pl-5 py-0.5">
          <p className="text-xs font-sans font-medium text-ink-muted tracking-wide mb-2 uppercase">
            {agentName}
          </p>

          {obsLoading ? (
            <div className="space-y-2.5 pr-4">
              <div className="h-[18px] bg-parchment-dark rounded animate-pulse w-[85%]" />
              <div className="h-[18px] bg-parchment-dark rounded animate-pulse w-[60%]" />
            </div>
          ) : obsText ? (
            <>
              <p className="font-serif text-[1.1rem] text-ink-primary leading-relaxed">
                {obsText}
              </p>
              <button
                onClick={openChat}
                className="mt-3 inline-flex items-center gap-1 text-sm text-accent hover:text-accent-hover transition-colors font-sans"
              >
                Explore this <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <p className="font-serif text-[1.1rem] text-ink-muted italic leading-relaxed">
              Still gathering your thoughts…
            </p>
          )}
        </section>

        {/* ── 3. Quick Capture ─────────────────────────────────────────────── */}
        <section className="relative">
          <textarea
            ref={captureRef}
            value={captureText}
            onChange={(e) => setCaptureText(e.target.value)}
            placeholder="What's on your mind?"
            rows={3}
            className="w-full bg-parchment-card border border-parchment-dark rounded-xl
                       px-5 py-4 font-serif text-[1rem] text-ink-primary leading-relaxed
                       placeholder:text-ink-light resize-none
                       focus:outline-none focus:border-ink-muted
                       transition-colors duration-150 caret-accent"
          />
          <div className="absolute bottom-3.5 right-4 flex items-center gap-3">
            {justSaved && (
              <span className="text-xs text-accent font-sans animate-pulse">
                Saved to thoughts
              </span>
            )}
            <button
              onClick={handleCapture}
              disabled={!captureText.trim()}
              className="text-xs text-ink-light hover:text-ink-muted disabled:cursor-not-allowed
                         transition-colors font-sans"
            >
              ⌘↵ Capture
            </button>
          </div>
        </section>

        {/* ── 4. On This Day ───────────────────────────────────────────────── */}
        {onThisDay && (
          <section className="bg-parchment-card border border-parchment-dark rounded-xl p-5 flex flex-col gap-3">
            <p className="text-[10px] font-sans font-medium uppercase tracking-widest text-ink-light">
              On this day
            </p>
            <p className="font-serif text-sm font-medium text-ink-primary leading-snug line-clamp-2">
              {onThisDay.title}
            </p>
            {onThisDay.teaser && (
              <p className="text-xs text-ink-muted font-sans leading-relaxed line-clamp-3">
                {onThisDay.teaser}
              </p>
            )}
            <button
              onClick={() => openNote(onThisDay.path)}
              className="mt-auto inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors font-sans"
            >
              Read it <ArrowRight className="w-3 h-3" />
            </button>
          </section>
        )}

        {/* ── 6. Unfinished Thoughts ───────────────────────────────────────── */}
        {dormant.length > 0 && (
          <section className="bg-parchment-card border border-parchment-dark rounded-xl p-5">
            <p className="text-[10px] font-sans font-medium uppercase tracking-widest text-ink-light mb-4">
              {agentName} wants you to revisit these
            </p>
            <div className="space-y-3.5">
              {dormant.map((item) => (
                <button
                  key={item.path}
                  onClick={() => openNote(item.path)}
                  className="w-full flex items-center justify-between text-left group"
                >
                  <span className="text-sm font-serif text-ink-primary truncate pr-4 group-hover:text-accent transition-colors">
                    {item.title}
                  </span>
                  <span className="text-xs text-ink-light font-sans flex-shrink-0 group-hover:text-ink-muted transition-colors">
                    {item.weeks}w dormant
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── 7. Footer ────────────────────────────────────────────────────── */}
        {(streak > 0 || lastThought) && (
          <footer className="flex items-center gap-3 text-xs text-ink-light font-sans pb-2">
            {streak > 0 && (
              <span>
                You've written {streak} {streak === 1 ? 'day' : 'days'} in a row.
              </span>
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
  )
}
