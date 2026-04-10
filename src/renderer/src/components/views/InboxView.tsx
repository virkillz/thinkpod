import { useEffect, useState } from 'react'
import { Mail, Check, Eye, Trash2, Send, Loader2 } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'

interface ThreadMessage {
  role: 'agent' | 'human'
  timestamp: number
  content: string
}

interface ThreadFrontmatter {
  thread_id: string
  type: 'question' | 'insight' | 'recommendation' | 'plan' | 'housekeeping'
  status: 'active' | 'awaiting_reply' | 'replied' | 'resolved'
  created: number
}

interface InboxItem {
  id: string
  path: string
  title: string
  type: string
  created: string
  status: string
  isThread?: boolean
  frontmatter?: ThreadFrontmatter
  messages?: ThreadMessage[]
}

export function InboxView() {
  const [items, setItems] = useState<InboxItem[]>([])
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null)
  const [content, setContent] = useState('')
  const [replyText, setReplyText] = useState('')
  const [isReplying, setIsReplying] = useState(false)
  const { setUnreadInbox, agentName } = useAppStore()

  useEffect(() => {
    loadItems()
  }, [])

  const loadItems = async () => {
    const result = await window.electronAPI.listInbox()
    // Parse thread files (starting with 'thread-') to extract structured data
    const parsedItems = result.map((item: InboxItem) => {
      if (item.id.startsWith('thread-')) {
        return parseThreadItem(item)
      }
      return item
    })
    setItems(parsedItems)
    setUnreadInbox(result.filter((e: InboxItem) => e.status === 'unread' || e.status === 'awaiting_reply').length)
  }

  const parseThreadItem = (item: InboxItem): InboxItem => {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (!frontmatterMatch) return { ...item, isThread: true }

    const fm: Partial<ThreadFrontmatter> = {}
    const lines = frontmatterMatch[1].split('\n')
    for (const line of lines) {
      const colonIndex = line.indexOf(':')
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim()
        const value = line.slice(colonIndex + 1).trim()
        if (key === 'thread_id') fm.thread_id = value
        else if (key === 'type') fm.type = value as ThreadFrontmatter['type']
        else if (key === 'status') fm.status = value as ThreadFrontmatter['status']
        else if (key === 'created') fm.created = parseInt(value, 10)
      }
    }

    return {
      ...item,
      isThread: true,
      frontmatter: fm as ThreadFrontmatter,
      status: (fm.status as string) || item.status,
    }
  }

  const handleSelectItem = async (item: InboxItem) => {
    setSelectedItem(item)
    setReplyText('')
    const result = await window.electronAPI.readInboxItem(item.id)
    setContent(result.content)

    // If it's a thread, parse the messages
    if (item.id.startsWith('thread-')) {
      const parsed = parseThreadContent(result.content)
      setSelectedItem({ ...item, messages: parsed.messages, frontmatter: parsed.frontmatter })
    }

    if (item.status === 'unread') {
      await window.electronAPI.markInboxRead(item.id)
      await loadItems()
    }
  }

  const parseThreadContent = (content: string): { frontmatter: ThreadFrontmatter; messages: ThreadMessage[] } => {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
    const fm: Partial<ThreadFrontmatter> = {}

    if (frontmatterMatch) {
      const lines = frontmatterMatch[1].split('\n')
      for (const line of lines) {
        const colonIndex = line.indexOf(':')
        if (colonIndex > 0) {
          const key = line.slice(0, colonIndex).trim()
          const value = line.slice(colonIndex + 1).trim()
          if (key === 'thread_id') fm.thread_id = value
          else if (key === 'type') fm.type = value as ThreadFrontmatter['type']
          else if (key === 'status') fm.status = value as ThreadFrontmatter['status']
          else if (key === 'created') fm.created = parseInt(value, 10)
        }
      }
    }

    // Parse messages
    const body = content.slice(frontmatterMatch?.[0].length || 0).trim()
    const messages: ThreadMessage[] = []
    const messageRegex = /## (Agent|Human) — ([\d-T:]{19,})\n\n([\s\S]*?)(?=\n## (Agent|Human) — |$)/g
    let match
    while ((match = messageRegex.exec(body)) !== null) {
      messages.push({
        role: match[1].toLowerCase() as 'agent' | 'human',
        timestamp: new Date(match[2]).getTime(),
        content: match[3].trim(),
      })
    }

    return { frontmatter: fm as ThreadFrontmatter, messages }
  }

  const handleReply = async () => {
    if (!selectedItem || !replyText.trim() || !selectedItem.id.startsWith('thread-')) return

    setIsReplying(true)
    try {
      const result = await window.electronAPI.replyToThread(selectedItem.id.replace('thread-', '').replace('.md', ''), replyText.trim())
      if (result.success) {
        setReplyText('')
        // Reload the thread to show new messages
        const refreshed = await window.electronAPI.readInboxItem(selectedItem.id)
        setContent(refreshed.content)
        const parsed = parseThreadContent(refreshed.content)
        setSelectedItem({ ...selectedItem, messages: parsed.messages, frontmatter: parsed.frontmatter })
      } else {
        alert('Failed to send reply: ' + result.error)
      }
    } finally {
      setIsReplying(false)
    }
  }

  const getTypeIcon = (type: InboxItem['type']) => {
    switch (type) {
      case 'insight':
        return <span className="w-2 h-2 rounded-full bg-success" />
      case 'recommendation':
        return <span className="w-2 h-2 rounded-full bg-accent" />
      case 'question':
        return <span className="w-2 h-2 rounded-full bg-warning" />
      case 'plan':
        return <span className="w-2 h-2 rounded-full bg-info" />
      default:
        return <span className="w-2 h-2 rounded-full bg-ink-muted" />
    }
  }

  const formatDate = (timestamp: number | string) => {
    if (typeof timestamp === 'number') {
      return new Date(timestamp).toLocaleString()
    }
    return new Date(timestamp).toLocaleString()
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'awaiting_reply':
        return <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded">Awaiting reply</span>
      case 'replied':
        return <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded">Replied</span>
      case 'resolved':
        return <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded">Resolved</span>
      default:
        return null
    }
  }

  if (selectedItem) {
    return (
      <div className="flex-1 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSelectedItem(null)
                setContent('')
              }}
              className="text-ink-muted hover:text-ink-primary"
            >
              ← Back
            </button>
            <span className="text-parchment-dark">|</span>
            <div className="flex items-center gap-2">
              {getTypeIcon(selectedItem.type)}
              <span className="font-serif font-medium text-ink-primary">{selectedItem.title}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                if (confirm('Delete this message?')) {
                  await window.electronAPI.deleteInboxItem(selectedItem.id)
                  setSelectedItem(null)
                  setContent('')
                  loadItems()
                }
              }}
              className="text-ink-muted hover:text-red-600 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="text-sm text-ink-muted">
              {new Date(selectedItem.created).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto">
            {selectedItem.messages && selectedItem.messages.length > 0 ? (
              // Thread view with messages
              <div className="space-y-6">
                {selectedItem.messages.map((message, idx) => (
                  <div
                    key={idx}
                    className={`flex ${message.role === 'human' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-5 py-4 ${
                        message.role === 'human'
                          ? 'bg-accent text-white'
                          : 'bg-parchment-sidebar border border-parchment-dark'
                      }`}
                    >
                      <div className={`text-xs mb-1 ${message.role === 'human' ? 'text-white/70' : 'text-ink-muted'}`}>
                        {message.role === 'agent' ? agentName : 'You'} — {formatDate(message.timestamp)}
                      </div>
                      <div className={`prose prose-sm max-w-none ${message.role === 'human' ? 'text-white' : 'text-ink-primary'}`}>
                        {message.content}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Reply input for threads */}
                {selectedItem.frontmatter?.status !== 'resolved' && (
                  <div className="mt-6 pt-6 border-t border-parchment-dark">
                    <div className="flex gap-3">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type your reply..."
                        className="flex-1 bg-parchment-sidebar border border-parchment-dark rounded-lg px-4 py-3 text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-accent resize-none"
                        rows={3}
                        disabled={isReplying}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.metaKey) {
                            handleReply()
                          }
                        }}
                      />
                      <button
                        onClick={handleReply}
                        disabled={!replyText.trim() || isReplying}
                        className="self-end bg-accent text-white px-4 py-3 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isReplying ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Reply
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-ink-muted mt-2">Cmd+Enter to send</p>
                  </div>
                )}

                {selectedItem.frontmatter?.status === 'resolved' && (
                  <div className="text-center text-ink-muted text-sm py-4">
                    This thread is resolved
                  </div>
                )}
              </div>
            ) : (
              // Regular inbox item view
              <div className="prose prose-lg max-w-none font-serif text-ink-primary whitespace-pre-wrap">
                {content.replace(/^---[\s\S]*?---\n+/, '')}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark">
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-accent" />
          <h2 className="font-serif font-medium text-lg text-ink-primary">Inbox</h2>
        </div>
        <span className="text-sm text-ink-muted">
          Messages from {agentName}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {items.length === 0 ? (
          <div className="max-w-2xl mx-auto text-center py-16">
            <div className="w-16 h-16 bg-parchment-sidebar rounded-full flex items-center justify-center mx-auto mb-6">
              <Mail className="w-8 h-8 text-accent" />
            </div>
            <h3 className="font-serif text-xl text-ink-primary mb-2">
              No messages yet
            </h3>
            <p className="text-ink-muted max-w-md mx-auto mb-4">
              {agentName} will leave messages here when he has insights,
              recommendations, or questions about your notes.
            </p>
            <p className="text-sm text-ink-light">
              Try running a task from the Tasks view, or ask {agentName} a question.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelectItem(item)}
                className="bg-parchment-card rounded-xl p-6 shadow-sm border border-parchment-dark hover:border-accent transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {getTypeIcon(item.type)}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className={`font-medium ${item.status === 'unread' || item.status === 'awaiting_reply' ? 'text-ink-primary' : 'text-ink-muted'}`}>
                          {item.title}
                        </h3>
                        {item.isThread ? (
                          getStatusBadge(item.status)
                        ) : item.status === 'unread' && (
                          <span className="w-2 h-2 rounded-full bg-accent" />
                        )}
                      </div>
                      <p className="text-sm text-ink-muted mt-0.5">
                        {new Date(item.created).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-ink-light">
                    {item.status === 'read' ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
