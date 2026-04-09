import { useEffect, useState } from 'react'
import { Mail, FileText, Check, Eye } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'

interface Epistle {
  id: string
  path: string
  title: string
  type: 'insight' | 'recommendation' | 'question' | 'housekeeping'
  created: string
  status: 'unread' | 'read'
}

export function EpistlesView() {
  const [epistles, setEpistles] = useState<Epistle[]>([])
  const [selectedEpistle, setSelectedEpistle] = useState<Epistle | null>(null)
  const [content, setContent] = useState('')
  const { setUnreadEpistles, setCurrentView } = useAppStore()

  useEffect(() => {
    loadEpistles()
  }, [])

  const loadEpistles = async () => {
    const result = await window.electronAPI.listEpistles()
    setEpistles(result)
    setUnreadEpistles(result.filter(e => e.status === 'unread').length)
  }

  const handleSelectEpistle = async (epistle: Epistle) => {
    setSelectedEpistle(epistle)
    const result = await window.electronAPI.readEpistle(epistle.id)
    setContent(result.content)

    // Mark as read if unread
    if (epistle.status === 'unread') {
      await window.electronAPI.markEpistleRead(epistle.id)
      await loadEpistles()
    }
  }

  const getTypeIcon = (type: Epistle['type']) => {
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

  if (selectedEpistle) {
    return (
      <div className="flex-1 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSelectedEpistle(null)
                setContent('')
              }}
              className="text-ink-muted hover:text-ink-primary"
            >
              ← Back
            </button>
            <span className="text-parchment-dark">|</span>
            <div className="flex items-center gap-2">
              {getTypeIcon(selectedEpistle.type)}
              <span className="font-serif font-medium text-ink-primary">{selectedEpistle.title}</span>
            </div>
          </div>
          <div className="text-sm text-ink-muted">
            {new Date(selectedEpistle.created).toLocaleString()}
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
          <h2 className="font-serif font-medium text-lg text-ink-primary">Epistles</h2>
        </div>
        <span className="text-sm text-ink-muted">
          Wilfred's letters to you
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {epistles.length === 0 ? (
          <div className="max-w-2xl mx-auto text-center py-16">
            <div className="w-16 h-16 bg-parchment-sidebar rounded-full flex items-center justify-center mx-auto mb-6">
              <Mail className="w-8 h-8 text-accent" />
            </div>
            <h3 className="font-serif text-xl text-ink-primary mb-2">
              No epistles yet
            </h3>
            <p className="text-ink-muted max-w-md mx-auto mb-4">
              Wilfred will write epistles here when he has insights, 
              recommendations, or questions about your manuscripts.
            </p>
            <p className="text-sm text-ink-light">
              Try running a task from the Chapter view, or ask Wilfred a question.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {epistles.map((epistle) => (
              <div
                key={epistle.id}
                onClick={() => handleSelectEpistle(epistle)}
                className="bg-white rounded-xl p-6 shadow-sm border border-parchment-dark hover:border-accent transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {getTypeIcon(epistle.type)}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className={`font-medium ${epistle.status === 'unread' ? 'text-ink-primary' : 'text-ink-muted'}`}>
                          {epistle.title}
                        </h3>
                        {epistle.status === 'unread' && (
                          <span className="w-2 h-2 rounded-full bg-accent" />
                        )}
                      </div>
                      <p className="text-sm text-ink-muted mt-0.5">
                        {new Date(epistle.created).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-ink-light">
                    {epistle.status === 'read' ? (
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
