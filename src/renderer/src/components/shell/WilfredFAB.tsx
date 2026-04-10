import { useState, useEffect } from 'react'
import { useAppStore } from '../../store/appStore.js'
import { WilfredChatPanel } from './WilfredChatPanel.js'

export function WilfredFAB() {
  const { agentAvatar } = useAppStore()
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [showGreeting, setShowGreeting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle')

  useEffect(() => {
    // Show greeting on first load (in real app, check if user has dismissed it)
    const timer = setTimeout(() => {
      setShowGreeting(true)
      setTimeout(() => setShowGreeting(false), 6000)
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  const getStatusColor = () => {
    switch (status) {
      case 'running':
        return 'bg-warning animate-pulse'
      case 'error':
        return 'bg-error'
      default:
        return 'bg-success'
    }
  }

  return (
    <>
      {/* Wilfred Avatar + Chat Button */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        {/* Greeting bubble */}
        {showGreeting && (
          <div className="bg-parchment-card rounded-xl rounded-br-none shadow-lg p-4 max-w-xs text-sm text-ink-muted animate-in fade-in slide-in-from-bottom-2 duration-500">
            "Good morning. Your folios are resting quietly."
          </div>
        )}

        {/* Avatar button */}
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="relative w-14 h-14 bg-accent rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105 animate-breathe overflow-hidden"
        >
          <img
            src={agentAvatar}
            alt="Wilfred"
            className="w-full h-full object-cover"
          />

          {/* Status indicator */}
          <span
            className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-accent ${getStatusColor()}`}
          />
        </button>
      </div>

      {/* Chat Panel */}
      <WilfredChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </>
  )
}
