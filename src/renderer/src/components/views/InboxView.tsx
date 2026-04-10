import { useEffect, useState } from 'react'
import { Mail, Check, Eye } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'

interface InboxItem {
  id: string
  path: string
  title: string
  type: 'insight' | 'recommendation' | 'question' | 'housekeeping'
  created: string
  status: 'unread' | 'read'
}

export function InboxView() {
  const [items, setItems] = useState<InboxItem[]>([])
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null)
  const [content, setContent] = useState('')
  const { setUnreadInbox, setCurrentView } = useAppStore()

  useEffect(() => {
    loadItems()
  }, [])

  const loadItems = async () => {
    const result = await window.electronAPI.listInbox()
    setItems(result)
    setUnreadInbox(result.filter(e => e.status === 'unread').length)
  }

  const handleSelectItem = async (item: InboxItem) => {
    setSelectedItem(item)
    const result = await window.electronAPI.readInboxItem(item.id)
    setContent(result.content)

    if (item.status === 'unread') {
      await window.electronAPI.markInboxRead(item.id)
      await loadItems()
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
      default:
        return <span className="w-2 h-2 rounded-full bg-ink-muted" />
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
          <div className="text-sm text-ink-muted">
            {new Date(selectedItem.created).toLocaleString()}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto">
            <div className="prose prose-lg max-w-none font-serif text-ink-primary whitespace-pre-wrap">
              {content.replace(/^---[\s\S]*?---\n+/, '')}
            </div>
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
          Messages from Wilfred
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
              Wilfred will leave messages here when he has insights,
              recommendations, or questions about your notes.
            </p>
            <p className="text-sm text-ink-light">
              Try running a task from the Tasks view, or ask Wilfred a question.
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
                        <h3 className={`font-medium ${item.status === 'unread' ? 'text-ink-primary' : 'text-ink-muted'}`}>
                          {item.title}
                        </h3>
                        {item.status === 'unread' && (
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
