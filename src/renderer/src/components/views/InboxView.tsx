import { useEffect, useState } from 'react'
import { Mail, Trash2, Send, Loader2, Archive, Search, X, CheckSquare, Square, Inbox, Clock, Pencil } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'

interface InboxReply {
  id: number
  role: string
  body: string
  created_at: number
}

interface InboxMessage {
  id: number
  subject: string
  body: string
  type: string
  status: string
  from_addr: string
  source_job: string | null
  created_at: number
  reply_count: number
}

interface InboxMessageDetail extends Omit<InboxMessage, 'reply_count'> {
  reply_count?: number
  replies: InboxReply[]
}

type FilterStatus = 'all' | 'unread' | 'archived'

export function InboxView() {
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [selected, setSelected] = useState<InboxMessageDetail | null>(null)
  const [replyText, setReplyText] = useState('')
  const [isReplying, setIsReplying] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [isComposing, setIsComposing] = useState(false)
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [isSendingCompose, setIsSendingCompose] = useState(false)
  const { setUnreadInbox, agentName, inboxResetTrigger } = useAppStore()

  useEffect(() => {
    loadMessages()
    
    // Listen for inbox updates from the agent
    const unsubscribe = window.electronAPI.onInboxUpdated(() => {
      loadMessages()
    })
    
    return unsubscribe
  }, [])

  useEffect(() => {
    setSelected(null)
  }, [inboxResetTrigger])

  const loadMessages = async () => {
    const result = await window.electronAPI.listInbox()
    setMessages(result)
    setUnreadInbox(result.filter((m) => m.status === 'unread').length)
  }

  const handleSelectMessage = async (msg: InboxMessage) => {
    const detail = await window.electronAPI.readInboxItem(msg.id)
    setSelected(detail)
    setReplyText('')
    if (msg.status === 'unread') {
      await window.electronAPI.markInboxRead(msg.id)
      setMessages((prev) => {
        const updated = prev.map((m) => m.id === msg.id ? { ...m, status: 'read' } : m)
        setUnreadInbox(updated.filter((m) => m.status === 'unread').length)
        return updated
      })
    }
  }

  const handleReply = async () => {
    if (!selected || !replyText.trim()) return
    setIsReplying(true)
    try {
      const result = await window.electronAPI.replyToThread(selected.id, replyText.trim())
      if (result.success) {
        setReplyText('')
        const detail = await window.electronAPI.readInboxItem(selected.id)
        setSelected(detail)
      } else {
        alert('Failed to send reply: ' + result.error)
      }
    } finally {
      setIsReplying(false)
    }
  }

  const handleArchive = async (id: number) => {
    await window.electronAPI.archiveInboxItem(id)
    if (selected?.id === id) setSelected(null)
    await loadMessages()
    setSelectedIds((prev) => { const s = new Set(prev); s.delete(id); return s })
  }

  const handleBulkArchive = async () => {
    for (const id of selectedIds) {
      await window.electronAPI.archiveInboxItem(id)
    }
    await loadMessages()
    setSelectedIds(new Set())
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Permanently delete this message? This cannot be undone.')) return
    await window.electronAPI.deleteInboxItem(id)
    if (selected?.id === id) setSelected(null)
    await loadMessages()
    setSelectedIds((prev) => { const s = new Set(prev); s.delete(id); return s })
  }

  const handleCompose = async () => {
    if (!composeSubject.trim() || !composeBody.trim()) return
    setIsSendingCompose(true)
    try {
      const result = await window.electronAPI.composeInboxMessage(composeSubject.trim(), composeBody.trim())
      if (result.success) {
        setIsComposing(false)
        setComposeSubject('')
        setComposeBody('')
        await loadMessages()
        // Open the newly created thread
        const detail = await window.electronAPI.readInboxItem(result.messageId)
        setSelected(detail)
      } else {
        alert('Failed to send message: ' + result.error)
      }
    } finally {
      setIsSendingCompose(false)
    }
  }

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const getRelativeTime = (ts: number): string => {
    const diffMs = Date.now() - ts
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return new Date(ts).toLocaleDateString()
  }

  const getTypeDot = (type: string) => {
    const colors: Record<string, string> = {
      insight: 'bg-success',
      recommendation: 'bg-accent',
      question: 'bg-warning',
      plan: 'bg-info',
    }
    return <span className={`w-2 h-2 rounded-full ${colors[type] ?? 'bg-ink-muted'}`} />
  }

  const filteredMessages = messages.filter((m) => {
    const matchesSearch =
      !searchQuery ||
      m.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.body.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter =
      filterStatus === 'all' ? m.status !== 'archived' :
      filterStatus === 'unread' ? m.status === 'unread' :
      m.status === 'archived'
    return matchesSearch && matchesFilter
  })

  // ── Detail view ────────────────────────────────────────────────────────────
  if (selected) {
    const isUserComposed = selected.type === 'outgoing'
    const allMessages = [
      { role: isUserComposed ? 'human' : 'agent', body: selected.body, created_at: selected.created_at },
      ...selected.replies,
    ]

    return (
      <div className="flex-1 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSelected(null); loadMessages() }}
              className="text-ink-muted hover:text-ink-primary"
            >
              ← Back
            </button>
            <span className="text-parchment-dark">|</span>
            <div className="flex items-center gap-2">
              {getTypeDot(selected.type)}
              <span className="font-serif font-medium text-ink-primary">{selected.subject}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleArchive(selected.id)}
              className="text-ink-muted hover:text-ink-primary transition-colors"
              title="Archive"
            >
              <Archive className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(selected.id)}
              className="text-ink-muted hover:text-red-600 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Email-style meta */}
        <div className="px-8 py-3 border-b border-parchment-dark bg-parchment-sidebar/50 text-sm text-ink-muted space-y-0.5">
          <div><span className="font-medium">From:</span> {selected.from_addr}</div>
          <div><span className="font-medium">Date:</span> {new Date(selected.created_at).toLocaleString()}</div>
          {selected.source_job && (
            <div><span className="font-medium">Via:</span> {selected.source_job}</div>
          )}
        </div>

        {/* Thread */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto space-y-6">
            {allMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'human' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-5 py-4 ${
                    msg.role === 'human'
                      ? 'bg-accent text-white'
                      : 'bg-parchment-sidebar border border-parchment-dark'
                  }`}
                >
                  <div className={`text-xs mb-2 ${msg.role === 'human' ? 'text-white/70' : 'text-ink-muted'}`}>
                    {msg.role === 'agent' ? agentName : 'You'} — {new Date(msg.created_at).toLocaleString()}
                  </div>
                  <div className={`prose prose-sm max-w-none whitespace-pre-wrap ${msg.role === 'human' ? 'text-white' : 'text-ink-primary'}`}>
                    {msg.body}
                  </div>
                </div>
              </div>
            ))}

            {/* Reply input */}
            {selected.status !== 'archived' && (
              <div className="mt-6 pt-6 border-t border-parchment-dark">
                <div className="flex gap-3">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    className="flex-1 bg-parchment-sidebar border border-parchment-dark rounded-lg px-4 py-3 text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-accent resize-none"
                    rows={3}
                    disabled={isReplying}
                    onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handleReply() }}
                  />
                  <button
                    onClick={handleReply}
                    disabled={!replyText.trim() || isReplying}
                    className="self-end bg-accent text-white px-4 py-3 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isReplying ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Sending...</>
                    ) : (
                      <><Send className="w-4 h-4" />Reply</>
                    )}
                  </button>
                </div>
                <p className="text-xs text-ink-muted mt-2">Cmd+Enter to send</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── List view ──────────────────────────────────────────────────────────────
  const unreadCount = messages.filter((m) => m.status === 'unread').length

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-parchment-dark">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-accent" />
            <h2 className="font-serif font-medium text-lg text-ink-primary">Inbox</h2>
            {unreadCount > 0 && (
              <span className="bg-accent text-white text-xs px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink-muted">Messages from {agentName}</span>
            <button
              onClick={() => setIsComposing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-sm rounded-lg hover:bg-accent/90 transition-colors"
              title="Compose new message"
            >
              <Pencil className="w-3.5 h-3.5" />
              Compose
            </button>
          </div>
        </div>

        {/* Search and filters */}
        <div className="px-6 pb-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 bg-parchment-sidebar border border-parchment-dark rounded-lg text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-accent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {([
              { id: 'all', label: 'All', icon: <Inbox className="w-3.5 h-3.5 inline mr-1.5" /> },
              { id: 'unread', label: 'Unread', icon: <Mail className="w-3.5 h-3.5 inline mr-1.5" /> },
              { id: 'archived', label: 'Archived', icon: <Archive className="w-3.5 h-3.5 inline mr-1.5" /> },
            ] as { id: FilterStatus; label: string; icon: React.ReactNode }[]).map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => setFilterStatus(id)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  filterStatus === id
                    ? 'bg-accent text-white'
                    : 'bg-parchment-sidebar text-ink-muted hover:text-ink-primary'
                }`}
              >
                {icon}{label}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="px-6 pb-3 flex items-center gap-3 bg-accent/10 border-t border-parchment-dark">
            <span className="text-sm text-ink-primary font-medium">{selectedIds.size} selected</span>
            <button
              onClick={handleBulkArchive}
              className="text-sm text-ink-muted hover:text-ink-primary flex items-center gap-1.5"
            >
              <Archive className="w-4 h-4" />Archive
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="text-sm text-ink-muted hover:text-ink-primary">
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Compose modal */}
      {isComposing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-parchment-card border border-parchment-dark rounded-xl shadow-xl w-full max-w-lg mx-4 flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-parchment-dark">
              <h3 className="font-serif font-medium text-ink-primary">New Message to {agentName}</h3>
              <button
                onClick={() => { setIsComposing(false); setComposeSubject(''); setComposeBody('') }}
                className="text-ink-muted hover:text-ink-primary transition-colors"
                disabled={isSendingCompose}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Fields */}
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs text-ink-muted mb-1 block">Subject</label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="What's on your mind?"
                  className="w-full bg-parchment-sidebar border border-parchment-dark rounded-lg px-4 py-2.5 text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-accent"
                  disabled={isSendingCompose}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-ink-muted mb-1 block">Message</label>
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder={`Write your message to ${agentName}...`}
                  className="w-full bg-parchment-sidebar border border-parchment-dark rounded-lg px-4 py-3 text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-accent resize-none"
                  rows={6}
                  disabled={isSendingCompose}
                  onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handleCompose() }}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-parchment-dark">
              <p className="text-xs text-ink-muted">Cmd+Enter to send</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setIsComposing(false); setComposeSubject(''); setComposeBody('') }}
                  className="px-4 py-2 text-sm text-ink-muted hover:text-ink-primary transition-colors"
                  disabled={isSendingCompose}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCompose}
                  disabled={!composeSubject.trim() || !composeBody.trim() || isSendingCompose}
                  className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSendingCompose ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Sending...</>
                  ) : (
                    <><Send className="w-4 h-4" />Send</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredMessages.length === 0 && messages.length === 0 ? (
          <div className="max-w-2xl mx-auto text-center py-16">
            <div className="w-16 h-16 bg-parchment-sidebar rounded-full flex items-center justify-center mx-auto mb-6">
              <Mail className="w-8 h-8 text-accent" />
            </div>
            <h3 className="font-serif text-xl text-ink-primary mb-2">No messages yet</h3>
            <p className="text-ink-muted max-w-md mx-auto mb-4">
              {agentName} will send messages here when he has insights, recommendations, or questions about your notes.
            </p>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="max-w-2xl mx-auto text-center py-16">
            <div className="w-16 h-16 bg-parchment-sidebar rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-8 h-8 text-accent" />
            </div>
            <h3 className="font-serif text-xl text-ink-primary mb-2">No messages found</h3>
            <p className="text-ink-muted">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-1">
            {filteredMessages.map((msg) => {
              const isUnread = msg.status === 'unread'
              const isSelected = selectedIds.has(msg.id)
              const preview = msg.body.replace(/[#*`]/g, '').trim().slice(0, 120)

              return (
                <div
                  key={msg.id}
                  className={`group relative bg-parchment-card rounded-lg border transition-all ${
                    isUnread
                      ? 'border-accent/30 bg-accent/5'
                      : 'border-parchment-dark hover:border-parchment-dark/60'
                  } ${isSelected ? 'ring-2 ring-accent/50' : ''}`}
                >
                  {isUnread && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent rounded-l-lg" />
                  )}

                  <div className="flex items-start gap-3 p-4 pl-5">
                    {/* Checkbox */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleSelect(msg.id) }}
                      className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {isSelected
                        ? <CheckSquare className="w-4 h-4 text-accent" />
                        : <Square className="w-4 h-4 text-ink-muted" />}
                    </button>

                    {/* Type dot */}
                    <div className="mt-1">{getTypeDot(msg.type)}</div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleSelectMessage(msg)}>
                      <div className="flex items-start justify-between gap-3 mb-0.5">
                        <div className="min-w-0">
                          <span className="text-xs text-ink-muted">{msg.from_addr}</span>
                        </div>
                        <span className={`text-xs whitespace-nowrap ${isUnread ? 'text-accent font-medium' : 'text-ink-light'}`}>
                          {getRelativeTime(msg.created_at)}
                        </span>
                      </div>
                      <h3 className={`font-medium truncate mb-1 ${isUnread ? 'text-ink-primary font-semibold' : 'text-ink-muted'}`}>
                        {msg.subject}
                      </h3>
                      {preview && (
                        <p className={`text-sm line-clamp-2 ${isUnread ? 'text-ink-muted' : 'text-ink-light'}`}>
                          {preview}{msg.body.length > 120 ? '…' : ''}
                        </p>
                      )}
                      {msg.reply_count > 0 && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <Clock className="w-3 h-3 text-ink-light" />
                          <span className="text-xs text-ink-light">{msg.reply_count} {msg.reply_count === 1 ? 'reply' : 'replies'}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleArchive(msg.id) }}
                        className="p-1.5 hover:bg-parchment-sidebar rounded transition-colors"
                        title="Archive"
                      >
                        <Archive className="w-4 h-4 text-ink-muted" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(msg.id) }}
                        className="p-1.5 hover:bg-parchment-sidebar rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-ink-muted" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
