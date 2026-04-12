interface UnfinishedThoughtsProps {
  agentName: string
  dormant: { title: string; path: string; weeks: number }[]
  onOpen: (path: string) => void
}

export function UnfinishedThoughts({ agentName, dormant, onOpen }: UnfinishedThoughtsProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[10px] font-sans font-medium uppercase tracking-widest text-ink-light">
        {agentName} wants you to revisit
      </p>
      <div className="space-y-4">
        {dormant.map((item) => (
          <button
            key={item.path}
            onClick={() => onOpen(item.path)}
            className="w-full flex items-start justify-between text-left group gap-3"
          >
            <span className="text-xs font-serif text-ink-primary line-clamp-2 group-hover:text-accent transition-colors leading-relaxed">
              {item.title}
            </span>
            <span className="text-[10px] text-ink-light font-sans flex-shrink-0 group-hover:text-ink-muted transition-colors pt-0.5">
              {item.weeks}w
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
