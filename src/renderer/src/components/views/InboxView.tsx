import { useEffect, useState } from 'react'
import { Mail, Trash2, Send, Loader2, Archive, Search, X, CheckSquare, Square, Inbox, Clock, CheckCircle2 } from 'lucide-react'
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
  preview?: string
  archived?: boolean
  starred?: boolean
}

export function InboxView() {
  const [items, setItems] = useState<InboxItem[]>([])
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null)
  const [content, setContent] = useState('')
  const [replyText, setReplyText] = useState('')
  const [isReplying, setIsReplying] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'unread' | 'awaiting' | 'resolved' | 'archived'>('all')
  const { setUnreadInbox, agentName } = useAppStore()

  useEffect(() => {
    loadItems()
  }, [])

  const loadItems = async () => {
    const result = await window.electronAPI.listInbox()
    const parsedItems = await Promise.all(result.map(async (item: InboxItem) => {
      const itemContent = await window.electronAPI.readInboxItem(item.id)
      const preview = extractPreview(itemContent.content)
      
      if (item.id.startsWith('thread-')) {
        return { ...parseThreadItem(item, itemContent.content), preview }
      }
      return { ...item, preview }
    }))
    setItems(parsedItems)
    setUnreadInbox(result.filter((e: InboxItem) => e.status === 'unread' || e.status === 'awaiting_reply').length)
  }

  const extractPreview = (content: string): string => {
    const withoutFrontmatter = content.replace(/^---[\s\S]*?---\n+/, '')
    const withoutHeaders = withoutFrontmatter.replace(/^##.*$/gm, '')
    const cleaned = withoutHeaders.trim().split('\n').filter(line => line.trim()).join(' ')
    return cleaned.slice(0, 120) + (cleaned.length > 120 ? '...' : '')
  }

  const getRelativeTime = (timestamp: number | string): string => {
    const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const parseThreadItem = (item: InboxItem, itemContent: string): InboxItem => {
    const frontmatterMatch = itemContent.match(/^---\n([\s\S]*?)\n---/)
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

  const handleArchive = async (itemId: string) => {
    await window.electronAPI.archiveInboxItem(itemId)
    await loadItems()
    setSelectedIds(new Set())
  }

  const handleBulkArchive = async () => {
    for (const id of selectedIds) {
      await window.electronAPI.archiveInboxItem(id)
    }
    await loadItems()
    setSelectedIds(new Set())
  }

  const handleDelete = async (itemId: string) => {
    if (confirm('Permanently delete this message? This cannot be undone.')) {
      await window.electronAPI.deleteInboxItem(itemId)
      await loadItems()
      setSelectedIds(new Set())
    }
  }

  const handleToggleSelect = (itemId: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId)
    } else {
      newSelected.add(itemId)
    }
    setSelectedIds(newSelected)
  }

  const filteredItems = items.filter(item => {
    const matchesSearch = !searchQuery || 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.preview && item.preview.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesFilter = 
      filterStatus === 'all' ||
      (filterStatus === 'unread' && (item.status === 'unread' || item.status === 'awaiting_reply')) ||
      (filterStatus === 'awaiting' && item.status === 'awaiting_reply') ||
      (filterStatus === 'resolved' && item.status === 'resolved') ||
      (filterStatus === 'archived' && item.archived)
    
    return matchesSearch && matchesFilter
  })

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
      <div className="border-b border-parchment-dark">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-accent" />
            <h2 className="font-serif font-medium text-lg text-ink-primary">Inbox</h2>
            {items.filter(i => i.status === 'unread' || i.status === 'awaiting_reply').length > 0 && (
              <span className="bg-accent text-white text-xs px-2 py-0.5 rounded-full">
                {items.filter(i => i.status === 'unread' || i.status === 'awaiting_reply').length}
              </span>
            )}
          </div>
          <span className="text-sm text-ink-muted">
            Messages from {agentName}
          </span>
        </div>
        
        {/* Search and Filters */}
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
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                filterStatus === 'all'
                  ? 'bg-accent text-white'
                  : 'bg-parchment-sidebar text-ink-muted hover:text-ink-primary'
              }`}
            >
              <Inbox className="w-3.5 h-3.5 inline mr-1.5" />
              All
            </button>
            <button
              onClick={() => setFilterStatus('unread')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                filterStatus === 'unread'
                  ? 'bg-accent text-white'
                  : 'bg-parchment-sidebar text-ink-muted hover:text-ink-primary'
              }`}
            >
              <Mail className="w-3.5 h-3.5 inline mr-1.5" />
              Unread
            </button>
            <button
              onClick={() => setFilterStatus('awaiting')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                filterStatus === 'awaiting'
                  ? 'bg-accent text-white'
                  : 'bg-parchment-sidebar text-ink-muted hover:text-ink-primary'
              }`}
            >
              <Clock className="w-3.5 h-3.5 inline mr-1.5" />
              Awaiting Reply
            </button>
            <button
              onClick={() => setFilterStatus('resolved')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                filterStatus === 'resolved'
                  ? 'bg-accent text-white'
                  : 'bg-parchment-sidebar text-ink-muted hover:text-ink-primary'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" />
              Resolved
            </button>
            <button
              onClick={() => setFilterStatus('archived')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                filterStatus === 'archived'
                  ? 'bg-accent text-white'
                  : 'bg-parchment-sidebar text-ink-muted hover:text-ink-primary'
              }`}
            >
              <Archive className="w-3.5 h-3.5 inline mr-1.5" />
              Archived
            </button>
          </div>
        </div>
        
        {/* Bulk Actions Toolbar */}
        {selectedIds.size > 0 && (
          <div className="px-6 pb-3 flex items-center gap-3 bg-accent/10 border-t border-parchment-dark">
            <span className="text-sm text-ink-primary font-medium">
              {selectedIds.size} selected
            </span>
            <button
              onClick={handleBulkArchive}
              className="text-sm text-ink-muted hover:text-ink-primary flex items-center gap-1.5"
            >
              <Archive className="w-4 h-4" />
              Archive
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-ink-muted hover:text-ink-primary"
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredItems.length === 0 && items.length === 0 ? (
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
        ) : filteredItems.length === 0 ? (
          <div className="max-w-2xl mx-auto text-center py-16">
            <div className="w-16 h-16 bg-parchment-sidebar rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-8 h-8 text-accent" />
            </div>
            <h3 className="font-serif text-xl text-ink-primary mb-2">
              No messages found
            </h3>
            <p className="text-ink-muted">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-1">
            {filteredItems.map((item) => {
              const isUnread = item.status === 'unread' || item.status === 'awaiting_reply'
              const isSelected = selectedIds.has(item.id)
              
              return (
                <div
                  key={item.id}
                  className={`group relative bg-parchment-card rounded-lg border transition-all ${
                    isUnread
                      ? 'border-accent/30 bg-accent/5'
                      : 'border-parchment-dark hover:border-parchment-dark/60'
                  } ${
                    isSelected ? 'ring-2 ring-accent/50' : ''
                  }`}
                >
                  {/* Unread indicator bar */}
                  {isUnread && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent rounded-l-lg" />
                  )}
                  
                  <div className="flex items-start gap-3 p-4 pl-5">
                    {/* Checkbox */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleSelect(item.id)
                      }}
                      className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-accent" />
                      ) : (
                        <Square className="w-4 h-4 text-ink-muted" />
                      )}
                    </button>
                    
                    {/* Type icon */}
                    <div className="mt-1">
                      {getTypeIcon(item.type)}
                    </div>
                    
                    {/* Content */}
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => handleSelectItem(item)}
                    >
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <h3 className={`font-medium truncate ${
                          isUnread ? 'text-ink-primary font-semibold' : 'text-ink-muted'
                        }`}>
                          {item.title}
                        </h3>
                        <span className={`text-xs whitespace-nowrap ${
                          isUnread ? 'text-accent font-medium' : 'text-ink-light'
                        }`}>
                          {getRelativeTime(item.created)}
                        </span>
                      </div>
                      
                      {item.preview && (
                        <p className={`text-sm line-clamp-2 ${
                          isUnread ? 'text-ink-muted' : 'text-ink-light'
                        }`}>
                          {item.preview}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-2 mt-2">
                        {item.isThread && getStatusBadge(item.status)}
                        {item.messages && item.messages.length > 1 && (
                          <span className="text-xs text-ink-light">
                            {item.messages.length} messages
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleArchive(item.id)
                        }}
                        className="p-1.5 hover:bg-parchment-sidebar rounded transition-colors"
                        title="Archive"
                      >
                        <Archive className="w-4 h-4 text-ink-muted" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(item.id)
                        }}
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
