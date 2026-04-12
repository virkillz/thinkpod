import { ArrowRight } from 'lucide-react'

interface OnThisDayProps {
  item: { title: string; path: string; teaser: string }
  onOpen: (path: string) => void
}

export function OnThisDay({ item, onOpen }: OnThisDayProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] font-sans font-medium uppercase tracking-widest text-ink-light">
        On this day
      </p>
      <p className="font-serif text-sm font-medium text-ink-primary leading-snug line-clamp-2">
        {item.title}
      </p>
      {item.teaser && (
        <p className="text-xs text-ink-muted font-sans leading-relaxed line-clamp-3">
          {item.teaser}
        </p>
      )}
      <button
        onClick={() => onOpen(item.path)}
        className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors font-sans"
      >
        Read it <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  )
}
