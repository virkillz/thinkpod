import { useState, useEffect } from 'react'
import { Heart, Compass, Briefcase, Activity, Users, X, Save, Loader2, MessageSquare, RefreshCw, ToggleLeft, ToggleRight, UserCircle2 } from 'lucide-react'
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

// ─── Summary edit modal ───────────────────────────────────────────────────────

function EditSummaryModal({
  initialContent,
  onClose,
  onSaved,
}: {
  initialContent: string
  onClose: () => void
  onSaved: (content: string) => void
}) {
  const [content, setContent] = useState(initialContent)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await window.electronAPI.writePersonalizationSummary(content)
    setSaving(false)
    onSaved(content)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-parchment-card rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-parchment-dark">
          <span className="font-medium text-ink-primary text-sm">Edit Profile Summary</span>
          <button onClick={onClose} className="p-1.5 hover:bg-parchment-sidebar rounded-lg transition-colors">
            <X className="w-4 h-4 text-ink-muted" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={`## User Quick Facts\n- Name: Alex, 34, based in Jakarta\n- Occupation: …`}
            className="w-full h-64 px-3 py-2.5 bg-parchment rounded-lg border border-parchment-dark text-ink-primary text-sm leading-relaxed placeholder:text-ink-light resize-none focus:outline-none focus:border-accent/50 font-mono"
          />
          <p className="text-xs text-ink-muted mt-2">
            Saved to{' '}
            <code className="bg-parchment-sidebar px-1 py-0.5 rounded">.thinkpod/user_profile/summary.md</code>
          </p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-parchment-dark">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-ink-muted hover:text-ink-primary transition-colors">
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

  // Master feature toggle
  const [featureEnabled, setFeatureEnabled] = useState(false)
  const [featureLoading, setFeatureLoading] = useState(true)

  // Which topics already have content
  const [filledTopics, setFilledTopics] = useState<Set<Topic>>(new Set())

  // Edit modal state
  const [editingTopic, setEditingTopic] = useState<(typeof TOPICS)[number] | null>(null)
  const [editingContent, setEditingContent] = useState('')

  // Chat panel state
  const [chatTopic, setChatTopic] = useState<Topic | null>(null)
  const [chatForceNew, setChatForceNew] = useState(false)

  // Profile summary state
  const [summaryContent, setSummaryContent] = useState<string | null>(null)
  const [editingSummary, setEditingSummary] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const checkFilledTopics = async () => {
    const filled = new Set<Topic>()
    for (const topic of TOPICS) {
      const result = await window.electronAPI.getPersonalizationTopic(topic.id)
      if (result.content) filled.add(topic.id)
    }
    setFilledTopics(filled)
  }

  const loadSettings = async () => {
    const [summaryResult, featureResult] = await Promise.all([
      window.electronAPI.getPersonalizationSummary(),
      window.electronAPI.getSetting('personalizationEnabled'),
    ])
    setSummaryContent(summaryResult.content)
    setFeatureEnabled(!!featureResult)
    setFeatureLoading(false)
  }

  useEffect(() => {
    checkFilledTopics()
    loadSettings()
  }, [])

  const handleToggleFeature = async () => {
    const next = !featureEnabled
    setFeatureEnabled(next)
    await window.electronAPI.setSetting('personalizationEnabled', next)
  }

  const handleOpen = async (topic: (typeof TOPICS)[number]) => {
    const result = await window.electronAPI.getPersonalizationTopic(topic.id)
    setEditingContent(result.content ?? '')
    setEditingTopic(topic)
  }

  const handleChat = (topic: Topic, isFilled: boolean) => {
    setChatForceNew(isFilled)
    setChatTopic(topic)
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncError(null)
    const result = await window.electronAPI.syncPersonalizationSummary()
    setSyncing(false)
    if (result.success) {
      setSummaryContent(result.content ?? null)
    } else {
      setSyncError(result.error ?? 'Sync failed')
    }
  }

  const summaryPreview = summaryContent
    ? summaryContent.split('\n').filter(l => l.trim()).slice(0, 4).join('\n')
    : null

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* ── Master toggle card ─────────────────────────────────────── */}
      <div className={`rounded-xl border p-5 transition-colors ${featureEnabled ? 'bg-parchment-card border-accent/30' : 'bg-parchment-card border-parchment-dark'}`}>
        <div className="flex items-start gap-4">
          <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${featureEnabled ? 'bg-accent/10' : 'bg-parchment-sidebar'}`}>
            <UserCircle2 className={`w-6 h-6 transition-colors ${featureEnabled ? 'text-accent' : 'text-ink-light'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-sm text-ink-primary">Personalization</h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  {featureEnabled
                    ? `${agentName} will use your profile to personalize every conversation.`
                    : `Teach ${agentName} who you are — your interests, career, values, and more.`}
                </p>
              </div>
              {!featureLoading && (
                <button
                  onClick={handleToggleFeature}
                  className="shrink-0 transition-colors"
                  title={featureEnabled ? 'Disable personalization' : 'Enable personalization'}
                >
                  {featureEnabled
                    ? <ToggleRight className="w-9 h-9 text-accent" />
                    : <ToggleLeft className="w-9 h-9 text-ink-light" />}
                </button>
              )}
            </div>
            {!featureEnabled && (
              <p className="text-xs text-ink-muted mt-3 leading-relaxed">
                Build a profile by chatting naturally with {agentName} across a few topics. Each topic is saved as a plain
                Markdown file — fully transparent and editable. Once your profile is ready, a summary gets injected into
                every conversation so {agentName} always has context about who you are.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Content (shown only when enabled) ─────────────────────── */}
      {featureEnabled && (
        <>
          {/* Step 1 */}
          <div>
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">
              Step 1 — Build your profile
            </p>
            <p className="text-xs text-ink-muted mb-3">
              Fill at least one topic below, or better yet — click <strong>Chat</strong> and let {agentName} interview you. It will write the file for you.
            </p>
            <div className="space-y-2">
              {TOPICS.map(topic => {
                const isFilled = filledTopics.has(topic.id)
                return (
                  <div
                    key={topic.id}
                    className="bg-parchment-card rounded-xl border border-parchment-dark p-4 flex items-center gap-4"
                  >
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
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleOpen(topic)}
                        className="px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink-primary border border-parchment-dark rounded-lg transition-colors"
                      >
                        Open
                      </button>
                      <button
                        onClick={() => handleChat(topic.id, isFilled)}
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
          </div>

          {/* Step 2 */}
          <div className={filledTopics.size === 0 ? 'opacity-40 pointer-events-none select-none' : ''}>
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">
              Step 2 — Generate summary
            </p>
            {filledTopics.size === 0 ? (
              <p className="text-xs text-ink-muted mb-3">Fill at least one topic above to unlock this step.</p>
            ) : (
              <p className="text-xs text-ink-muted mb-3">
                Click <strong>Sync</strong> to regenerate the summary from your topics above. You can also edit it manually.
                This summary is included in every chat with {agentName} as part of the system prompt, so it will always know who you are.
              </p>
            )}
            <div className="bg-parchment-card rounded-xl border border-parchment-dark overflow-hidden">
              <div className="px-4 py-3 border-b border-parchment-dark">
                <span className="font-medium text-sm text-ink-primary">Profile Summary</span>
              </div>

              <div className="px-4 py-3">
                {summaryPreview ? (
                  <pre className="text-xs text-ink-muted font-mono whitespace-pre-wrap leading-relaxed line-clamp-4">
                    {summaryPreview}
                  </pre>
                ) : (
                  <p className="text-xs text-ink-light italic">
                    No summary yet. Click <strong>Sync</strong> to generate one from your profile topics, or <strong>Edit</strong> to write manually.
                  </p>
                )}
                {syncError && (
                  <p className="text-xs text-red-500 mt-2">{syncError}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-parchment-dark">
                <button
                  onClick={() => setEditingSummary(true)}
                  className="px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink-primary border border-parchment-dark rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent hover:bg-accent/90 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Sync
                </button>
              </div>
            </div>
          </div>

          {/* Storage hint */}
          <div className="rounded-xl border border-parchment-dark bg-parchment-sidebar p-4 text-xs text-ink-muted">
            Files are stored at{' '}
            <code className="bg-parchment-card px-1 py-0.5 rounded">{'{vault}'}/.thinkpod/user_profile/</code> — fully
            transparent and editable with any text editor.
          </div>
        </>
      )}

      {/* Edit topic modal */}
      {editingTopic && (
        <EditTopicModal
          topic={editingTopic}
          initialContent={editingContent}
          onClose={() => setEditingTopic(null)}
          onSaved={checkFilledTopics}
        />
      )}

      {/* Edit summary modal */}
      {editingSummary && (
        <EditSummaryModal
          initialContent={summaryContent ?? ''}
          onClose={() => setEditingSummary(false)}
          onSaved={(content) => setSummaryContent(content || null)}
        />
      )}

      {/* Chat panel */}
      {chatTopic && (
        <AgentChatPanel
          isOpen={!!chatTopic}
          onClose={() => { setChatTopic(null); checkFilledTopics() }}
          contextType="personalization"
          contextKey={chatTopic}
          forceNew={chatForceNew}
        />
      )}
    </div>
  )
}
