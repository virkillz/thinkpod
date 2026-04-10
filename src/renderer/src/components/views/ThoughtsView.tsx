import { useEffect, useState } from 'react'
import { Inbox, FileText } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'

interface Thought {
  name: string
  path: string
  isDirectory: boolean
}

export function ThoughtsView() {
  const { agentName } = useAppStore()
  const [thoughts, setThoughts] = useState<Thought[]>([])
  const [selectedThought, setSelectedThought] = useState<Thought | null>(null)
  const [content, setContent] = useState('')

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
    try {
      const text = await window.electronAPI.readFile(thought.path)
      setContent(typeof text === 'string' ? text : JSON.stringify(text, null, 2))
    } catch {
      setContent('(Could not read file)')
    }
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
        </div>

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
            <div className="w-16 h-16 bg-parchment-sidebar rounded-full flex items-center justify-center mx-auto mb-6">
              <Inbox className="w-8 h-8 text-accent" />
            </div>
            <h3 className="font-serif text-xl text-ink-primary mb-2">
              No thoughts yet
            </h3>
            <p className="text-ink-muted max-w-md mx-auto mb-4">
              Drop files into the <code className="text-accent">_thoughts/</code> folder in your workspace.
              {agentName} will triage them automatically.
            </p>
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
