import { useEffect, useState } from 'react'
import { useAppStore } from '../../store/appStore.js'
import { MarkdownEditor } from '../codex/MarkdownEditor.js'
import { CommentPanel } from '../codex/CommentPanel.js'
import { FileText, Sparkles, X, Loader2, AlertTriangle } from 'lucide-react'

type EditMode = 'replace' | 'append'

type WizardStep = 'select' | 'processing' | 'preview'

const PRESET_ACTIONS = [
  { label: 'Summarize', instruction: 'Summarize this text concisely.', description: 'Create a brief summary' },
  { label: 'Improve writing', instruction: 'Improve the writing: fix grammar, clarity, and flow.', description: 'Enhance clarity and flow' },
  { label: 'Fix typos', instruction: 'Fix all spelling and grammar mistakes only, do not change anything else.', description: 'Correct spelling & grammar' },
  { label: 'Fix format', instruction: 'Fix formatting issues: proper headings, lists, code blocks, and spacing.', description: 'Clean up markdown formatting' },
  { label: 'Make it formal', instruction: 'Rewrite in a formal, professional tone.', description: 'Professional tone' },
  { label: 'Make it casual', instruction: 'Rewrite in a friendly, casual tone.', description: 'Friendly, conversational tone' },
]

export function NotesView() {
  const { selectedFile, fileTree, vault } = useAppStore()
  const [fileContent, setFileContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // AI Edit state
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState<WizardStep>('select')
  const [selectedAction, setSelectedAction] = useState<typeof PRESET_ACTIONS[0] | null>(null)
  const [customInstruction, setCustomInstruction] = useState('')
  const [editMode, setEditMode] = useState<EditMode>('replace')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [pendingEdit, setPendingEdit] = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  useEffect(() => {
    const loadFile = async () => {
      if (!selectedFile) {
        setFileContent('')
        return
      }

      setIsLoading(true)
      try {
        const result = await window.electronAPI.readFile(selectedFile)
        setFileContent(result.content)
      } catch (error) {
        console.error('Failed to load file:', error)
        setFileContent('')
      } finally {
        setIsLoading(false)
      }
    }

    loadFile()
  }, [selectedFile])

  const resetWizard = () => {
    setWizardOpen(false)
    setWizardStep('select')
    setSelectedAction(null)
    setCustomInstruction('')
    setEditMode('replace')
    setAiError(null)
  }

  const handleCloseWizard = () => {
    if (wizardStep === 'processing') {
      setShowCancelConfirm(true)
    } else {
      resetWizard()
    }
  }

  const handleSave = async (content: string) => {
    if (!selectedFile) return
    try {
      await window.electronAPI.writeFile(selectedFile, content)
    } catch (error) {
      console.error('Failed to save file:', error)
    }
  }

  const runAiEdit = async () => {
    const instruction = selectedAction?.instruction ?? customInstruction.trim()
    if (!instruction) return

    setWizardStep('processing')
    setAiError(null)
    setAiLoading(true)
    try {
      const result = await window.electronAPI.editText(fileContent, instruction)
      if (result.success && result.content) {
        setPendingEdit(result.content)
        setWizardStep('preview')
      } else {
        setAiError(result.error ?? 'Unknown error')
        setWizardStep('select')
      }
    } catch (err) {
      setAiError((err as Error).message)
      setWizardStep('select')
    } finally {
      setAiLoading(false)
    }
  }

  const handleNext = () => {
    if (selectedAction || customInstruction.trim()) {
      runAiEdit()
    }
  }

  const acceptEdit = async () => {
    if (pendingEdit === null) return
    const finalContent = editMode === 'append' ? fileContent + '\n\n' + pendingEdit : pendingEdit
    setFileContent(finalContent)
    await handleSave(finalContent)
    resetWizard()
    setPendingEdit(null)
  }

  // Empty state
  if (!selectedFile) {
    return (
      <div className="flex-1 flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark">
          <h2 className="font-serif font-medium text-lg text-ink-primary">Notes</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FileText className="w-12 h-12 text-parchment-dark mx-auto mb-4" />
            <p className="text-ink-muted mb-2">Select a file from the sidebar</p>
            <p className="text-sm text-ink-light">
              {fileTree.length === 0
                ? vault
                  ? 'Your workspace is empty. Create a thought to get started.'
                  : 'Open a workspace to begin.'
                : `${fileTree.length} items in your workspace`
              }
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark">
          <div>
            <h2 className="font-serif font-medium text-lg text-ink-primary">
              {selectedFile.split('/').pop()}
            </h2>
            <p className="text-sm text-ink-muted">{selectedFile}</p>
          </div>

          {/* AI Edit button */}
          <button
            onClick={() => setWizardOpen(true)}
            disabled={aiLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-parchment-card border border-parchment-dark text-ink-secondary hover:text-ink-primary hover:border-accent/50 transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Edit
          </button>
        </div>

        {/* Error banner */}
        {aiError && (
          <div className="mx-6 mt-3 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
            <span>{aiError}</span>
            <button onClick={() => setAiError(null)}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Editor area */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <MarkdownEditor
              content={fileContent}
              onChange={setFileContent}
              onSave={handleSave}
              filePath={selectedFile}
            />
          )}
        </div>
      </div>

      {/* Comment panel */}
      <CommentPanel filePath={selectedFile} />

      {/* AI Edit Wizard Modal */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={handleCloseWizard} />
          <div className="relative bg-parchment-card border border-parchment-dark rounded-2xl shadow-xl w-full max-w-3xl mx-4 overflow-hidden">
            {/* Header with step indicator */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-parchment-dark">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <span className="font-serif font-medium text-ink-primary">
                  {wizardStep === 'select' && 'AI Edit'}
                  {wizardStep === 'processing' && 'Processing...'}
                  {wizardStep === 'preview' && 'Review Changes'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${wizardStep === 'select' ? 'bg-accent' : 'bg-accent/30'}`} />
                <span className={`w-2 h-2 rounded-full ${wizardStep === 'processing' ? 'bg-accent' : 'bg-accent/30'}`} />
                <span className={`w-2 h-2 rounded-full ${wizardStep === 'preview' ? 'bg-accent' : 'bg-accent/30'}`} />
              </div>
              <button 
                onClick={handleCloseWizard} 
                className="text-ink-muted hover:text-ink-primary ml-2"
                disabled={wizardStep === 'processing'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step 1: Select prompt */}
            {wizardStep === 'select' && (
              <div className="p-5">
                <p className="text-sm text-ink-muted mb-4">Choose a transformation and edit the prompt before sending:</p>
                
                <div className="flex gap-4">
                  {/* Left: Preset actions list */}
                  <div className="w-48 flex-shrink-0 space-y-1">
                    {PRESET_ACTIONS.map((action) => (
                      <button
                        key={action.label}
                        onClick={() => { 
                          setSelectedAction(action)
                          setCustomInstruction(action.instruction)
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
                          selectedAction?.label === action.label
                            ? 'bg-accent/10 text-ink-primary border border-accent/30'
                            : 'text-ink-secondary hover:bg-parchment-dark hover:text-ink-primary'
                        }`}
                      >
                        {action.label}
                      </button>
                    ))}
                    <div className="border-t border-parchment-dark my-2 pt-1">
                      <button
                        onClick={() => { 
                          setSelectedAction(null)
                          setCustomInstruction('')
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
                          !selectedAction
                            ? 'bg-accent/10 text-ink-primary border border-accent/30'
                            : 'text-ink-secondary hover:bg-parchment-dark hover:text-ink-primary'
                        }`}
                      >
                        Custom...
                      </button>
                    </div>
                  </div>

                  {/* Right: Editable prompt textarea */}
                  <div className="flex-1 flex flex-col min-h-0">
                    <label className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-2">
                      Prompt (editable)
                    </label>
                    <textarea
                      value={customInstruction}
                      onChange={(e) => setCustomInstruction(e.target.value)}
                      placeholder="Select a transformation or type your custom instruction..."
                      rows={6}
                      className="flex-1 w-full px-3 py-2.5 rounded-lg bg-parchment border border-parchment-dark text-ink-primary text-sm leading-relaxed placeholder:text-ink-light resize-none focus:outline-none focus:border-accent/50"
                    />
                    <p className="text-xs text-ink-light mt-2">
                      {selectedAction ? `Based on: ${selectedAction.label}` : 'Custom instruction'}
                    </p>
                  </div>
                </div>

                {/* Edit mode selection */}
                <div className="flex items-center gap-4 mt-5 mb-4">
                  <span className="text-sm text-ink-muted">Apply as:</span>
                  <div className="flex rounded-lg border border-parchment-dark overflow-hidden">
                    <button
                      onClick={() => setEditMode('replace')}
                      className={`px-3 py-1.5 text-sm transition-colors ${
                        editMode === 'replace'
                          ? 'bg-accent text-white'
                          : 'bg-parchment text-ink-secondary hover:text-ink-primary'
                      }`}
                    >
                      Replace
                    </button>
                    <button
                      onClick={() => setEditMode('append')}
                      className={`px-3 py-1.5 text-sm transition-colors ${
                        editMode === 'append'
                          ? 'bg-accent text-white'
                          : 'bg-parchment text-ink-secondary hover:text-ink-primary'
                      }`}
                    >
                      Append
                    </button>
                  </div>
                </div>

                {/* Error display */}
                {aiError && (
                  <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {aiError}
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={resetWizard}
                    className="px-4 py-2 rounded-lg text-sm text-ink-muted hover:text-ink-primary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!customInstruction.trim()}
                    onClick={handleNext}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-40 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Processing */}
            {wizardStep === 'processing' && (
              <div className="p-8 flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
                <p className="text-ink-secondary text-sm">AI is working on your text...</p>
                <p className="text-ink-light text-xs mt-1">This may take a few moments</p>
              </div>
            )}

            {/* Step 3: Preview */}
            {wizardStep === 'preview' && pendingEdit !== null && (
              <div className="p-5">
                <p className="text-sm text-ink-muted mb-3">
                  Review the {editMode === 'append' ? 'appended' : 'updated'} content before applying:
                </p>
                <div className="bg-parchment rounded-lg border border-parchment-dark p-4 max-h-80 overflow-y-auto mb-4">
                  <pre className="text-sm text-ink-secondary whitespace-pre-wrap font-sans leading-relaxed">
                    {editMode === 'append' ? pendingEdit : pendingEdit}
                  </pre>
                  {editMode === 'append' && (
                    <div className="mt-4 pt-4 border-t border-parchment-dark">
                      <span className="text-xs text-accent font-medium">This will be appended to your document</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setWizardStep('select')}
                    className="px-4 py-2 rounded-lg text-sm text-ink-muted hover:text-ink-primary transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={resetWizard}
                    className="px-4 py-2 rounded-lg text-sm text-ink-muted hover:text-ink-primary transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    onClick={acceptEdit}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors"
                  >
                    Apply {editMode === 'append' ? 'Append' : 'Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCancelConfirm(false)} />
          <div className="relative bg-parchment-card border border-parchment-dark rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-ink-primary mb-1">Cancel processing?</h3>
                <p className="text-sm text-ink-secondary">
                  The AI is still working on your request. If you cancel now, you will lose the progress and need to start over.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm text-ink-muted hover:text-ink-primary transition-colors"
              >
                Continue waiting
              </button>
              <button
                onClick={() => {
                  setShowCancelConfirm(false)
                  resetWizard()
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
              >
                Cancel anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
