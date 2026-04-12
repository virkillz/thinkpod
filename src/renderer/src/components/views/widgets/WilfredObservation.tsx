import { ArrowRight } from 'lucide-react'

interface WilfredObservationProps {
  agentName: string
  obsLoading: boolean
  obsText: string | null
  onExplore: () => void
}

export function WilfredObservation({ agentName, obsLoading, obsText, onExplore }: WilfredObservationProps) {
  return (
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
          <p className="font-serif text-[1.1rem] text-ink-primary leading-relaxed">{obsText}</p>
          <button
            onClick={onExplore}
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
  )
}
