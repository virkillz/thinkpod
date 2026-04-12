import { useState, useEffect } from 'react'
import { Heart, Compass, Briefcase, Activity, Users, X, Save, Loader2, MessageSquare } from 'lucide-react'
import { useAppStore } from '../../../store/appStore.js'
import { AgentChatPanel } from '../../shell/AgentChatPanel.js'

// ─── Topic config ─────────────────────────────────────────────────────────────

type Topic = 'interests' | 'values' | 'career' | 'health' | 'family'

const TOPICS: {
  id: Topic
  label: string
  icon: React.ElementType
  description: string
}[] = [
  {
    id: 'interests',
    label: 'Interests',
    icon: Heart,
    description: 'Hobbies, passions, and things you enjoy doing in your free time.',
  },
  {
    id: 'values',
    label: 'Values',
    icon: Compass,
    description: 'Your beliefs, principles, worldview, and what matters most to you.',
  },
  {
    id: 'career',
    label: 'Career',
    icon: Briefcase,
    description: 'Your professional life — what you do, where you are headed, your goals.',
  },
  {
    id: 'health',
    label: 'Health',
    icon: Activity,
    description: 'General health context that helps the agent give you relevant support.',
  },
  {
    id: 'family',
    label: 'Family',
    icon: Users,
    description: 'Your personal situation — relationship status, family setup, and life stage.',
  },
]

// ─── Edit modal ───────────────────────────────────────────────────────────────

function EditTopicModal({
  topic,
  initialContent,
  onClose,
  onSaved,
}: {
  topic: (typeof TOPICS)[number]
  initialContent: string
  onClose: () => void
  onSaved: () => void
}) {
  const [content, setContent] = useState(initialContent)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await window.electronAPI.writePersonalizationTopic(topic.id, content)
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-parchment-card rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-parchment-dark">
          <div className="flex items-center gap-2">
            <topic.icon className="w-4 h-4 text-accent" />
            <span className="font-medium text-ink-primary text-sm">{topic.label}</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-parchment-sidebar rounded-lg transition-colors">
            <X className="w-4 h-4 text-ink-muted" />
          </button>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-y-auto p-5">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={`Notes about your ${topic.label.toLowerCase()}…`}
            className="w-full h-64 px-3 py-2.5 bg-parchment rounded-lg border border-parchment-dark text-ink-primary text-sm leading-relaxed placeholder:text-ink-light resize-none focus:outline-none focus:border-accent/50 font-mono"
          />
          <p className="text-xs text-ink-muted mt-2">
            This file is saved to <code className="bg-parchment-sidebar px-1 py-0.5 rounded">.thinkpod/user_profile/{topic.id}.md</code>
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-parchment-dark">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-ink-muted hover:text-ink-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PersonalizationTab ───────────────────────────────────────────────────────

export function PersonalizationTab() {
  const { agentName } = useAppStore()

  // Which topics already have content
  const [filledTopics, setFilledTopics] = useState<Set<Topic>>(new Set())

  // Edit modal state
  const [editingTopic, setEditingTopic] = useState<(typeof TOPICS)[number] | null>(null)
  const [editingContent, setEditingContent] = useState('')

  // Chat panel state
  const [chatTopic, setChatTopic] = useState<Topic | null>(null)

  const checkFilledTopics = async () => {
    const filled = new Set<Topic>()
    for (const topic of TOPICS) {
      const result = await window.electronAPI.getPersonalizationTopic(topic.id)
      if (result.content) filled.add(topic.id)
    }
    setFilledTopics(filled)
  }

  useEffect(() => { checkFilledTopics() }, [])

  const handleOpen = async (topic: (typeof TOPICS)[number]) => {
    const result = await window.electronAPI.getPersonalizationTopic(topic.id)
    setEditingContent(result.content ?? '')
    setEditingTopic(topic)
  }

  const handleChat = (topic: Topic) => {
    setChatTopic(topic)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Description */}
      <p className="text-sm text-ink-muted">
        Tell {agentName} about yourself so conversations feel more personal and relevant.
        Each topic is saved as a plain Markdown file you can read, edit, or delete at any time.
      </p>

      {/* Topic cards */}
      <div className="space-y-3">
        {TOPICS.map(topic => {
          const isFilled = filledTopics.has(topic.id)
          return (
            <div
              key={topic.id}
              className="bg-parchment-card rounded-xl border border-parchment-dark p-4 flex items-center gap-4"
            >
              {/* Icon + text */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <topic.icon className={`w-5 h-5 shrink-0 ${isFilled ? 'text-accent' : 'text-ink-light'}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-ink-primary">{topic.label}</span>
                    {isFilled && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                        saved
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-muted mt-0.5 truncate">{topic.description}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleOpen(topic)}
                  className="px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink-primary border border-parchment-dark rounded-lg transition-colors"
                >
                  Open
                </button>
                <button
                  onClick={() => handleChat(topic.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent hover:bg-accent/90 text-white rounded-lg transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Chat
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Storage hint */}
      <div className="rounded-xl border border-parchment-dark bg-parchment-sidebar p-4 text-xs text-ink-muted">
        Files are stored at{' '}
        <code className="bg-parchment-card px-1 py-0.5 rounded">{'{vault}'}/.thinkpod/user_profile/</code> — fully
        transparent and editable with any text editor.
      </div>

      {/* Edit modal */}
      {editingTopic && (
        <EditTopicModal
          topic={editingTopic}
          initialContent={editingContent}
          onClose={() => setEditingTopic(null)}
          onSaved={checkFilledTopics}
        />
      )}

      {/* Chat panel */}
      {chatTopic && (
        <AgentChatPanel
          isOpen={!!chatTopic}
          onClose={() => { setChatTopic(null); checkFilledTopics() }}
          contextType="personalization"
          contextKey={chatTopic}
        />
      )}
    </div>
  )
}
