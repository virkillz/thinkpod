import { useState, useEffect } from 'react'
import { X, MessageCircle, HelpCircle, Lightbulb } from 'lucide-react'

interface Comment {
  id: number
  file_path: string
  line: number
  content: string
  type: 'question' | 'suggestion' | 'note'
  status: string
  created_at: number
}

interface CommentPanelProps {
  filePath: string
}

export function CommentPanel({ filePath }: CommentPanelProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const loadComments = async () => {
      setIsLoading(true)
      try {
        const result = await window.electronAPI.getComments(filePath)
        setComments(result)
      } catch (error) {
        console.error('Failed to load comments:', error)
        setComments([])
      } finally {
        setIsLoading(false)
      }
    }

    loadComments()
  }, [filePath])

  const handleDismiss = async (id: number) => {
    try {
      await window.electronAPI.dismissComment(id)
      setComments(prev => prev.filter(c => c.id !== id))
    } catch (error) {
      console.error('Failed to dismiss comment:', error)
    }
  }

  const getIcon = (type: Comment['type']) => {
    switch (type) {
      case 'question':
        return <HelpCircle className="w-4 h-4 text-warning" />
      case 'suggestion':
        return <Lightbulb className="w-4 h-4 text-success" />
      default:
        return <MessageCircle className="w-4 h-4 text-accent" />
    }
  }

  const getTypeLabel = (type: Comment['type']) => {
    switch (type) {
      case 'question':
        return 'Question'
      case 'suggestion':
        return 'Suggestion'
      default:
        return 'Note'
    }
  }

  // Collapse if no comments
  if (comments.length === 0) {
    return null
  }

  return (
    <div className="w-72 border-l border-parchment-dark bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-parchment-dark">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-accent" />
          <span className="font-medium text-sm text-ink-primary">
            Wilfred's Comments
          </span>
        </div>
        <span className="text-xs text-ink-muted">{comments.length}</span>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-parchment-base rounded-lg p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                  {getIcon(comment.type)}
                  <span className="text-xs font-medium text-ink-muted">
                    {getTypeLabel(comment.type)}
                  </span>
                </div>
                <button
                  onClick={() => handleDismiss(comment.id)}
                  className="p-1 hover:bg-parchment-dark rounded transition-colors"
                  title="Dismiss"
                >
                  <X className="w-3 h-3 text-ink-muted" />
                </button>
              </div>
              
              <p className="text-ink-primary leading-relaxed">
                {comment.content}
              </p>
              
              {comment.line > 0 && (
                <div className="mt-2 text-xs text-ink-light">
                  Line {comment.line}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
