interface WidgetToggleRowProps {
  label: string
  description: string
  enabled: boolean
  onToggle: () => void
}

export function WidgetToggleRow({ label, description, enabled, onToggle }: WidgetToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-sans text-ink-primary">{label}</span>
        <span className="text-xs font-sans text-ink-muted leading-relaxed">{description}</span>
      </div>
      <button
        onClick={onToggle}
        className={`relative w-9 h-5 rounded-full flex-shrink-0 transition-colors duration-200 mt-0.5
                    ${enabled ? 'bg-accent' : 'bg-parchment-dark'}`}
        role="switch"
        aria-checked={enabled}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200
                      ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`}
        />
      </button>
    </div>
  )
}
