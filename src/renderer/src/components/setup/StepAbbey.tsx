import { useState } from 'react'
import { FolderOpen, FolderPlus } from 'lucide-react'

interface StepAbbeyProps {
  onContinue: (path: string, isExisting: boolean) => void
  onBack: () => void
  error?: string | null
  needsInit?: boolean
  onConfirmInit?: () => void
}

export function StepAbbey({ onContinue, onBack, error, needsInit, onConfirmInit }: StepAbbeyProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState<'create' | 'open' | null>(null)
  const [browseError, setBrowseError] = useState<string | null>(null)

  const handleSelectFolder = async () => {
    setBrowseError(null)
    try {
      const path = await window.electronAPI.selectAbbeyFolder()
      if (path) {
        setSelectedPath(path)
      }
    } catch (err) {
      setBrowseError((err as Error).message ?? 'Failed to open folder picker')
    }
  }

  const handleContinue = async () => {
    console.log('[StepAbbey] handleContinue called', { selectedPath, mode })
    if (!selectedPath || !mode) {
      console.log('[StepAbbey] early return — missing selectedPath or mode')
      return
    }

    setIsLoading(true)
    try {
      await onContinue(selectedPath, mode === 'open')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="text-sm text-ink-muted mb-1">Step 2 of 3</div>
          <h2 className="text-2xl font-serif font-medium text-ink-primary">
            Choose your Vault
          </h2>
        </div>
      </div>

      <p className="text-ink-muted mb-8">
        This is the folder where all your notes will be kept.
        You can use an existing folder or create a new one.
      </p>

      {/* Mode selection */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => setMode('create')}
          className={`p-6 border-2 rounded-xl text-left transition-all ${
            mode === 'create'
              ? 'border-accent bg-accent/5'
              : 'border-parchment-dark hover:border-accent-light'
          }`}
        >
          <FolderPlus className="w-8 h-8 text-accent mb-4" />
          <div className="font-medium text-ink-primary mb-1">Create New</div>
          <div className="text-sm text-ink-muted">
            Start fresh with a new abbey
          </div>
        </button>

        <button
          onClick={() => setMode('open')}
          className={`p-6 border-2 rounded-xl text-left transition-all ${
            mode === 'open'
              ? 'border-accent bg-accent/5'
              : 'border-parchment-dark hover:border-accent-light'
          }`}
        >
          <FolderOpen className="w-8 h-8 text-accent mb-4" />
          <div className="font-medium text-ink-primary mb-1">Open Existing</div>
          <div className="text-sm text-ink-muted">
            Select an existing folder
          </div>
        </button>
      </div>

      {/* Folder selection */}
      {mode && (
        <div className="mb-8">
          <label className="block text-sm font-medium text-ink-primary mb-2">
            Abbey Location
          </label>
          <div className="flex gap-3">
            <div className="flex-1 px-4 py-3 bg-parchment-sidebar rounded-lg border border-parchment-dark text-ink-primary truncate">
              {selectedPath || 'No folder selected'}
            </div>
            <button
              onClick={handleSelectFolder}
              className="px-4 py-3 border border-accent text-accent hover:bg-accent hover:text-white rounded-lg font-medium transition-colors"
            >
              Browse…
            </button>
          </div>
          
          {browseError && (
            <p className="mt-3 text-sm text-red-600">
              ✗ {browseError}
            </p>
          )}
          {mode === 'create' && selectedPath && (
            <p className="mt-3 text-sm text-ink-muted">
              ✓ Wilfred will create <code>_folios/</code> and <code>_epistles/</code> inside this folder.
            </p>
          )}
        </div>
      )}

      {/* Needs-init confirmation */}
      {needsInit && selectedPath && (
        <div className="mb-6 p-4 border border-amber-300 bg-amber-50 rounded-lg">
          <p className="text-sm text-amber-800 font-medium mb-1">
            This folder is not set up as a vault yet.
          </p>
          <p className="text-sm text-amber-700 mb-3">
            A <code className="font-mono">.scriptorium</code> folder will be created inside this folder to get it ready.
            Your existing files will not be changed.
          </p>
          <button
            onClick={onConfirmInit}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded-lg font-medium transition-colors"
          >
            Initialize as ThinkPod Vault
          </button>
        </div>
      )}

      {/* Actions */}
      {error && (
        <p className="mb-4 text-sm text-red-600">✗ {error}</p>
      )}
      <div className="mt-auto flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-6 py-2 text-ink-muted hover:text-ink-primary transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!selectedPath || !mode || isLoading}
          className="px-8 py-3 bg-accent hover:bg-accent-hover disabled:bg-ink-light disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          {isLoading ? 'Setting up…' : 'Continue →'}
        </button>
      </div>
    </div>
  )
}
