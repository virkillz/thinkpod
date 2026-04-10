import { useState, useEffect } from 'react'
import { useAppStore } from '../../store/appStore.js'
import { AgentChatPanel } from './AgentChatPanel.js'

export function AgentFAB() {
  const { agentAvatar, selectedFile, currentView } = useAppStore()
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [showGreeting, setShowGreeting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle')

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowGreeting(true)
      setTimeout(() => setShowGreeting(false), 6000)
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  // Derive context from current state
  const contextType = (currentView === 'notes' && selectedFile) ? 'docs_review' : 'general_chat'
  const contextKey = contextType === 'docs_review' ? selectedFile! : '__general__'
  const contextFilePath = contextType === 'docs_review' ? selectedFile! : undefined

  const getStatusColor = () => {
    switch (status) {
      case 'running': return 'bg-warning animate-pulse'
      case 'error': return 'bg-error'
      default: return 'bg-success'
    }
  }

  const handleToggleChat = () => {
    setIsAnimating(true)
    setIsChatOpen(!isChatOpen)
    setTimeout(() => setIsAnimating(false), 300)
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        {showGreeting && (
          <div className="bg-parchment-card rounded-xl rounded-br-none shadow-lg p-4 max-w-xs text-sm text-ink-muted animate-in fade-in slide-in-from-bottom-2 duration-500">
            "Good morning. Your folios are resting quietly."
          </div>
        )}

        <button
          onClick={handleToggleChat}
          className={`
            relative w-14 h-14 bg-accent rounded-full flex items-center justify-center
            shadow-lg hover:shadow-xl transition-all duration-300 ease-out
            hover:scale-105 animate-breathe overflow-hidden
            ${isAnimating ? 'scale-90' : 'scale-100'}
            ${isChatOpen ? 'ring-4 ring-accent/30' : 'ring-0'}
            transition-[box-shadow,transform]
          `}
        >
          <span
            className={`
              absolute inset-0 rounded-full bg-accent/20
              transition-all duration-500 ease-out
              ${isChatOpen && isAnimating ? 'scale-[2.5] opacity-0' : 'scale-100 opacity-0'}
            `}
          />
          <img
            src={agentAvatar}
            alt="Agent"
            className={`
              w-full h-full object-cover transition-transform duration-300 ease-out
              ${isChatOpen ? 'scale-90 rotate-6' : 'scale-100 rotate-0'}
            `}
          />
          <span
            className={`
              absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-accent
              ${getStatusColor()}
              transition-transform duration-300 ease-out
              ${isAnimating ? 'scale-125' : 'scale-100'}
            `}
          />
        </button>
      </div>

      <div
        className={`
          fixed inset-0 z-30 bg-black/10
          transition-all duration-300 ease-out
          ${isChatOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
        onClick={() => setIsChatOpen(false)}
      />

      <AgentChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        contextType={contextType}
        contextKey={contextKey}
        contextFilePath={contextFilePath}
        onStatusChange={setStatus}
      />
    </>
  )
}
