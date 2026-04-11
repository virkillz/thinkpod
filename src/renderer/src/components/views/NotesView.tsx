import { useState } from 'react'
import { useAppStore } from '../../store/appStore.js'
import { UniversalEditor } from '../editor/UniversalEditor.js'
import { CommentPanel } from '../codex/CommentPanel.js'
import { FileText, RefreshCw } from 'lucide-react'

export function NotesView() {
  const { selectedFile, fileTree, vault } = useAppStore()
  const [reloadTrigger, setReloadTrigger] = useState(0)

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
      {/* Editor column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header: filename + reload */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark flex-shrink-0">
          <div>
            <h2 className="font-serif font-medium text-lg text-ink-primary">
              {selectedFile.split('/').pop()}
            </h2>
            <p className="text-sm text-ink-muted">{selectedFile}</p>
          </div>
          <button
            onClick={() => setReloadTrigger((n) => n + 1)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-parchment-card border border-parchment-dark text-ink-secondary hover:text-ink-primary hover:border-accent/50 transition-colors"
            title="Reload file from disk"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {/* Universal editor (fills remaining height) */}
        <UniversalEditor
          key={selectedFile}
          mode="edit"
          filePath={selectedFile}
          reloadTrigger={reloadTrigger}
          showViewToggle={true}
        />
      </div>

      {/* Comment panel */}
      <CommentPanel filePath={selectedFile} />
    </div>
  )
}
