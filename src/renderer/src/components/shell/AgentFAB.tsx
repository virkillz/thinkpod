import { useState, useEffect } from 'react'
import { useAppStore } from '../../store/appStore.js'
import { AgentChatPanel } from './AgentChatPanel.js'

export function AgentFAB() {
  const { agentAvatar, selectedFile, currentView, isAgentChatOpen, toggleAgentChat, setAgentChatOpen } = useAppStore()
  const [isAnimating, setIsAnimating] = useState(false)
  const [showGreeting, setShowGreeting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle')
  const [serverReachable, setServerReachable] = useState(true)

  useEffect(() => {
    window.electronAPI.getLLMModelInfo().then((info) => {
      setServerReachable(info.serverRunning)
    })
    const unsub = window.electronAPI.onLLMStatus((s: string) => {
      setServerReachable(s === 'ready')
    })
    return unsub
  }, [])

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

  if (currentView === 'newthought') return null

  const getStatusColor = () => {
    if (!serverReachable) return 'bg-error'
    switch (status) {
      case 'running': return 'bg-warning animate-pulse'
      case 'error': return 'bg-error'
      default: return 'bg-success'
    }
  }

  const handleToggleChat = () => {
    setIsAnimating(true)
    toggleAgentChat()
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

        <div className="relative w-14 h-14">
          {/* Animated pulsing rings - behind the button */}
          <span className="absolute inset-0 w-14 h-14 rounded-full bg-accent/20 animate-ping-slow -z-10" />
          <span className="absolute inset-0 w-14 h-14 rounded-full bg-accent/10 animate-pulse-slower -z-10" />
          
          <button
            onClick={handleToggleChat}
            className={`
              relative w-14 h-14 bg-accent rounded-full flex items-center justify-center
              shadow-lg hover:shadow-xl transition-all duration-300 ease-out
              hover:scale-105 animate-breathe
              ${isAnimating ? 'scale-90' : 'scale-100'}
              ${isAgentChatOpen ? 'ring-4 ring-accent/30' : 'ring-0'}
              transition-[box-shadow,transform]
            `}
          >
            <span
              className={`
                absolute inset-0 rounded-full bg-accent/20
                transition-all duration-500 ease-out
                ${isAgentChatOpen && isAnimating ? 'scale-[2.5] opacity-0' : 'scale-100 opacity-0'}
              `}
            />
            <img
              src={agentAvatar}
              alt="Agent"
              className={`
                w-full h-full object-cover rounded-full transition-transform duration-300 ease-out
                ${isAgentChatOpen ? 'scale-90 rotate-6' : 'scale-100 rotate-0'}
              `}
            />
          </button>
          
          {/* Enhanced online indicator with pulse - positioned outside button */}
          <span className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center z-10">
            <span className={`absolute w-5 h-5 rounded-full ${status === 'idle' && serverReachable ? 'bg-success/40 animate-ping-slow' : ''}`} />
            <span
              className={`
                relative w-5 h-5 rounded-full border-2 border-white
                ${getStatusColor()}
                transition-transform duration-300 ease-out
                ${isAnimating ? 'scale-125' : 'scale-100'}
                shadow-lg
              `}
            />
          </span>
        </div>
      </div>

      <div
        className={`
          fixed inset-0 z-30 bg-black/10
          transition-all duration-300 ease-out
          ${isAgentChatOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
        onClick={() => setAgentChatOpen(false)}
      />

      <AgentChatPanel
        isOpen={isAgentChatOpen}
        onClose={() => setAgentChatOpen(false)}
        contextType={contextType}
        contextKey={contextKey}
        contextFilePath={contextFilePath}
        onStatusChange={setStatus}
      />
    </>
  )
}
