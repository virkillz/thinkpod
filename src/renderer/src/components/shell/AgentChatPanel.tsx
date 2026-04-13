import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, RotateCcw, ScrollText, Wrench, AlertTriangle, MessageSquare, Check, Loader2, StopCircle } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'

const TOOL_LABELS: Record<string, string> = {
  read_file: 'Reading file',
  write_file: 'Writing file',
  move_file: 'Moving file',
  list_files: 'Listing files',
  add_comment: 'Adding comment',
  write_inbox: 'Writing inbox',
}

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

export interface AgentChatPanelProps {
  isOpen: boolean
  onClose: () => void
  contextType: 'docs_review' | 'general_chat' | 'personalization'
  contextKey: string
  contextFilePath?: string
  onStatusChange?: (status: 'idle' | 'running' | 'error') => void
  forceNew?: boolean
}

interface UIMessage {
  id: string
  role: 'user' | 'agent' | 'tool_error'
  content: string
  ts: number
  toolName?: string
}

// ─── System Prompt Modal ──────────────────────────────────────────────────────

function SystemPromptModal({
  systemPrompt,
  contextType,
  onClose,
}: {
  systemPrompt: string
  contextType: string
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-parchment-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[70vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-parchment-dark">
          <div>
            <p className="font-medium text-ink-primary text-sm">System Prompt</p>
            <p className="text-xs text-ink-muted mt-0.5">{contextType}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-parchment-sidebar rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-ink-muted" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <pre className="text-xs font-mono text-ink-primary whitespace-pre-wrap leading-relaxed">
            {systemPrompt}
          </pre>
        </div>
      </div>
    </div>
  )
}

// ─── AgentChatPanel ───────────────────────────────────────────────────────────

export function AgentChatPanel({
  isOpen,
  onClose,
  contextType,
  contextKey,
  contextFilePath,
  onStatusChange,
  forceNew = false,
}: AgentChatPanelProps) {
  const { agentName, agentAvatar, initialAgentMessage, setInitialAgentMessage, setCurrentView } = useAppStore()
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null)
  const [showSystemPrompt, setShowSystemPrompt] = useState(false)
  const [isSessionLoading, setIsSessionLoading] = useState(false)
  const [currentTool, setCurrentTool] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Personalization: summarize flow
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [summaryPreview, setSummaryPreview] = useState<string | null>(null)
  const [isSavingSummary, setIsSavingSummary] = useState(false)

  // Track the context that was used to open the current session so we can
  // detect when the user switches documents while the panel is open.
  const openedContextKey = useRef<string | null>(null)

  // Subscribe to tool-use push events from the main process
  useEffect(() => {
    const unsub = window.electronAPI.onChatToolUse(({ sessionId: sid, toolName }) => {
      if (sid === sessionId) setCurrentTool(toolName)
    })
    return unsub
  }, [sessionId])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Open or resume a session when the panel opens or the context changes
  const openSession = useCallback(async () => {
    setIsSessionLoading(true)
    try {
      const result = (forceNew
        ? await window.electronAPI.agentChatNew(contextType, contextKey, contextFilePath)
        : await window.electronAPI.agentChatOpen(contextType, contextKey, contextFilePath)) as Awaited<ReturnType<typeof window.electronAPI.agentChatOpen>>
      if (!result.success || !result.sessionId) return

      openedContextKey.current = contextKey
      setSessionId(result.sessionId)

      // Restore history from JSONL — chat bubbles + failed tool calls as inline indicators
      const history = result.history ?? []
      const historyMessages: UIMessage[] = history
        .filter(m => m.role === 'user' || m.role === 'assistant' || (m.role === 'tool_result' && m.toolSuccess === false))
        .map(m => ({
          id: `${m.ts}-${m.role}`,
          role: (m.role === 'user' ? 'user' : m.role === 'tool_result' ? 'tool_error' : 'agent') as 'user' | 'agent' | 'tool_error',
          content: m.content,
          ts: m.ts,
          toolName: m.toolName,
        }))

      setMessages(historyMessages)

      // Pre-fetch system prompt for the view button
      const spResult = await window.electronAPI.agentChatGetSystemPrompt(result.sessionId)
      if (spResult.success && spResult.systemPrompt) {
        setSystemPrompt(spResult.systemPrompt)
      }

      // Personalization sessions return an openingMessage on first open —
      // the fabricated user trigger was sent silently; show only the agent reply.
      const openingMessage = (result as Record<string, unknown>).openingMessage as string | undefined
      if (openingMessage) {
        const openingMsg: UIMessage = {
          id: Date.now().toString(),
          role: 'agent',
          content: openingMessage,
          ts: Date.now(),
        }
        setMessages([openingMsg])
        setIsSessionLoading(false)
        return
      }

      // If there's an initial agent message and no history, send it to the agent
      if (initialAgentMessage && historyMessages.length === 0) {
        setInitialAgentMessage(null)
        setIsSessionLoading(false)
        
        // Send the observation as a user message to give agent context
        const userMsg: UIMessage = { 
          id: Date.now().toString(), 
          role: 'user', 
          content: `I'd like to explore this observation you made: "${initialAgentMessage}"`, 
          ts: Date.now() 
        }
        setMessages([userMsg])
        setIsLoading(true)
        onStatusChange?.('running')

        try {
          const sendResult = await window.electronAPI.agentChatSend(result.sessionId, userMsg.content)
          setCurrentTool(null)
          const agentMsg: UIMessage = {
            id: (Date.now() + 1).toString(),
            role: 'agent',
            content: sendResult.success && sendResult.content
              ? sendResult.content
              : sendResult.error ?? 'I was unable to respond. Please check the LLM configuration.',
            ts: Date.now(),
          }
          const errorMsgs: UIMessage[] = (sendResult.toolErrors ?? []).map(e => ({
            id: `${e.ts}-tool_error`,
            role: 'tool_error',
            content: e.error,
            ts: e.ts,
            toolName: e.toolName,
          }))
          setMessages([userMsg, agentMsg, ...errorMsgs])
          onStatusChange?.('idle')
        } catch {
          setCurrentTool(null)
          setMessages(prev => [
            ...prev,
            { id: (Date.now() + 1).toString(), role: 'agent', content: 'Something went wrong.', ts: Date.now() },
          ])
          onStatusChange?.('error')
        } finally {
          setIsLoading(false)
        }
        return
      }
    } finally {
      setIsSessionLoading(false)
    }
  }, [contextType, contextKey, contextFilePath, forceNew, initialAgentMessage, setInitialAgentMessage, onStatusChange])

  useEffect(() => {
    if (!isOpen) return
    // Re-open session if panel opens or the document context changed
    if (openedContextKey.current !== contextKey) {
      openSession()
    }
  }, [isOpen, contextKey, openSession])

  const handleSend = async () => {
    if (!input.trim() || isLoading || !sessionId) return

    const text = input.trim()
    const userMsg: UIMessage = { id: Date.now().toString(), role: 'user', content: text, ts: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)
    onStatusChange?.('running')

    try {
      const result = await window.electronAPI.agentChatSend(sessionId, text)
      setCurrentTool(null)
      const agentMsg: UIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: result.success && result.content
          ? result.content
          : result.error ?? 'I was unable to respond. Please check the LLM configuration.',
        ts: Date.now(),
      }
      const errorMsgs: UIMessage[] = (result.toolErrors ?? []).map(e => ({
        id: `${e.ts}-tool_error`,
        role: 'tool_error',
        content: e.error,
        ts: e.ts,
        toolName: e.toolName,
      }))
      setMessages(prev => [...prev, agentMsg, ...errorMsgs])
      onStatusChange?.('idle')
    } catch {
      setCurrentTool(null)
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'agent', content: 'Something went wrong.', ts: Date.now() },
      ])
      onStatusChange?.('error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearSession = async () => {
    if (!sessionId) return
    const result = await window.electronAPI.agentChatNew(contextType, contextKey, contextFilePath)
    if (!result.success || !result.sessionId) return

    openedContextKey.current = contextKey
    setSessionId(result.sessionId)
    setMessages([])

    const spResult = await window.electronAPI.agentChatGetSystemPrompt(result.sessionId)
    if (spResult.success && spResult.systemPrompt) {
      setSystemPrompt(spResult.systemPrompt)
    }
  }

  const handleSummarize = async () => {
    if (!sessionId) return
    setIsSummarizing(true)
    try {
      const result = await window.electronAPI.summarizePersonalization(sessionId, contextKey)
      if (result.success && result.summary) {
        setSummaryPreview(result.summary)
      }
    } finally {
      setIsSummarizing(false)
    }
  }

  const handleSaveSummary = async () => {
    if (!summaryPreview) return
    setIsSavingSummary(true)
    try {
      await window.electronAPI.writePersonalizationTopic(contextKey, summaryPreview)
      setSummaryPreview(null)
      onClose()
    } finally {
      setIsSavingSummary(false)
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
    <>
      {showSystemPrompt && systemPrompt && (
        <SystemPromptModal
          systemPrompt={systemPrompt}
          contextType={contextType}
          onClose={() => setShowSystemPrompt(false)}
        />
      )}

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
            <div>
              <span className="font-medium text-sm">{agentName}</span>
              {contextType === 'docs_review' && (
                <p className="text-xs text-white/60 leading-none mt-0.5">Reviewing document</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* View all sessions */}
            <button
              onClick={() => {
                setCurrentView('agents')
                onClose()
              }}
              title="View all sessions"
              className="p-1.5 hover:bg-white/20 rounded-md transition-all duration-200"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            {/* View system prompt */}
            <button
              onClick={() => setShowSystemPrompt(true)}
              disabled={!systemPrompt}
              title="View system prompt"
              className="p-1.5 hover:bg-white/20 rounded-md transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ScrollText className="w-4 h-4" />
            </button>
            {/* Clear session */}
            <button
              onClick={handleClearSession}
              disabled={isLoading || isSessionLoading}
              title="Start new conversation"
              className="p-1.5 hover:bg-white/20 rounded-md transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-md transition-all duration-200 hover:rotate-90 active:scale-90"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="h-80 overflow-y-auto p-4 space-y-4">
          {isSessionLoading ? (
            <div className="flex items-center justify-center h-full text-ink-muted text-sm">
              Loading conversation…
            </div>
          ) : messages.length === 0 ? (
            <div className={`
              text-center text-ink-muted text-sm py-8
              transition-all duration-300
              ${isExiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0 animate-in fade-in slide-in-from-bottom-2 duration-500'}
            `}>
              {contextType === 'docs_review'
                ? <>
                    <p className="font-serif italic text-ink-primary mb-2">"What shall we make of this?"</p>
                    <p className="text-xs">Bounce ideas, explore angles, or deepen your thinking — {agentName} is your sparring partner.</p>
                  </>
                : <>
                    <p className="font-serif italic text-ink-primary mb-2">"A thought unspoken is a seed unsown."</p>
                    <p className="text-xs">Brainstorm ideas, explore possibilities, or think through something together.</p>
                  </>}
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
                  animationDuration: !isExiting ? '300ms' : undefined,
                }}
              >
                {message.role === 'tool_error' ? (
                  <details className="w-full group">
                    <summary className="flex items-center gap-1.5 text-xs text-amber-600 cursor-pointer select-none list-none">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>Tool failed: <span className="font-mono">{message.toolName ?? 'unknown'}</span></span>
                    </summary>
                    <p className="mt-1 ml-4.5 text-xs font-mono text-ink-muted whitespace-pre-wrap break-all bg-parchment-base rounded-lg px-2 py-1.5">
                      {message.content}
                    </p>
                  </details>
                ) : (
                  <div
                    className={`
                      max-w-[80%] px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap
                      transition-transform duration-200 ease-out hover:scale-[1.02]
                      ${message.role === 'user'
                        ? 'bg-accent text-white rounded-br-md'
                        : 'bg-parchment-sidebar text-ink-primary rounded-bl-md'}
                    `}
                  >
                    {message.content}
                  </div>
                )}
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-parchment-sidebar px-4 py-2.5 rounded-2xl rounded-bl-md">
                {currentTool ? (
                  <div className="flex items-center gap-2 text-xs text-ink-muted">
                    <Wrench className="w-3 h-3 animate-pulse shrink-0" />
                    <span className="animate-pulse">{TOOL_LABELS[currentTool] ?? currentTool}…</span>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-ink-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-ink-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-ink-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
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
              disabled={isSessionLoading || !sessionId}
              className="flex-1 px-3 py-2 bg-parchment-base rounded-lg border border-parchment-dark focus:outline-none focus:border-accent text-sm disabled:opacity-50"
            />
            {contextType === 'personalization' && (
              <button
                onClick={handleSummarize}
                disabled={isLoading || isSessionLoading || isSummarizing || messages.length === 0}
                title="Finish and summarize to file"
                className="p-2 bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 disabled:hover:scale-100"
              >
                {isSummarizing
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <StopCircle className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || !sessionId}
              className="p-2 bg-accent hover:bg-accent-hover disabled:bg-ink-light disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 disabled:hover:scale-100"
            >
              <Send className={`w-4 h-4 transition-transform duration-200 ${isLoading ? 'animate-pulse' : ''}`} />
            </button>
          </div>
        </div>
      </div>
      {/* Summary preview modal */}
      {summaryPreview !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/70" onClick={() => setSummaryPreview(null)} />
          <div className="relative bg-parchment-card rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[80vh]">
            {/* Agent message bubble */}
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-start gap-3">
                <img
                  src={agentAvatar}
                  alt={agentName}
                  className="w-8 h-8 rounded-full object-cover border border-parchment-dark shrink-0 mt-0.5"
                />
                <div className="bg-parchment-sidebar rounded-2xl rounded-tl-md px-4 py-3 text-sm text-ink-primary leading-relaxed">
                  I've wrapped up our conversation into a short profile. If it looks right to you, I can save it to{' '}
                  <code className="bg-parchment-dark/60 px-1 py-0.5 rounded text-xs font-mono">
                    .thinkpod/user_profile/{contextKey}.md
                  </code>
                  {' '}— or keep chatting to refine it.
                </div>
              </div>
            </div>

            {/* Summary content */}
            <div className="flex-1 overflow-y-auto px-5 pb-4">
              <pre className="text-sm text-ink-primary whitespace-pre-wrap leading-relaxed font-sans bg-parchment rounded-xl border border-parchment-dark p-4">
                {summaryPreview}
              </pre>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-parchment-dark">
              <button
                onClick={() => setSummaryPreview(null)}
                className="px-4 py-2 rounded-lg text-sm text-ink-muted hover:text-ink-primary transition-colors"
              >
                Keep chatting
              </button>
              <button
                onClick={handleSaveSummary}
                disabled={isSavingSummary}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
              >
                {isSavingSummary
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Check className="w-3.5 h-3.5" />}
                Looks good, save it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
