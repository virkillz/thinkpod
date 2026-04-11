import { useEffect, useState, useMemo } from 'react'
import {
  Sparkles, X, Loader2, AlertTriangle, Check, ChevronRight,
  Tag, FolderOpen, FileText, Pencil,
} from 'lucide-react'
import { MarkdownPreview } from '../codex/MarkdownPreview.js'
import type { NoteTemplate } from '../views/SettingsView.js'

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

interface Checklist {
  reformat: boolean
  fillMissing: boolean
  addTags: boolean
  moveTo: boolean
}

type TriageStep = 'assessing' | 'checklist' | 'filling' | 'applying' | 'preview'

interface TriageState {
  step: TriageStep
  assessment: Assessment | null
  selectedTemplateId: string | null
  checklist: Checklist
  editableTags: string[]
  newTagInput: string
  editableFolder: string
  userAnswers: { field: string; answer: string }[]
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
  onDone: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function injectTags(content: string, tags: string[]): string {
  if (tags.length === 0) return content
  const tagLine = `tags: [${tags.join(', ')}]`

  if (content.startsWith('---\n') || content.startsWith('---\r\n')) {
    const fmEnd = content.indexOf('\n---', 4)
    if (fmEnd !== -1) {
      const fmBody = content.slice(4, fmEnd)
      if (/^tags:/m.test(fmBody)) {
        const newFm = fmBody.replace(/^tags:.*$/m, tagLine)
        return `---\n${newFm}\n---${content.slice(fmEnd + 4)}`
      }
      return `---\n${fmBody}\n${tagLine}\n---${content.slice(fmEnd + 4)}`
    }
  }
  return `---\n${tagLine}\n---\n\n${content}`
}

// ─── ChecklistRow ─────────────────────────────────────────────────────────────

function ChecklistRow({
  checked,
  onChange,
  icon,
  label,
  detail,
  dimmed,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  icon: React.ReactNode
  label: string
  detail?: string
  dimmed?: boolean
}) {
  return (
    <div className="flex gap-3">
      <button
        onClick={() => onChange(!checked)}
        className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
          checked ? 'border-accent bg-accent' : 'border-ink-muted bg-transparent'
        }`}
      >
        {checked && <Check className="w-3 h-3 text-white" />}
      </button>
      <div>
        <div className="flex items-center gap-2">
          <span className={dimmed ? 'text-ink-light' : 'text-ink-muted'}>{icon}</span>
          <span className={`text-sm font-medium ${checked ? 'text-ink-primary' : 'text-ink-muted'}`}>
            {label}
          </span>
        </div>
        {detail && <p className="text-xs text-ink-muted mt-0.5 ml-0">{detail}</p>}
      </div>
    </div>
  )
}

// ─── TriageWizard ─────────────────────────────────────────────────────────────

export function TriageWizard({ fileName, filePath, content: initialContent, onClose, onDone }: TriageWizardProps) {
  const [templates, setTemplates] = useState<NoteTemplate[]>([])
  const [state, setState] = useState<TriageState>({
    step: 'assessing',
    assessment: null,
    selectedTemplateId: null,
    checklist: { reformat: true, fillMissing: true, addTags: true, moveTo: true },
    editableTags: [],
    newTagInput: '',
    editableFolder: '',
    userAnswers: [],
    finalContent: null,
    error: null,
  })

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === state.selectedTemplateId) ?? null,
    [templates, state.selectedTemplateId]
  )

  const enabledTemplates = templates.filter((t) => t.isEnabled)

  // ── Bootstrap: load templates then run assessment ───────────────────────────
  useEffect(() => {
    const run = async () => {
      const saved = (await window.electronAPI.getSetting('noteTemplates')) as NoteTemplate[] | null
      const tmplList: NoteTemplate[] = saved && Array.isArray(saved) && saved.length > 0 ? saved : []
      setTemplates(tmplList)

      const enabled = tmplList.filter((t) => t.isEnabled)
      if (enabled.length === 0) {
        setState((s) => ({ ...s, step: 'checklist', error: 'No enabled templates — assessment skipped.' }))
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
        const currentFolder = filePath.split('/').slice(0, -1).join('/')
        const result = await window.electronAPI.assessThought(
          content,
          enabled.map((t) => ({ id: t.id, title: t.title, description: t.description, defaultFolder: t.defaultFolder })),
          currentFolder
        )

        console.log('[TriageWizard] assessThought raw result:', result)

        if (!result.success) {
          console.error('[TriageWizard] assessment failed:', result.error)
          setState((s) => ({ ...s, step: 'checklist', error: result.error ?? 'Assessment failed' }))
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
        const hasMissing = assessment.missingFields.length > 0
        const requiresTags = matchedTemplate?.requireTags ?? false

        setState((s) => ({
          ...s,
          step: 'checklist',
          assessment: { ...assessment, templateId: resolvedTemplateId },
          selectedTemplateId: resolvedTemplateId,
          editableTags: assessment.suggestedTags,
          editableFolder: assessment.folder || matchedTemplate?.defaultFolder || '',
          checklist: {
            reformat: !assessment.alreadyFormatted,
            fillMissing: hasMissing,
            addTags: requiresTags,
            moveTo: true,
          },
          userAnswers: assessment.missingFields.map((q) => ({ field: q.field, answer: '' })),
          error: null,
        }))
      } catch (e) {
        setState((s) => ({ ...s, step: 'checklist', error: (e as Error).message }))
      }
    }
    run()
  }, [])

  // Sync checklist when user picks a different template
  const handleSelectTemplate = (id: string) => {
    const tmpl = templates.find((t) => t.id === id)
    setState((s) => ({
      ...s,
      selectedTemplateId: id,
      editableFolder:
        s.assessment?.templateId === id
          ? s.assessment.folder || tmpl?.defaultFolder || ''
          : tmpl?.defaultFolder || '',
      checklist: {
        ...s.checklist,
        addTags: tmpl?.requireTags ?? false,
      },
    }))
  }

  // ── Apply flow ──────────────────────────────────────────────────────────────
  const handleApplyFromChecklist = () => {
    if (state.checklist.fillMissing && (state.assessment?.missingFields ?? []).length > 0) {
      setState((s) => ({ ...s, step: 'filling' }))
    } else {
      doApply(state.userAnswers)
    }
  }

  const doApply = async (answers: { field: string; answer: string }[]) => {
    setState((s) => ({ ...s, step: 'applying', error: null }))

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

    if (state.checklist.reformat && selectedTemplate) {
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

    if (state.checklist.addTags && state.editableTags.length > 0) {
      finalContent = injectTags(finalContent, state.editableTags)
    }

    setState((s) => ({ ...s, step: 'preview', finalContent, error: null }))
  }

  const handleSaveAndApply = async () => {
    if (!state.finalContent) return
    setState((s) => ({ ...s, error: null }))
    try {
      await window.electronAPI.writeFile(filePath, state.finalContent)
      if (state.checklist.moveTo && state.editableFolder) {
        const destPath = state.editableFolder.replace(/\/$/, '') + '/' + fileName
        if (destPath !== filePath) {
          await window.electronAPI.moveFile(filePath, destPath)
        }
      }
      onDone()
    } catch (e) {
      setState((s) => ({ ...s, error: (e as Error).message }))
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-parchment-card w-full max-w-2xl mx-4 rounded-2xl shadow-2xl border border-parchment-dark flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="font-serif font-medium text-ink-primary">Triage: {fileName}</span>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* Assessing */}
          {state.step === 'assessing' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
              <p className="text-ink-muted">Analyzing your note…</p>
            </div>
          )}

          {/* Checklist */}
          {state.step === 'checklist' && (
            <div className="space-y-6">
              {state.error && (
                <p className="text-sm text-amber-600 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {state.error}
                </p>
              )}

              {/* Template selection */}
              <div>
                <p className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-2">Classify as</p>
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

              {/* Action checklist — only shown once a template is selected */}
              {state.selectedTemplateId && (
                <div>
                  <p className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-3">Actions</p>
                  <div className="space-y-4">

                    {/* Reformat */}
                    <ChecklistRow
                      checked={state.checklist.reformat}
                      onChange={(v) => setState((s) => ({ ...s, checklist: { ...s.checklist, reformat: v } }))}
                      icon={<FileText className="w-4 h-4" />}
                      label="Reformat to template"
                      detail={
                        state.assessment?.alreadyFormatted
                          ? 'Note looks well-structured already'
                          : 'Note will be restructured to match the template'
                      }
                    />

                    {/* Fill missing */}
                    {(state.assessment?.missingFields ?? []).length > 0 && (
                      <ChecklistRow
                        checked={state.checklist.fillMissing}
                        onChange={(v) => setState((s) => ({ ...s, checklist: { ...s.checklist, fillMissing: v } }))}
                        icon={<Pencil className="w-4 h-4" />}
                        label={`Fill ${state.assessment!.missingFields.length} missing field${state.assessment!.missingFields.length > 1 ? 's' : ''}`}
                        detail={state.assessment!.missingFields.map((f) => f.field).join(', ')}
                      />
                    )}

                    {/* Tags */}
                    {selectedTemplate?.requireTags && (
                      <div className="flex gap-3">
                        <button
                          onClick={() =>
                            setState((s) => ({ ...s, checklist: { ...s.checklist, addTags: !s.checklist.addTags } }))
                          }
                          className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                            state.checklist.addTags ? 'border-accent bg-accent' : 'border-ink-muted bg-transparent'
                          }`}
                        >
                          {state.checklist.addTags && <Check className="w-3 h-3 text-white" />}
                        </button>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Tag className="w-4 h-4 text-ink-muted" />
                            <span className={`text-sm font-medium ${state.checklist.addTags ? 'text-ink-primary' : 'text-ink-muted'}`}>
                              Add tags
                            </span>
                          </div>
                          {state.checklist.addTags && (
                            <div className="flex flex-wrap gap-1.5">
                              {state.editableTags.map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/10 text-accent rounded-full text-xs font-medium"
                                >
                                  #{tag}
                                  <button
                                    onClick={() =>
                                      setState((s) => ({
                                        ...s,
                                        editableTags: s.editableTags.filter((t) => t !== tag),
                                      }))
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
                                      setState((s) => ({
                                        ...s,
                                        editableTags: [...s.editableTags, tag],
                                        newTagInput: '',
                                      }))
                                    } else {
                                      setState((s) => ({ ...s, newTagInput: '' }))
                                    }
                                  }
                                }}
                                placeholder="+ add tag"
                                className="text-xs px-2 py-0.5 bg-transparent border border-dashed border-ink-muted rounded-full text-ink-muted placeholder:text-ink-light focus:outline-none focus:border-accent w-20"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Move to */}
                    <div className="flex gap-3">
                      <button
                        onClick={() =>
                          setState((s) => ({ ...s, checklist: { ...s.checklist, moveTo: !s.checklist.moveTo } }))
                        }
                        className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                          state.checklist.moveTo ? 'border-accent bg-accent' : 'border-ink-muted bg-transparent'
                        }`}
                      >
                        {state.checklist.moveTo && <Check className="w-3 h-3 text-white" />}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FolderOpen className="w-4 h-4 text-ink-muted" />
                          <span className={`text-sm font-medium ${state.checklist.moveTo ? 'text-ink-primary' : 'text-ink-muted'}`}>
                            Move to folder
                          </span>
                        </div>
                        {state.checklist.moveTo && (
                          <input
                            type="text"
                            value={state.editableFolder}
                            onChange={(e) => setState((s) => ({ ...s, editableFolder: e.target.value }))}
                            className="w-full px-3 py-1.5 text-sm bg-parchment-card border border-parchment-dark rounded-lg font-mono text-ink-primary focus:outline-none focus:border-accent"
                          />
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>
          )}

          {/* Filling missing fields */}
          {state.step === 'filling' && (
            <div className="space-y-5">
              <p className="text-sm text-ink-muted">
                Fill in what you can — all fields are optional.
              </p>
              <div className="space-y-4">
                {(state.assessment?.missingFields ?? []).map((q, i) => (
                  <div key={q.field}>
                    <label className="block text-sm font-medium text-ink-primary mb-1">{q.question}</label>
                    {q.hint && <p className="text-xs text-ink-muted mb-1">{q.hint}</p>}
                    <input
                      type="text"
                      value={state.userAnswers[i]?.answer ?? ''}
                      onChange={(e) => {
                        const answers = [...state.userAnswers]
                        answers[i] = { field: q.field, answer: e.target.value }
                        setState((s) => ({ ...s, userAnswers: answers }))
                      }}
                      className="w-full px-3 py-2 text-sm bg-parchment-card border border-parchment-dark rounded-lg text-ink-primary focus:outline-none focus:border-accent"
                      placeholder="Leave blank to skip"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Applying */}
          {state.step === 'applying' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
              <p className="text-ink-muted">Applying changes…</p>
            </div>
          )}

          {/* Preview */}
          {state.step === 'preview' && (
            <div className="space-y-4">
              {state.error && (
                <p className="text-sm text-amber-600 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {state.error}
                </p>
              )}
              {state.checklist.moveTo && state.editableFolder && (
                <div className="text-xs text-ink-muted flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5" />
                  Will move to:{' '}
                  <span className="font-mono text-ink-primary">{state.editableFolder}</span>
                </div>
              )}
              <div className="bg-parchment-card border border-parchment-dark rounded-xl p-5 max-h-96 overflow-y-auto">
                <MarkdownPreview content={state.finalContent ?? ''} />
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-parchment-dark flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-ink-muted hover:text-ink-primary transition-colors"
          >
            Discard
          </button>

          <div className="flex items-center gap-2">
            {(state.step === 'filling' || state.step === 'preview') && (
              <button
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    step: state.step === 'preview' ? 'checklist' : 'checklist',
                  }))
                }
                className="px-4 py-2 text-sm text-ink-muted hover:text-ink-primary transition-colors"
              >
                ← Back
              </button>
            )}

            {state.step === 'checklist' && (
              <button
                onClick={handleApplyFromChecklist}
                disabled={!state.selectedTemplateId}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-all disabled:opacity-40"
              >
                Apply <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {state.step === 'filling' && (
              <>
                <button
                  onClick={() => doApply([])}
                  className="text-sm text-ink-muted hover:text-ink-primary transition-colors px-3 py-2"
                >
                  Skip All
                </button>
                <button
                  onClick={() => doApply(state.userAnswers)}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-all"
                >
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}

            {state.step === 'preview' && (
              <button
                onClick={handleSaveAndApply}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-all"
              >
                <Check className="w-4 h-4" /> Save & Apply
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
