interface LastNotesProps {
  notes: { path: string; title: string; modified_at: number }[]
  onOpen: (path: string) => void
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return `${Math.floor(d / 7)}w ago`
}

export function LastNotes({ notes, onOpen }: LastNotesProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] font-sans font-medium uppercase tracking-widest text-ink-light">
        Last notes
      </p>
      <div className="space-y-3">
        {notes.map((note) => (
          <button
            key={note.path}
            onClick={() => onOpen(note.path)}
            className="w-full flex items-start justify-between text-left group gap-3"
          >
            <span className="text-xs font-serif text-ink-primary line-clamp-1 group-hover:text-accent transition-colors leading-relaxed">
              {note.title || note.path.split('/').pop()?.replace(/\.md$/, '') || note.path}
            </span>
            <span className="text-[10px] text-ink-light font-sans flex-shrink-0 group-hover:text-ink-muted transition-colors pt-0.5">
              {timeAgo(note.modified_at)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
