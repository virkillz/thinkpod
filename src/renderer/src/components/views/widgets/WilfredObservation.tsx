import { ArrowRight, Quote, Sparkles } from 'lucide-react'
import { useAppStore } from '../../../store/appStore.js'
import { useEffect, useState } from 'react'

interface WilfredObservationProps {
  agentName: string
  obsLoading: boolean
  obsText: string | null
  onExplore: () => void
}

const THINKING_MESSAGES = [
  'Waking up...',
  'Observing...',
  'Thinking...',
  'Connecting the dots...',
  'Gathering insights...',
]

export function WilfredObservation({ agentName, obsLoading, obsText, onExplore }: WilfredObservationProps) {
  const agentAvatar = useAppStore((state) => state.agentAvatar)
  const [thinkingIndex, setThinkingIndex] = useState(0)

  useEffect(() => {
    if (!obsLoading) return
    
    const interval = setInterval(() => {
      setThinkingIndex((prev) => (prev + 1) % THINKING_MESSAGES.length)
    }, 2000)
    
    return () => clearInterval(interval)
  }, [obsLoading])

  return (
    <section className="relative bg-parchment-light border-l-4 border-accent rounded-r-lg p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <img 
            src={agentAvatar} 
            alt={agentName}
            className="w-12 h-12 rounded-full border-2 border-accent/20 shadow-sm"
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <Quote className="w-4 h-4 text-accent/60" />
            <p className="text-xs font-sans font-semibold text-accent tracking-wide uppercase">
              {agentName}
            </p>
          </div>
          
          {obsLoading ? (
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-accent animate-pulse" />
              <p className="font-serif text-[1.1rem] text-ink-muted italic leading-relaxed transition-opacity duration-500">
                {THINKING_MESSAGES[thinkingIndex]}
              </p>
            </div>
          ) : obsText ? (
            <>
              <blockquote className="font-serif text-[1.1rem] text-ink-primary leading-relaxed italic border-l-2 border-accent/30 pl-4">
                "{obsText}"
              </blockquote>
              <button
                onClick={onExplore}
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent-hover transition-colors font-sans font-medium"
              >
                Explore this <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <p className="font-serif text-[1.1rem] text-ink-muted italic leading-relaxed pl-4">
              Still gathering your thoughts…
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
