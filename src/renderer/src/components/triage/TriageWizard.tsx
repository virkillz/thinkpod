import { useState, useEffect, useMemo } from 'react'
import { X, Loader2, Check, ChevronRight, Tag, FolderOpen, FileText } from 'lucide-react'
import { MarkdownPreview } from '../codex/MarkdownPreview.js'
import type { NoteTemplate } from '@main/vault/noteTemplates.js'
import { useAppStore } from '../../store/appStore.js'
import wilfredAvatar from '../../assets/avatar01.png'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MissingField {
  field: string
  question: string
  hint?: string
}

interface Assessment {
  templateId: string | null
  confidence: number
  folder: string
  alreadyFormatted: boolean
  missingFields: MissingField[]
  suggestedTags: string[]
}

type TriageStep = 'analyzing' | 'classify' | 'plan' | 'questioning' | 'reformatting' | 'preview'

interface TriageState {
  step: TriageStep
  assessment: Assessment | null
  selectedTemplateId: string | null
  doReformat: boolean
  doTags: boolean
  doMove: boolean
  editableTags: string[]
  newTagInput: string
  editableFolder: string
  questionIndex: number
  userAnswers: { field: string; answer: string }[]
  currentAnswer: string
  finalContent: string | null
  error: string | null
}

export interface TriageWizardProps {
  /** Display name shown in the header */
  fileName: string
  /** Absolute path to the file being triaged */
  filePath: string
  /** Live content from editor — if omitted the wizard reads from disk */
  content?: string
  onClose: () => void
  onDone: (newFilePath?: string) => void
}

// ─── Wilfred lines ────────────────────────────────────────────────────────────

const ANALYZING_LINES = [
  "Let me see what we've got here…",
  "Hmm, give me a moment…",
  "Taking a look at this…",
  "One sec, reading through…",
  "Interesting. Let me think about this…",
]

const REFORMATTING_LINES = [
  "On it, just a moment…",
  "Reformatting now…",
  "Tidying this up…",
  "Putting it all together…",
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract existing YAML frontmatter and body from content. */
function parseFrontmatter(content: string): { fm: Record<string, unknown>; body: string } {
  const hasFm = content.startsWith('---\n') || content.startsWith('---\r\n')
  if (!hasFm) return { fm: {}, body: content }

  const fmEnd = content.indexOf('\n---', 4)
  if (fmEnd === -1) return { fm: {}, body: content }

  const fmText = content.slice(4, fmEnd)
  const body = content.slice(fmEnd + 4).replace(/^\r?\n/, '')

  const fm: Record<string, unknown> = {}
  const lines = fmText.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const colonIdx = line.indexOf(':')
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim()
      const val = line.slice(colonIdx + 1).trim()
      if (!val) {
        const items: string[] = []
        while (i + 1 < lines.length && /^\s+-\s/.test(lines[i + 1])) {
          i++
          items.push(lines[i].replace(/^\s+-\s*/, '').trim())
        }
        fm[key] = items.length > 0 ? items : null
      } else if (val.startsWith('[') && val.endsWith(']')) {
        fm[key] = val
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      } else {
        fm[key] = val
      }
    }
    i++
  }

  return { fm, body }
}

/** Build Obsidian-compatible YAML frontmatter block. */
function buildFrontmatter(fields: {
  title?: string
  tags?: string[]
  created?: string
  type?: string
  extra?: Record<string, unknown>
}): string {
  const lines: string[] = ['---']

  if (fields.title) lines.push(`title: ${fields.title}`)

  if (fields.tags && fields.tags.length > 0) {
    lines.push('tags:')
    for (const tag of fields.tags) lines.push(` - ${tag}`)
  }

  if (fields.created) lines.push(`created: ${fields.created}`)
  if (fields.type) lines.push(`type: ${fields.type}`)

  if (fields.extra) {
    const CORE = new Set(['title', 'tags', 'created', 'type'])
    for (const [k, v] of Object.entries(fields.extra)) {
      if (CORE.has(k) || v === null || v === undefined) continue
      if (Array.isArray(v)) {
        lines.push(`${k}:`)
        for (const item of v) lines.push(` - ${item}`)
      } else {
        lines.push(`${k}: ${v}`)
      }
    }
  }

  lines.push('---')
  return lines.join('\n')
}

function applyFrontmatter(
  content: string,
  tags: string[],
  templateId: string | null,
  fileName: string,
): string {
  const today = new Date().toISOString().split('T')[0]
  const { fm: existing, body } = parseFrontmatter(content)

  let title = (existing.title as string | undefined) ?? ''
  if (!title) {
    const h1 = body.match(/^#\s+(.+)$/m)
    title = h1 ? h1[1].trim() : fileName.replace(/\.md$/i, '')
  }

  const frontmatter = buildFrontmatter({
    title: title || undefined,
    tags: tags.length > 0 ? tags : undefined,
    created: today,
    type: templateId ?? undefined,
    extra: existing,
  })

  return `${frontmatter}\n\n${body}`
}

// ─── TriageWizard ─────────────────────────────────────────────────────────────

export function TriageWizard({ fileName, filePath, content: initialContent, onClose, onDone }: TriageWizardProps) {
  const { agentName, agentAvatar } = useAppStore()
  const [templates, setTemplates] = useState<NoteTemplate[]>([])
  const [analyzingLine] = useState(() => ANALYZING_LINES[Math.floor(Math.random() * ANALYZING_LINES.length)])
  const [reformattingLine] = useState(() => REFORMATTING_LINES[Math.floor(Math.random() * REFORMATTING_LINES.length)])
  const [state, setState] = useState<TriageState>({
    step: 'analyzing',
    assessment: null,
    selectedTemplateId: null,
    doReformat: true,
    doTags: false,
    doMove: false,
    editableTags: [],
    newTagInput: '',
    editableFolder: '',
    questionIndex: 0,
    userAnswers: [],
    currentAnswer: '',
    finalContent: null,
    error: null,
  })

  const enabledTemplates = templates.filter((t) => t.isEnabled)
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === state.selectedTemplateId) ?? null,
    [templates, state.selectedTemplateId]
  )

  const totalQuestions = state.assessment?.missingFields.length ?? 0
  const currentQuestion = state.assessment?.missingFields[state.questionIndex] ?? null
  const currentFolder = filePath.split('/').slice(0, -1).join('/')

  // ── Bootstrap ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const run = async () => {
      const saved = (await window.electronAPI.getSetting('noteTemplates')) as NoteTemplate[] | null
      const tmplList: NoteTemplate[] = saved && Array.isArray(saved) && saved.length > 0 ? saved : []
      setTemplates(tmplList)

      const enabled = tmplList.filter((t) => t.isEnabled)
      if (enabled.length === 0) {
        setState((s) => ({ ...s, step: 'classify', error: 'No enabled templates — please pick one to continue.' }))
        return
      }

      let content = initialContent ?? ''
      if (!content) {
        try {
          const result = await window.electronAPI.readFile(filePath)
          content = result.content
        } catch {
          content = ''
        }
      }

      try {
        const result = await window.electronAPI.assessThought(
          content,
          enabled.map((t) => ({ id: t.id, title: t.title, description: t.description, defaultFolder: t.defaultFolder })),
          currentFolder
        )

        console.log('[TriageWizard] assessThought raw result:', result)

        if (!result.success) {
          setState((s) => ({ ...s, step: 'classify', error: result.error ?? 'Assessment failed' }))
          return
        }

        const assessment: Assessment = {
          templateId: result.templateId ?? null,
          confidence: result.confidence ?? 0,
          folder: result.folder ?? '',
          alreadyFormatted: result.alreadyFormatted ?? false,
          missingFields: result.missingFields ?? [],
          suggestedTags: result.suggestedTags ?? [],
        }

        const resolvedTemplateId = assessment.templateId ?? enabled[0]?.id ?? null
        const matchedTemplate = tmplList.find((t) => t.id === resolvedTemplateId)
        const suggestedFolder = assessment.folder || matchedTemplate?.defaultFolder || ''

        setState((s) => ({
          ...s,
          step: 'classify',
          assessment: { ...assessment, templateId: resolvedTemplateId },
          selectedTemplateId: resolvedTemplateId,
          editableTags: assessment.suggestedTags,
          editableFolder: suggestedFolder,
          doReformat: !assessment.alreadyFormatted,
          doTags: matchedTemplate?.requireTags ?? false,
          doMove: suggestedFolder !== '' && suggestedFolder !== currentFolder,
          userAnswers: assessment.missingFields.map((q) => ({ field: q.field, answer: '' })),
          error: null,
        }))
      } catch (e) {
        setState((s) => ({ ...s, step: 'classify', error: (e as Error).message }))
      }
    }
    run()
  }, [])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSelectTemplate = (id: string) => {
    const tmpl = templates.find((t) => t.id === id)
    const suggestedFolder =
      state.assessment?.templateId === id
        ? state.assessment.folder || tmpl?.defaultFolder || ''
        : tmpl?.defaultFolder || ''
    setState((s) => ({
      ...s,
      selectedTemplateId: id,
      editableFolder: suggestedFolder,
      doReformat: !(s.assessment?.alreadyFormatted ?? false),
      doTags: tmpl?.requireTags ?? false,
      doMove: suggestedFolder !== '' && suggestedFolder !== currentFolder,
    }))
  }

  const handleConfirmClassify = () => {
    setState((s) => ({ ...s, step: 'plan' }))
  }

  const handleConfirmPlan = () => {
    if (totalQuestions > 0) {
      setState((s) => ({ ...s, step: 'questioning', questionIndex: 0, currentAnswer: '' }))
    } else {
      doApply(state.userAnswers)
    }
  }

  const handleQuestionAnswer = (answer: string, skip = false) => {
    const answers = [...state.userAnswers]
    const idx = state.questionIndex
    answers[idx] = { field: state.assessment!.missingFields[idx].field, answer: skip ? '' : answer }

    if (idx + 1 < totalQuestions) {
      setState((s) => ({ ...s, userAnswers: answers, questionIndex: idx + 1, currentAnswer: '' }))
    } else {
      setState((s) => ({ ...s, userAnswers: answers }))
      doApply(answers)
    }
  }

  const handleQuestionBack = () => {
    if (state.questionIndex > 0) {
      setState((s) => ({ ...s, questionIndex: s.questionIndex - 1, currentAnswer: s.userAnswers[s.questionIndex - 1]?.answer ?? '' }))
    } else {
      setState((s) => ({ ...s, step: 'plan' }))
    }
  }

  const doApply = async (answers: { field: string; answer: string }[]) => {
    const { doReformat, doTags, editableTags, selectedTemplateId } = state
    setState((s) => ({ ...s, step: 'reformatting', error: null }))

    let content = initialContent ?? ''
    if (!content) {
      try {
        const result = await window.electronAPI.readFile(filePath)
        content = result.content
      } catch {
        content = ''
      }
    }

    let finalContent = content

    if (doReformat && selectedTemplate) {
      try {
        const filledAnswers = answers.filter((a) => a.answer.trim() !== '')
        const result = await window.electronAPI.reformatThought(content, selectedTemplate.format, filledAnswers)
        if (result.success && result.reformattedContent) {
          finalContent = result.reformattedContent
        }
      } catch {
        // fall through with original content
      }
    }

    const tags = doTags ? editableTags : []
    finalContent = applyFrontmatter(finalContent, tags, selectedTemplateId, fileName)

    setState((s) => ({ ...s, step: 'preview', finalContent, error: null }))
  }

  const handleSaveAndApply = async () => {
    if (!state.finalContent) return
    setState((s) => ({ ...s, error: null }))
    try {
      await window.electronAPI.writeFile(filePath, state.finalContent)
      let newFilePath: string | undefined
      if (state.doMove && state.editableFolder) {
        const destPath = state.editableFolder.replace(/\/$/, '') + '/' + fileName
        if (destPath !== filePath) {
          await window.electronAPI.moveFile(filePath, destPath)
          newFilePath = destPath
        }
      }
      onDone(newFilePath)
    } catch (e) {
      setState((s) => ({ ...s, error: (e as Error).message }))
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative flex items-end gap-5 w-full max-w-3xl">

        {/* Agent avatar */}
        <div className="relative flex-shrink-0 flex flex-col items-center gap-2 mb-2 z-10">
          <div className="w-20 h-20 rounded-full overflow-hidden shadow-lg ring-4 ring-accent/20 animate-breathe">
            <img src={agentAvatar || wilfredAvatar} alt={agentName} className="w-full h-full object-cover" />
          </div>
          <span className="text-xs text-ink-muted font-medium tracking-wide">{agentName}</span>
        </div>

        {/* Speech bubble */}
        <div className="relative flex-1 z-10">
          {/* Tail */}
          <div
            className="absolute left-0 bottom-10 -translate-x-[11px]"
            style={{
              width: 0,
              height: 0,
              borderTop: '10px solid transparent',
              borderBottom: '10px solid transparent',
              borderRight: '12px solid var(--color-parchment-card)',
            }}
          />

          {/* Card */}
          <div className="bg-parchment-card rounded-2xl shadow-2xl flex flex-col min-h-[420px]">

            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-ink-muted hover:text-ink-primary transition-colors z-20"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Body */}
            <div className="flex-1 p-10">

              {/* Analyzing */}
              {state.step === 'analyzing' && (
                <div className="flex flex-col justify-center h-full gap-5 py-8">
                  <Loader2 className="w-6 h-6 text-accent animate-spin" />
                  <p className="font-serif text-xl text-ink-primary">{analyzingLine}</p>
                </div>
              )}

              {/* Classify */}
              {state.step === 'classify' && (
                <div className="space-y-6">
                  <p className="font-serif text-xl text-ink-primary">
                    {state.assessment
                      ? `I think this is a ${selectedTemplate?.title ?? '…'} — ${Math.round(state.assessment.confidence * 100)}% sure. Sound right?`
                      : 'What type of note is this?'}
                  </p>
                  {state.error && (
                    <p className="text-sm text-amber-600">{state.error}</p>
                  )}
                  <div className="space-y-2">
                    {enabledTemplates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleSelectTemplate(t.id)}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-colors flex items-center gap-3 ${
                          state.selectedTemplateId === t.id
                            ? 'border-accent bg-accent/5'
                            : 'border-parchment-dark hover:border-accent/40'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                            state.selectedTemplateId === t.id ? 'border-accent bg-accent' : 'border-ink-muted'
                          }`}
                        >
                          {state.selectedTemplateId === t.id && <Check className="w-2.5 h-2.5 text-white" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="font-medium block text-ink-primary">{t.title}</span>
                          {t.description && (
                            <span className="text-xs text-ink-muted truncate block">{t.description}</span>
                          )}
                        </span>
                        {state.assessment?.templateId === t.id && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                              state.assessment.confidence >= 0.7
                                ? 'bg-green-100 text-green-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {Math.round(state.assessment.confidence * 100)}%
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Plan */}
              {state.step === 'plan' && (
                <div className="space-y-6">
                  <p className="font-serif text-xl text-ink-primary">
                    {state.doReformat || state.doTags || state.doMove
                      ? "Here's what I'm thinking:"
                      : 'Looks like this note is already well-structured. I\'ll just add the classification and we\'re done.'}
                  </p>

                  <div className="space-y-5">
                    {state.doReformat && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 w-5 h-5 rounded border-2 border-accent bg-accent flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-ink-muted" />
                            <span className="text-sm font-medium text-ink-primary">Reformat to template</span>
                            <button
                              onClick={() => setState((s) => ({ ...s, doReformat: false }))}
                              className="ml-auto text-xs text-ink-muted hover:text-ink-primary transition-colors"
                            >
                              skip
                            </button>
                          </div>
                          <p className="text-xs text-ink-muted mt-0.5 ml-6">
                            Restructure content to match the {selectedTemplate?.title} template
                          </p>
                        </div>
                      </div>
                    )}

                    {state.doTags && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 w-5 h-5 rounded border-2 border-accent bg-accent flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4 text-ink-muted" />
                            <span className="text-sm font-medium text-ink-primary">Add tags</span>
                            <button
                              onClick={() => setState((s) => ({ ...s, doTags: false }))}
                              className="ml-auto text-xs text-ink-muted hover:text-ink-primary transition-colors"
                            >
                              skip
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5 ml-6">
                            {state.editableTags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/10 text-accent rounded-full text-xs font-medium"
                              >
                                #{tag}
                                <button
                                  onClick={() =>
                                    setState((s) => ({ ...s, editableTags: s.editableTags.filter((t) => t !== tag) }))
                                  }
                                  className="hover:text-accent/60 transition-colors"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </span>
                            ))}
                            <input
                              type="text"
                              value={state.newTagInput}
                              onChange={(e) => setState((s) => ({ ...s, newTagInput: e.target.value }))}
                              onKeyDown={(e) => {
                                if ((e.key === 'Enter' || e.key === ' ') && state.newTagInput.trim()) {
                                  e.preventDefault()
                                  const tag = state.newTagInput
                                    .trim()
                                    .toLowerCase()
                                    .replace(/^#/, '')
                                    .replace(/\s+/g, '-')
                                  if (tag && !state.editableTags.includes(tag)) {
                                    setState((s) => ({ ...s, editableTags: [...s.editableTags, tag], newTagInput: '' }))
                                  } else {
                                    setState((s) => ({ ...s, newTagInput: '' }))
                                  }
                                }
                              }}
                              placeholder="+ add tag"
                              className="text-xs px-2 py-0.5 bg-transparent border border-dashed border-ink-muted rounded-full text-ink-muted placeholder:text-ink-light focus:outline-none focus:border-accent w-20"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {state.doMove && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 w-5 h-5 rounded border-2 border-accent bg-accent flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <FolderOpen className="w-4 h-4 text-ink-muted" />
                            <span className="text-sm font-medium text-ink-primary">Move to folder</span>
                            <button
                              onClick={() => setState((s) => ({ ...s, doMove: false }))}
                              className="ml-auto text-xs text-ink-muted hover:text-ink-primary transition-colors"
                            >
                              skip
                            </button>
                          </div>
                          <input
                            type="text"
                            value={state.editableFolder}
                            onChange={(e) => setState((s) => ({ ...s, editableFolder: e.target.value }))}
                            className="w-full px-3 py-1.5 text-sm bg-parchment-base border border-parchment-dark rounded-lg font-mono text-ink-primary focus:outline-none focus:border-accent ml-6"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Questioning */}
              {state.step === 'questioning' && currentQuestion && (
                <div className="space-y-5">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="font-serif text-xl text-ink-primary">{currentQuestion.question}</p>
                    {totalQuestions > 1 && (
                      <span className="text-xs text-ink-muted flex-shrink-0">
                        {state.questionIndex + 1} of {totalQuestions}
                      </span>
                    )}
                  </div>
                  {currentQuestion.hint && (
                    <p className="text-sm text-ink-muted -mt-2">{currentQuestion.hint}</p>
                  )}
                  <input
                    key={state.questionIndex}
                    type="text"
                    autoFocus
                    value={state.currentAnswer}
                    onChange={(e) => setState((s) => ({ ...s, currentAnswer: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleQuestionAnswer(state.currentAnswer)
                    }}
                    placeholder="Your answer…"
                    className="w-full px-3 py-2.5 text-sm bg-parchment-base border border-parchment-dark rounded-xl text-ink-primary focus:outline-none focus:border-accent"
                  />
                </div>
              )}

              {/* Reformatting */}
              {state.step === 'reformatting' && (
                <div className="flex flex-col justify-center h-full gap-5 py-8">
                  <Loader2 className="w-6 h-6 text-accent animate-spin" />
                  <p className="font-serif text-xl text-ink-primary">{reformattingLine}</p>
                </div>
              )}

              {/* Preview */}
              {state.step === 'preview' && (
                <div className="space-y-4">
                  <p className="font-serif text-xl text-ink-primary">Here's the result — happy with this?</p>
                  {state.error && (
                    <p className="text-sm text-amber-600">{state.error}</p>
                  )}
                  {state.doMove && state.editableFolder && (
                    <div className="text-xs text-ink-muted flex items-center gap-1.5">
                      <FolderOpen className="w-3.5 h-3.5" />
                      Will move to:{' '}
                      <span className="font-mono text-ink-primary">{state.editableFolder}</span>
                    </div>
                  )}
                  <div className="bg-parchment-base border border-parchment-dark rounded-xl p-5 max-h-64 overflow-y-auto">
                    <MarkdownPreview content={state.finalContent ?? ''} />
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-10 py-5 border-t border-parchment-dark flex-shrink-0">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-ink-muted hover:text-ink-primary transition-colors"
              >
                Discard
              </button>

              <div className="flex items-center gap-2">
                {/* Back buttons */}
                {state.step === 'plan' && (
                  <button
                    onClick={() => setState((s) => ({ ...s, step: 'classify' }))}
                    className="px-4 py-2 text-sm text-ink-muted hover:text-ink-primary transition-colors"
                  >
                    ← Back
                  </button>
                )}
                {state.step === 'questioning' && (
                  <button
                    onClick={handleQuestionBack}
                    className="px-4 py-2 text-sm text-ink-muted hover:text-ink-primary transition-colors"
                  >
                    ← Back
                  </button>
                )}
                {state.step === 'preview' && (
                  <button
                    onClick={() =>
                      setState((s) => ({
                        ...s,
                        step: totalQuestions > 0 ? 'questioning' : 'plan',
                        questionIndex: Math.max(0, totalQuestions - 1),
                        currentAnswer: s.userAnswers[Math.max(0, totalQuestions - 1)]?.answer ?? '',
                      }))
                    }
                    className="px-4 py-2 text-sm text-ink-muted hover:text-ink-primary transition-colors"
                  >
                    ← Back
                  </button>
                )}

                {/* Primary actions */}
                {state.step === 'classify' && (
                  <button
                    onClick={handleConfirmClassify}
                    disabled={!state.selectedTemplateId}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-all disabled:opacity-40"
                  >
                    That's right <ChevronRight className="w-4 h-4" />
                  </button>
                )}

                {state.step === 'plan' && (
                  <button
                    onClick={handleConfirmPlan}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-all"
                  >
                    Sounds good <ChevronRight className="w-4 h-4" />
                  </button>
                )}

                {state.step === 'questioning' && (
                  <>
                    <button
                      onClick={() => handleQuestionAnswer('', true)}
                      className="text-sm text-ink-muted hover:text-ink-primary transition-colors px-3 py-2"
                    >
                      Skip
                    </button>
                    <button
                      onClick={() => handleQuestionAnswer(state.currentAnswer)}
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-all"
                    >
                      {state.questionIndex + 1 === totalQuestions ? 'Done' : 'Next'}{' '}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}

                {state.step === 'preview' && (
                  <button
                    onClick={handleSaveAndApply}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-all"
                  >
                    <Check className="w-4 h-4" /> Keep it
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
