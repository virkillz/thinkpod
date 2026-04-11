import { useEffect, useState, useMemo } from 'react'
import { Inbox, FileText, Trash2, Sparkles, PenLine, Loader2, AlertTriangle, ChevronRight, Check, X } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'
import { MarkdownPreview } from '../codex/MarkdownPreview.js'
import { UniversalEditor } from '../editor/UniversalEditor.js'
import type { NoteTemplate } from '../views/SettingsView.js'

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

type TriageStep = 'classifying' | 'picking' | 'missing-fields' | 'filling' | 'reformatting' | 'preview' | 'moving'

interface MissingQuestion {
  field: string
  question: string
  hint?: string
}

interface TriageState {
  step: TriageStep
  detectedTemplateId: string | null
  confidence: number
  selectedTemplateId: string | null
  suggestedFolder: string
  missingQuestions: MissingQuestion[]
  userAnswers: { field: string; answer: string }[]
  reformattedContent: string | null
  error: string | null
}

// ─── Triage Wizard ────────────────────────────────────────────────────────────

interface TriageWizardProps {
  thought: Thought
  content: string
  onClose: () => void
  onDone: () => void
}

function TriageWizard({ thought, content, onClose, onDone }: TriageWizardProps) {
  const [templates, setTemplates] = useState<NoteTemplate[]>([])
  const [triage, setTriage] = useState<TriageState>({
    step: 'classifying',
    detectedTemplateId: null,
    confidence: 0,
    selectedTemplateId: null,
    suggestedFolder: '',
    missingQuestions: [],
    userAnswers: [],
    reformattedContent: null,
    error: null,
  })

  useEffect(() => {
    const init = async () => {
      const saved = (await window.electronAPI.getSetting('noteTemplates')) as NoteTemplate[] | null
      const tmplList: NoteTemplate[] = saved && Array.isArray(saved) && saved.length > 0 ? saved : []
      setTemplates(tmplList)

      const enabled = tmplList.filter((t) => t.isEnabled)
      if (enabled.length === 0) {
        setTriage((s) => ({ ...s, step: 'picking', error: 'No enabled templates found.' }))
        return
      }

      try {
        const result = await window.electronAPI.classifyThought(
          content,
          enabled.map((t) => ({ id: t.id, title: t.title, description: t.description }))
        )
        if (!result.success) {
          setTriage((s) => ({ ...s, step: 'picking', error: result.error ?? 'Classification failed' }))
          return
        }
        setTriage((s) => ({
          ...s,
          step: 'picking',
          detectedTemplateId: result.templateId ?? null,
          confidence: result.confidence ?? 0,
          selectedTemplateId: result.templateId ?? null,
          suggestedFolder: result.folder ?? '',
        }))
      } catch (e) {
        setTriage((s) => ({ ...s, step: 'picking', error: (e as Error).message }))
      }
    }
    init()
  }, [])

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === triage.selectedTemplateId) ?? null,
    [templates, triage.selectedTemplateId]
  )

  const handleConfirmTemplate = async () => {
    if (!selectedTemplate) return
    setTriage((s) => ({ ...s, step: 'missing-fields', error: null }))
    try {
      const result = await window.electronAPI.getMissingFields(content, selectedTemplate.format)
      if (!result.success) {
        setTriage((s) => ({ ...s, step: 'reformatting', missingQuestions: [] }))
        doReformat([], selectedTemplate)
        return
      }
      const questions: MissingQuestion[] = result.questions ?? []
      if (questions.length === 0) {
        setTriage((s) => ({ ...s, step: 'reformatting', missingQuestions: [] }))
        doReformat([], selectedTemplate)
      } else {
        setTriage((s) => ({
          ...s,
          step: 'filling',
          missingQuestions: questions,
          userAnswers: questions.map((q) => ({ field: q.field, answer: '' })),
        }))
      }
    } catch (e) {
      setTriage((s) => ({ ...s, step: 'reformatting', missingQuestions: [] }))
      doReformat([], selectedTemplate)
    }
  }

  const doReformat = async (answers: { field: string; answer: string }[], tmpl: NoteTemplate) => {
    const filledAnswers = answers.filter((a) => a.answer.trim() !== '')
    try {
      const result = await window.electronAPI.reformatThought(content, tmpl.format, filledAnswers)
      if (!result.success) {
        setTriage((s) => ({ ...s, step: 'preview', error: result.error ?? 'Reformat failed', reformattedContent: content }))
        return
      }
      setTriage((s) => ({ ...s, step: 'preview', reformattedContent: result.reformattedContent ?? null }))
    } catch (e) {
      setTriage((s) => ({ ...s, step: 'preview', error: (e as Error).message, reformattedContent: content }))
    }
  }

  const handleSubmitAnswers = () => {
    if (!selectedTemplate) return
    setTriage((s) => ({ ...s, step: 'reformatting' }))
    doReformat(triage.userAnswers, selectedTemplate)
  }

  const handleSaveAndMove = async () => {
    if (!triage.reformattedContent || !selectedTemplate) return
    setTriage((s) => ({ ...s, step: 'moving', error: null }))
    try {
      const folder = triage.suggestedFolder || selectedTemplate.defaultFolder
      const destPath = folder.replace(/\/$/, '') + '/' + thought.name
      await window.electronAPI.writeFile(thought.path, triage.reformattedContent)
      await window.electronAPI.moveFile(thought.path, destPath)
      onDone()
    } catch (e) {
      setTriage((s) => ({ ...s, step: 'preview', error: (e as Error).message }))
    }
  }

  const enabledTemplates = templates.filter((t) => t.isEnabled)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-parchment-card w-full max-w-2xl mx-4 rounded-2xl shadow-2xl border border-parchment-dark flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="font-serif font-medium text-ink-primary">Triage: {thought.name}</span>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {triage.step === 'classifying' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
              <p className="text-ink-muted">Classifying your thought…</p>
            </div>
          )}

          {triage.step === 'picking' && (
            <div className="space-y-5">
              {triage.detectedTemplateId && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-ink-muted">Detected:</span>
                  <span className="font-medium text-ink-primary">
                    {templates.find((t) => t.id === triage.detectedTemplateId)?.title ?? triage.detectedTemplateId}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    triage.confidence >= 0.6 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {Math.round(triage.confidence * 100)}% confidence
                  </span>
                  {triage.confidence < 0.6 && (
                    <span className="flex items-center gap-1 text-xs text-amber-600">
                      <AlertTriangle className="w-3 h-3" /> Low confidence
                    </span>
                  )}
                </div>
              )}
              {triage.error && (
                <p className="text-sm text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {triage.error}
                </p>
              )}
              <p className="text-sm text-ink-muted">Choose a template:</p>
              <div className="space-y-2">
                {enabledTemplates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTriage((s) => ({
                      ...s,
                      selectedTemplateId: t.id,
                      suggestedFolder: s.detectedTemplateId === t.id ? s.suggestedFolder : t.defaultFolder,
                    }))}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors flex items-center gap-3 ${
                      triage.selectedTemplateId === t.id
                        ? 'border-accent bg-accent/5 text-ink-primary'
                        : 'border-parchment-dark hover:border-accent/50 text-ink-muted'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                      triage.selectedTemplateId === t.id ? 'border-accent bg-accent' : 'border-ink-muted'
                    }`}>
                      {triage.selectedTemplateId === t.id && <Check className="w-2.5 h-2.5 text-white" />}
                    </span>
                    <span>
                      <span className="font-medium block text-ink-primary">{t.title}</span>
                      {t.description && <span className="text-xs text-ink-muted">{t.description}</span>}
                    </span>
                    <span className="ml-auto text-xs text-ink-muted">{t.defaultFolder}</span>
                  </button>
                ))}
              </div>
              {triage.selectedTemplateId && (
                <div className="pt-1">
                  <label className="block text-xs text-ink-muted mb-1">Destination folder</label>
                  <input
                    type="text"
                    value={triage.suggestedFolder}
                    onChange={(e) => setTriage((s) => ({ ...s, suggestedFolder: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-parchment-card border border-parchment-dark rounded-lg font-mono text-ink-primary focus:outline-none focus:border-accent"
                  />
                </div>
              )}
            </div>
          )}

          {triage.step === 'missing-fields' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
              <p className="text-ink-muted">Checking for missing information…</p>
            </div>
          )}

          {triage.step === 'filling' && (
            <div className="space-y-5">
              <p className="text-sm text-ink-muted">
                Some information seems missing. Answer what you can — all fields are optional.
              </p>
              <div className="space-y-4">
                {triage.missingQuestions.map((q, i) => (
                  <div key={q.field}>
                    <label className="block text-sm font-medium text-ink-primary mb-1">{q.question}</label>
                    {q.hint && <p className="text-xs text-ink-muted mb-1">{q.hint}</p>}
                    <input
                      type="text"
                      value={triage.userAnswers[i]?.answer ?? ''}
                      onChange={(e) => {
                        const answers = [...triage.userAnswers]
                        answers[i] = { field: q.field, answer: e.target.value }
                        setTriage((s) => ({ ...s, userAnswers: answers }))
                      }}
                      className="w-full px-3 py-2 text-sm bg-parchment-card border border-parchment-dark rounded-lg text-ink-primary focus:outline-none focus:border-accent"
                      placeholder="Leave blank to skip"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {triage.step === 'reformatting' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
              <p className="text-ink-muted">Reformatting your thought…</p>
            </div>
          )}

          {triage.step === 'preview' && (
            <div className="space-y-4">
              {triage.error && (
                <p className="text-sm text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {triage.error}
                </p>
              )}
              <div className="text-xs text-ink-muted flex items-center gap-1">
                Will move to:{' '}
                <span className="font-mono text-ink-primary">
                  {triage.suggestedFolder || selectedTemplate?.defaultFolder || '(unknown)'}
                </span>
              </div>
              <div className="bg-parchment-card border border-parchment-dark rounded-xl p-5 max-h-96 overflow-y-auto">
                <MarkdownPreview content={triage.reformattedContent ?? ''} />
              </div>
            </div>
          )}

          {triage.step === 'moving' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
              <p className="text-ink-muted">Saving and moving file…</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-parchment-dark">
          <button
            onClick={onClose}
            disabled={triage.step === 'moving'}
            className="px-4 py-2 text-sm text-ink-muted hover:text-ink-primary transition-colors disabled:opacity-40"
          >
            Discard
          </button>
          <div className="flex items-center gap-2">
            {triage.step === 'preview' && (
              <button
                onClick={() => setTriage((s) => ({ ...s, step: 'picking' }))}
                className="px-4 py-2 text-sm text-ink-muted hover:text-ink-primary transition-colors"
              >
                ← Back
              </button>
            )}
            {triage.step === 'picking' && (
              <button
                onClick={handleConfirmTemplate}
                disabled={!triage.selectedTemplateId}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-all disabled:opacity-40"
              >
                Confirm <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {triage.step === 'filling' && (
              <>
                <button onClick={handleSubmitAnswers} className="text-sm text-ink-muted hover:text-ink-primary transition-colors px-3 py-2">
                  Skip All
                </button>
                <button
                  onClick={handleSubmitAnswers}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-all"
                >
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
            {triage.step === 'preview' && (
              <button
                onClick={handleSaveAndMove}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-all"
              >
                <Check className="w-4 h-4" /> Save & Move
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── ThoughtsView ─────────────────────────────────────────────────────────────

export function ThoughtsView() {
  const { agentName, setCurrentView } = useAppStore()
  const [thoughts, setThoughts] = useState<Thought[]>([])

  const randomMessage = useMemo(() => {
    const index = Math.floor(Math.random() * INSPIRATIONAL_MESSAGES.length)
    return INSPIRATIONAL_MESSAGES[index]
  }, [])

  const [selectedThought, setSelectedThought] = useState<Thought | null>(null)
  const [liveContent, setLiveContent] = useState('')   // kept in sync for TriageWizard
  const [triageOpen, setTriageOpen] = useState(false)

  // suppress unused variable warning — agentName used in sidebar elsewhere
  void agentName

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

  const handleSelectThought = (thought: Thought) => {
    setSelectedThought(thought)
    setLiveContent('')
  }

  const handleDelete = async () => {
    if (!selectedThought) return
    if (!confirm(`Delete "${selectedThought.name}"?`)) return
    try {
      await window.electronAPI.deleteFile(selectedThought.path)
      setSelectedThought(null)
      setLiveContent('')
      loadThoughts()
    } catch {
      alert('Failed to delete file')
    }
  }

  const handleTriageDone = () => {
    setTriageOpen(false)
    setSelectedThought(null)
    setLiveContent('')
    loadThoughts()
  }

  // ── Detail view ────────────────────────────────────────────────────────────
  if (selectedThought) {
    return (
      <>
        <div className="flex-1 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark flex-shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setSelectedThought(null); setLiveContent('') }}
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
                onClick={() => setTriageOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-all shadow-sm hover:shadow-md"
              >
                <Sparkles className="w-4 h-4" />
                Triage
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>

          {/* Universal editor fills remaining space */}
          <UniversalEditor
            mode="edit"
            filePath={selectedThought.path}
            showViewToggle={true}
            onContentChange={setLiveContent}
          />
        </div>

        {triageOpen && (
          <TriageWizard
            thought={selectedThought}
            content={liveContent}
            onClose={() => setTriageOpen(false)}
            onDone={handleTriageDone}
          />
        )}
      </>
    )
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark">
        <div className="flex items-center gap-3">
          <Inbox className="w-5 h-5 text-accent" />
          <h2 className="font-serif font-medium text-lg text-ink-primary">Thoughts</h2>
        </div>
        <span className="text-sm text-ink-muted">Files awaiting triage</span>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {thoughts.length === 0 ? (
          <div className="max-w-2xl mx-auto text-center py-16">
            <div className="w-16 h-16 bg-gradient-to-br from-accent/20 to-accent/5 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Sparkles className="w-8 h-8 text-accent" />
            </div>
            <h3 className="font-serif text-xl text-ink-primary mb-2">{randomMessage.title}</h3>
            <p className="text-ink-muted max-w-md mx-auto mb-6">{randomMessage.subtitle}</p>
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
