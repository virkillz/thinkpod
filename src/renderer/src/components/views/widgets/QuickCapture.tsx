import { useRef, useEffect, useCallback } from 'react'

interface QuickCaptureProps {
  captureText: string
  setCaptureText: (text: string) => void
  justSaved: boolean
  onCapture: () => void
}

export function QuickCapture({ captureText, setCaptureText, justSaved, onCapture }: QuickCaptureProps) {
  const captureRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && document.activeElement === captureRef.current) {
        e.preventDefault()
        onCapture()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCapture])

  return (
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
          <span className="text-xs text-accent font-sans animate-pulse">Saved to thoughts</span>
        )}
        <button
          onClick={onCapture}
          disabled={!captureText.trim()}
          className="text-xs text-ink-light hover:text-ink-muted disabled:cursor-not-allowed transition-colors font-sans"
        >
          ⌘↵ Capture
        </button>
      </div>
    </section>
  )
}
