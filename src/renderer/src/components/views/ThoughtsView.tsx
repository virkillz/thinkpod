import { useEffect, useState, useMemo } from 'react'
import { Inbox, FileText, Trash2, FolderInput, Loader2, CheckCheck, X, Sparkles, PenLine } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'

const INSPIRATIONAL_MESSAGES = [
  { title: 'All caught up!', subtitle: 'Your thoughts folder is clear. Ready for the next brain dump?', icon: 'sparkle' },
  { title: 'Clear mind, fresh start', subtitle: 'The canvas is empty. What is percolating in your head right now?', icon: 'sparkle' },
  { title: 'Inbox zero achieved', subtitle: 'Every thought has been triaged. Time to feed the beast?', icon: 'sparkle' },
  { title: 'The silence is loud', subtitle: 'Your _thoughts folder echoes with possibility. Drop something in.', icon: 'sparkle' },
  { title: 'Ready when you are', subtitle: 'Journal entry, idea, rant, or reminder—what is on your mind?', icon: 'sparkle' },
  { title: 'Thoughts processed', subtitle: 'Your mental queue is clear. Capture what is brewing now.', icon: 'sparkle' },
  { title: 'Clean slate', subtitle: 'No pending thoughts. Perfect time to braindump something raw.', icon: 'sparkle' },
  { title: 'Your mind deserves a download', subtitle: 'Unclutter your brain. Drop those fragments here.', icon: 'sparkle' },
  { title: 'Quiet on the front', subtitle: 'All thoughts archived. What new idea wants to surface?', icon: 'sparkle' },
  { title: 'The well is empty', subtitle: 'Time to fill it. Write a journal entry, capture an idea, or just vent.', icon: 'sparkle' },
  { title: 'Mental RAM cleared', subtitle: 'No background processes running. Start a new thread?', icon: 'sparkle' },
  { title: 'Awaiting input', subtitle: 'Your second brain is hungry. Feed it a thought, any thought.', icon: 'sparkle' },
] as const

interface Thought {
  name: string
  path: string
  isDirectory: boolean
}

type SuggestState = 'idle' | 'loading' | 'confirming' | 'moving'

export function ThoughtsView() {
  const { agentName, refreshFileTree, setCurrentView } = useAppStore()
  const [thoughts, setThoughts] = useState<Thought[]>([])

  const randomMessage = useMemo(() => {
    const index = Math.floor(Math.random() * INSPIRATIONAL_MESSAGES.length)
    return INSPIRATIONAL_MESSAGES[index]
  }, [])
  const [selectedThought, setSelectedThought] = useState<Thought | null>(null)
  const [content, setContent] = useState('')
  const [suggestState, setSuggestState] = useState<SuggestState>('idle')
  const [suggestedFolder, setSuggestedFolder] = useState<string | null>(null)
  const [suggestError, setSuggestError] = useState<string | null>(null)

  useEffect(() => {
    loadThoughts()
  }, [])

  const loadThoughts = async () => {
    try {
      const result = await window.electronAPI.listFiles('_thoughts')
      setThoughts(result.filter((f: Thought) => !f.isDirectory))
    } catch {
      setThoughts([])
    }
  }

  const handleSelectThought = async (thought: Thought) => {
    setSelectedThought(thought)
    setSuggestState('idle')
    setSuggestedFolder(null)
    setSuggestError(null)
    try {
      const result = await window.electronAPI.readFile(thought.path)
      setContent(result.content)
    } catch {
      setContent('(Could not read file)')
    }
  }

  const handleDelete = async () => {
    if (!selectedThought) return
    if (!confirm(`Delete "${selectedThought.name}"?`)) return

    try {
      await window.electronAPI.deleteFile(selectedThought.path)
      setSelectedThought(null)
      setContent('')
      loadThoughts()
    } catch {
      alert('Failed to delete file')
    }
  }

  const handleSuggestFolder = async () => {
    if (!content || suggestState !== 'idle') return
    setSuggestState('loading')
    setSuggestError(null)
    try {
      const result = await window.electronAPI.suggestFolder(content)
      if (result.success) {
        setSuggestedFolder(result.folder)
        setSuggestState('confirming')
      } else {
        setSuggestError(result.error ?? 'Could not suggest a folder')
        setSuggestState('idle')
      }
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : 'Failed to suggest folder')
      setSuggestState('idle')
    }
  }

  const handleConfirmMove = async () => {
    if (!selectedThought || !suggestedFolder) return
    setSuggestState('moving')
    try {
      const destPath = `${suggestedFolder}/${selectedThought.name}`
      await window.electronAPI.moveFile(selectedThought.path, destPath)
      await refreshFileTree()
      setSelectedThought(null)
      setContent('')
      setSuggestState('idle')
      setSuggestedFolder(null)
      loadThoughts()
    } catch {
      setSuggestError('Failed to move file')
      setSuggestState('confirming')
    }
  }

  const handleCancelSuggest = () => {
    setSuggestState('idle')
    setSuggestedFolder(null)
    setSuggestError(null)
  }

  if (selectedThought) {
    return (
      <div className="flex-1 flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSelectedThought(null)
                setContent('')
                setSuggestState('idle')
                setSuggestedFolder(null)
              }}
              className="text-ink-muted hover:text-ink-primary"
            >
              ← Back
            </button>
            <span className="text-parchment-dark">|</span>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" />
              <span className="font-serif font-medium text-ink-primary">{selectedThought.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSuggestFolder}
              disabled={suggestState !== 'idle' || !content}
              title="Ask AI to suggest a folder for this note"
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-accent hover:text-accent-hover hover:bg-accent/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {suggestState === 'loading' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FolderInput className="w-4 h-4" />
              )}
              {suggestState === 'loading' ? 'Thinking…' : 'Suggest Folder'}
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete thought"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>

        {/* Suggest folder confirmation banner */}
        {suggestState === 'confirming' && suggestedFolder && (
          <div className="flex items-center gap-3 px-6 py-3 bg-accent/5 border-b border-accent/20">
            <FolderInput className="w-4 h-4 text-accent flex-shrink-0" />
            <span className="text-sm text-ink-primary flex-1">
              Move to{' '}
              <span className="font-mono font-medium text-accent">{suggestedFolder}</span>
              {'?'}
            </span>
            <button
              onClick={handleConfirmMove}
              className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Move
            </button>
            <button
              onClick={handleCancelSuggest}
              className="flex items-center gap-1 px-2 py-1 text-sm text-ink-muted hover:text-ink-primary rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Moving state banner */}
        {suggestState === 'moving' && (
          <div className="flex items-center gap-3 px-6 py-3 bg-accent/5 border-b border-accent/20">
            <Loader2 className="w-4 h-4 text-accent animate-spin" />
            <span className="text-sm text-ink-muted">Moving file…</span>
          </div>
        )}

        {/* Error banner */}
        {suggestError && (
          <div className="flex items-center gap-3 px-6 py-3 bg-red-50 border-b border-red-100">
            <span className="text-sm text-red-600 flex-1">{suggestError}</span>
            <button onClick={() => setSuggestError(null)} className="text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto">
            <div className="prose prose-lg max-w-none font-serif text-ink-primary whitespace-pre-wrap">
              {content}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark">
        <div className="flex items-center gap-3">
          <Inbox className="w-5 h-5 text-accent" />
          <h2 className="font-serif font-medium text-lg text-ink-primary">Thoughts</h2>
        </div>
        <span className="text-sm text-ink-muted">
          Files awaiting triage
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {thoughts.length === 0 ? (
          <div className="max-w-2xl mx-auto text-center py-16">
            <div className="w-16 h-16 bg-gradient-to-br from-accent/20 to-accent/5 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Sparkles className="w-8 h-8 text-accent" />
            </div>
            <h3 className="font-serif text-xl text-ink-primary mb-2">
              {randomMessage.title}
            </h3>
            <p className="text-ink-muted max-w-md mx-auto mb-6">
              {randomMessage.subtitle}
            </p>
            <button
              onClick={() => setCurrentView('newthought')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-all shadow-sm hover:shadow-md"
            >
              <PenLine className="w-4 h-4" />
              New Thought
            </button>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {thoughts.map((thought) => (
              <div
                key={thought.path}
                onClick={() => handleSelectThought(thought)}
                className="bg-parchment-card rounded-xl p-6 shadow-sm border border-parchment-dark hover:border-accent transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-ink-muted flex-shrink-0" />
                  <span className="font-medium text-ink-primary">{thought.name}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
