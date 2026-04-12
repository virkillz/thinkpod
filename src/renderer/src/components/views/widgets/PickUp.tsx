import { ArrowRight } from 'lucide-react'

interface PickUpProps {
  item: { title: string; path: string; teaser: string; daysAgo: number }
  onOpen: (path: string) => void
}

export function PickUp({ item, onOpen }: PickUpProps) {
  const daysLabel =
    item.daysAgo === 0 ? 'Today' : item.daysAgo === 1 ? 'Yesterday' : `${item.daysAgo} days ago`

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] font-sans font-medium uppercase tracking-widest text-ink-light">
        Pick up where you left off
      </p>
      <p className="font-serif text-sm font-medium text-ink-primary leading-snug line-clamp-2">
        {item.title}
      </p>
      {item.teaser && (
        <p className="text-xs text-ink-muted font-sans leading-relaxed line-clamp-3">
          {item.teaser}
        </p>
      )}
      <p className="text-[10px] text-ink-light font-sans">{daysLabel}</p>
      <button
        onClick={() => onOpen(item.path)}
        className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors font-sans"
      >
        Continue writing <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  )
}
