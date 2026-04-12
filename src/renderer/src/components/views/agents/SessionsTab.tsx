import { useEffect, useState } from 'react'
import { MessageSquare, Clock, FileText, Loader2, ChevronRight } from 'lucide-react'
import { AgentChatPanel } from '../../shell/AgentChatPanel.js'

interface ChatSession {
  id: string
  context_type: string
  context_key: string
  created_at: number
  last_message_at: number
}

export function SessionsTab() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null)
  const [isChatOpen, setIsChatOpen] = useState(false)

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    setIsLoading(true)
    try {
      const result = await window.electronAPI.agentChatGetAllSessions()
      if (result.success && result.sessions) {
        setSessions(result.sessions)
      }
    } catch (error) {
      console.error('Failed to load sessions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSessionClick = (session: ChatSession) => {
    setSelectedSession(session)
    setIsChatOpen(true)
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getContextLabel = (contextType: string) => {
    switch (contextType) {
      case 'docs_review':
        return 'Document Review'
      case 'general_chat':
        return 'General Chat'
      default:
        return contextType
    }
  }

  const getContextIcon = (contextType: string) => {
    switch (contextType) {
      case 'docs_review':
        return FileText
      case 'general_chat':
        return MessageSquare
      default:
        return MessageSquare
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <MessageSquare className="w-12 h-12 text-ink-light mb-3" />
        <p className="text-ink-muted text-sm">No chat sessions yet</p>
        <p className="text-ink-light text-xs mt-1">Start a conversation to see it here</p>
      </div>
    )
  }

  return (
    <>
      <div className="max-w-4xl mx-auto">
        <div className="space-y-2">
          {sessions.map((session) => {
            const ContextIcon = getContextIcon(session.context_type)
            
            return (
              <button
                key={session.id}
                onClick={() => handleSessionClick(session)}
                className="w-full bg-parchment-card hover:bg-parchment-sidebar border border-parchment-dark rounded-xl p-4 transition-all hover:shadow-sm group text-left"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2.5 bg-accent/10 rounded-lg shrink-0">
                    <ContextIcon className="w-5 h-5 text-accent" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-medium text-ink-primary truncate">
                        {session.context_key}
                      </h3>
                      <ChevronRight className="w-4 h-4 text-ink-light group-hover:text-accent transition-colors shrink-0 mt-0.5" />
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs text-ink-muted">
                      <span className="px-2 py-0.5 bg-parchment-base rounded-md">
                        {getContextLabel(session.context_type)}
                      </span>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(session.last_message_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {selectedSession && (
        <AgentChatPanel
          isOpen={isChatOpen}
          onClose={() => {
            setIsChatOpen(false)
            loadSessions()
          }}
          contextType={selectedSession.context_type as 'docs_review' | 'general_chat'}
          contextKey={selectedSession.context_key}
          contextFilePath={selectedSession.context_type === 'docs_review' ? selectedSession.context_key : undefined}
        />
      )}
    </>
  )
}
