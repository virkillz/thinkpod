import { useEffect, useState } from 'react'
import { useAppStore } from '../../store/appStore.js'
import { MarkdownEditor } from '../codex/MarkdownEditor.js'
import { CommentPanel } from '../codex/CommentPanel.js'
import { FileText } from 'lucide-react'

export function NotesView() {
  const { selectedFile, fileTree, vault } = useAppStore()
  const [fileContent, setFileContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)

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

  const handleSave = async (content: string) => {
    if (!selectedFile) return

    try {
      await window.electronAPI.writeFile(selectedFile, content)
    } catch (error) {
      console.error('Failed to save file:', error)
    }
  }

  // Empty state
  if (!selectedFile) {
    return (
      <div className="flex-1 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark">
          <h2 className="font-serif font-medium text-lg text-ink-primary">Notes</h2>
        </div>

        {/* Empty state */}
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
        </div>

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
    </div>
  )
}
