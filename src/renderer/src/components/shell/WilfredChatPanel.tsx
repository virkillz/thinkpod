import { useState, useRef, useEffect } from 'react'
import { X, Send } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'

interface WilfredChatPanelProps {
  isOpen: boolean
  onClose: () => void
}

interface Message {
  id: string
  role: 'user' | 'wilfred'
  content: string
  timestamp: number
}

export function WilfredChatPanel({ isOpen, onClose }: WilfredChatPanelProps) {
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
      const wilfredResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'wilfred',
        content: result.success && result.content
          ? result.content
          : result.error ?? 'I was unable to respond. Please check the LLM configuration in the Rule page.',
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, wilfredResponse])
    } catch (error) {
      const wilfredResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'wilfred',
        content: 'Something went wrong. Please check the LLM configuration in the Rule page.',
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, wilfredResponse])
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

  if (!isOpen) return null

  return (
    <div className="fixed bottom-24 right-6 z-40 w-96 bg-parchment-card rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-accent text-white">
        <div className="flex items-center gap-2">
          <span className="text-lg">{agentAvatar}</span>
          <span className="font-medium">{agentName}</span>
        </div>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-white/20 rounded-md transition-colors"
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
          <div className="text-center text-ink-muted text-sm py-8">
            Ask {agentName} about your manuscripts,
            <br />
            or request a task.
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                  message.role === 'user'
                    ? 'bg-accent text-white rounded-br-md'
                    : 'bg-parchment-sidebar text-ink-primary rounded-bl-md'
                }`}
              >
                {message.content}
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex justify-start">
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
            className="p-2 bg-accent hover:bg-accent-hover disabled:bg-ink-light disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
