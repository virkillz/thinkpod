import { useState, useCallback, useEffect } from 'react'
import { X, Mic } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'

interface CaptureSheetProps {
  isOpen: boolean
  onClose: () => void
}

export function CaptureSheet({ isOpen, onClose }: CaptureSheetProps) {
  const [content, setContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const { refreshFileTree } = useAppStore()

  // Handle keyboard shortcut Cmd+Enter to save
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSave()
    }
  }, [content])

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  const handleSave = async () => {
    if (!content.trim()) return

    setIsSaving(true)
    try {
      const date = new Date()
      const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const slug = content.slice(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'folio'
      const filename = `${timestamp}-${slug}.md`

      await window.electronAPI.writeFile(`_folios/${filename}`, content)
      await refreshFileTree()
      
      setContent('')
      onClose()
    } catch (error) {
      console.error('Failed to save folio:', error)
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-8 pointer-events-none">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-ink-primary/20 pointer-events-auto"
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl pointer-events-auto animate-in slide-in-from-bottom-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark">
          <h3 className="font-serif font-medium text-lg text-ink-primary">New Folio</h3>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-parchment-sidebar rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-ink-muted" />
          </button>
        </div>

        {/* Editor */}
        <div className="p-6">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write here…"
            className="w-full h-64 p-4 bg-parchment-base rounded-lg border border-parchment-dark focus:outline-none focus:border-accent resize-none font-serif text-ink-primary leading-relaxed"
            autoFocus
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-parchment-dark">
          <button 
            className="flex items-center gap-2 px-4 py-2 text-ink-muted hover:text-ink-primary transition-colors"
            title="Voice capture (coming in Phase 5)"
          >
            <Mic className="w-5 h-5" />
            <span className="text-sm">Voice</span>
          </button>
          
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-muted">Cmd+Enter to save</span>
            <button
              onClick={handleSave}
              disabled={!content.trim() || isSaving}
              className="px-6 py-2 bg-accent hover:bg-accent-hover disabled:bg-ink-light disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {isSaving ? 'Saving…' : 'Save Folio'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
