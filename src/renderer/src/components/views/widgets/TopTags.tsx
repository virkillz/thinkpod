interface TopTagsProps {
  tags: { tag: string; count: number }[]
}

export function TopTags({ tags }: TopTagsProps) {
  const max = tags[0]?.count ?? 1

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] font-sans font-medium uppercase tracking-widest text-ink-light">
        Top tags
      </p>
      <div className="space-y-2">
        {tags.map(({ tag, count }) => (
          <div key={tag} className="flex items-center gap-2">
            <span className="w-24 text-xs text-ink-muted font-sans truncate text-right flex-shrink-0">{tag}</span>
            <div className="flex-1 h-1.5 rounded-full bg-parchment-dark overflow-hidden">
              <div
                className="h-full rounded-full bg-accent/60 transition-all"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
            <span className="w-5 text-[10px] text-ink-light font-sans text-right flex-shrink-0">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
