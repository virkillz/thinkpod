import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../store/appStore.js'
import { UniversalEditor } from '../editor/UniversalEditor.js'

export function NewThoughtView() {
  const { refreshFileTree, refreshThoughtCount, setCurrentView, newThoughtDraft, setNewThoughtDraft, setSelectedFile } = useAppStore()

  // Auto-save state: once user starts typing, we create a file and switch to edit mode
  const [autoSavedPath, setAutoSavedPath] = useState<string | null>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isCreatingRef = useRef(false)

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [])

  // Auto-save effect: create file after user stops typing for 2 seconds
  useEffect(() => {
    // Only auto-save if we haven't already created a file and there's content
    if (autoSavedPath || !newThoughtDraft.trim() || isCreatingRef.current) return

    // Clear any existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    // Set new timer to create file after 2 seconds of inactivity
    autoSaveTimerRef.current = setTimeout(async () => {
      if (!newThoughtDraft.trim() || isCreatingRef.current) return

      isCreatingRef.current = true
      try {
        const date = new Date()
        const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, 19)
        const slug = newThoughtDraft.slice(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'thought'
        const filename = `${timestamp}-${slug}.md`
        const filePath = `_thoughts/${filename}`

        // Create the file with current content
        await window.electronAPI.writeFile(filePath, newThoughtDraft)

        // Update state to switch to edit mode
        setAutoSavedPath(filePath)
        setSelectedFile(filePath)

        // Refresh file tree to show the new file
        await refreshFileTree()
        await refreshThoughtCount()
      } catch (err) {
        console.error('Auto-save failed:', err)
      } finally {
        isCreatingRef.current = false
      }
    }, 2000)

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [newThoughtDraft, autoSavedPath, refreshFileTree, refreshThoughtCount, setSelectedFile])

  const handleSaved = async () => {
    setNewThoughtDraft('')
    setAutoSavedPath(null)
    await refreshFileTree()
    await refreshThoughtCount()
    setCurrentView('thoughts')
  }

  // If we've auto-saved, switch to edit mode for that file
  // This allows UniversalEditor's built-in auto-save to take over
  if (autoSavedPath) {
    return (
      <UniversalEditor
        mode="edit"
        filePath={autoSavedPath}
        initialContent={newThoughtDraft}
        onContentChange={setNewThoughtDraft}
        onSaved={handleSaved}
        onCancel={() => setCurrentView('thoughts')}
        showViewToggle={false}
      />
    )
  }

  return (
    <UniversalEditor
      mode="new"
      saveToFolder="_thoughts"
      initialContent={newThoughtDraft}
      onContentChange={setNewThoughtDraft}
      onSaved={handleSaved}
      onCancel={() => setCurrentView('thoughts')}
      showViewToggle={false}
    />
  )
}
