import { useState, useRef } from 'react'
import { useAppStore } from '../../store/appStore.js'
import { UniversalEditor, UniversalEditorHandle } from '../editor/UniversalEditor.js'
import { CommentPanel } from '../codex/CommentPanel.js'
import { TriageWizard } from '../triage/TriageWizard.js'
import { FileText, RefreshCw, Sparkles, Undo2, Redo2 } from 'lucide-react'

export function NotesView() {
  const { selectedFile, fileTree, vault, refreshFileTree, setSelectedFile } = useAppStore()
  const [reloadTrigger, setReloadTrigger] = useState(0)
  const [liveContent, setLiveContent] = useState('')
  const [triageOpen, setTriageOpen] = useState(false)
  const editorRef = useRef<UniversalEditorHandle>(null)

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

  const fileName = selectedFile.split('/').pop() ?? selectedFile

  return (
    <>
      <div className="flex-1 flex h-full overflow-hidden">
        {/* Editor column */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark flex-shrink-0">
            <div>
              <h2 className="font-serif font-medium text-lg text-ink-primary">{fileName}</h2>
              <p className="text-sm text-ink-muted">{selectedFile}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => editorRef.current?.undo()}
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-parchment-dark transition-colors"
                title="Undo (⌘Z)"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => editorRef.current?.redo()}
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-parchment-dark transition-colors"
                title="Redo (⌘⇧Z)"
              >
                <Redo2 className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-parchment-dark" />
              <button
                onClick={() => setTriageOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-accent hover:bg-accent-hover text-white transition-all shadow-sm hover:shadow-md"
                title="Triage this note"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Triage
              </button>
              <button
                onClick={() => setReloadTrigger((n) => n + 1)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-parchment-card border border-parchment-dark text-ink-secondary hover:text-ink-primary hover:border-accent/50 transition-colors"
                title="Reload file from disk"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>
          </div>

          {/* Editor */}
          <UniversalEditor
            ref={editorRef}
            key={selectedFile}
            mode="edit"
            filePath={selectedFile}
            reloadTrigger={reloadTrigger}
            showViewToggle={true}
            onContentChange={setLiveContent}
          />
        </div>

        {/* Comment panel */}
        <CommentPanel filePath={selectedFile} />
      </div>

      {triageOpen && (
        <TriageWizard
          fileName={fileName}
          filePath={selectedFile}
          content={liveContent}
          onClose={() => setTriageOpen(false)}
          onDone={(newFilePath) => {
            setTriageOpen(false)
            if (newFilePath) {
              setSelectedFile(newFilePath)
            } else {
              setReloadTrigger((n) => n + 1)
            }
            refreshFileTree()
          }}
        />
      )}
    </>
  )
}
