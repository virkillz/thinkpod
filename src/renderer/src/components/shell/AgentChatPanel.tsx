import { useState, useRef, useEffect } from 'react'
import { X, Send } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'

// Custom hook for exit animation
function useExitAnimation(isOpen: boolean, duration: number = 200) {
  const [shouldRender, setShouldRender] = useState(isOpen)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsExiting(false)
      setShouldRender(true)
    } else {
      setIsExiting(true)
      const timer = setTimeout(() => setShouldRender(false), duration)
      return () => clearTimeout(timer)
    }
  }, [isOpen, duration])

  return { shouldRender, isExiting }
}

interface AgentChatPanelProps {
  isOpen: boolean
  onClose: () => void
}

interface Message {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: number
}

export function AgentChatPanel({ isOpen, onClose }: AgentChatPanelProps) {
  const { agentName, agentAvatar } = useAppStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const text = input.trim()
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const result = await window.electronAPI.agentChat(text)
      const agentResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: result.success && result.content
          ? result.content
          : result.error ?? 'I was unable to respond. Please check the LLM configuration in the Rule page.',
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, agentResponse])
    } catch (error) {
      const agentResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: 'Something went wrong. Please check the LLM configuration in the Rule page.',
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, agentResponse])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const { shouldRender, isExiting } = useExitAnimation(isOpen, 250)

  if (!shouldRender) return null

  return (
    <div 
      className={`
        fixed bottom-24 right-6 z-40 w-96 bg-parchment-card rounded-2xl shadow-2xl overflow-hidden
        transition-all duration-250 ease-out origin-bottom-right
        ${isExiting 
          ? 'opacity-0 scale-95 translate-y-2' 
          : 'opacity-100 scale-100 translate-y-0 animate-in zoom-in-95 slide-in-from-bottom-4 fade-in duration-250'}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-accent text-white">
        <div className="flex items-center gap-2">
          <img
            src={agentAvatar}
            alt={agentName}
            className="w-7 h-7 rounded-full object-cover border border-white/30"
          />
          <span className="font-medium">{agentName}</span>
        </div>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-white/20 rounded-md transition-all duration-200 hover:rotate-90 active:scale-90"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="h-80 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className={`
            text-center text-ink-muted text-sm py-8
            transition-all duration-300
            ${isExiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0 animate-in fade-in slide-in-from-bottom-2 duration-500'}
          `}>
            Ask {agentName} about your manuscripts,
            <br />
            or request a task.
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={message.id}
              className={`
                flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}
                transition-all duration-300 ease-out
                ${isExiting ? 'opacity-0 translate-x-2' : 'opacity-100 translate-x-0'}
                ${!isExiting ? 'animate-in fade-in slide-in-from-bottom-2' : ''}
              `}
              style={{ 
                animationDelay: !isExiting ? `${index * 30}ms` : '0ms',
                animationDuration: !isExiting ? '300ms' : undefined
              }}
            >
              <div
                className={`
                  max-w-[80%] px-4 py-2 rounded-2xl text-sm
                  transition-transform duration-200 ease-out hover:scale-[1.02]
                  ${message.role === 'user'
                    ? 'bg-accent text-white rounded-br-md'
                    : 'bg-parchment-sidebar text-ink-primary rounded-bl-md'}
                `}
              >
                {message.content}
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-parchment-sidebar px-4 py-2 rounded-2xl rounded-bl-md">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-ink-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-ink-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-ink-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-parchment-dark">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${agentName}…`}
            className="flex-1 px-3 py-2 bg-parchment-base rounded-lg border border-parchment-dark focus:outline-none focus:border-accent text-sm"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-2 bg-accent hover:bg-accent-hover disabled:bg-ink-light disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 disabled:hover:scale-100"
          >
            <Send className={`
              w-4 h-4 transition-transform duration-200
              ${isLoading ? 'animate-pulse' : ''}
            `} />
          </button>
        </div>
      </div>
    </div>
  )
}
