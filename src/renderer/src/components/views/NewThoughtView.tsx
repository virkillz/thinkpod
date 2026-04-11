import { useAppStore } from '../../store/appStore.js'
import { UniversalEditor } from '../editor/UniversalEditor.js'

export function NewThoughtView() {
  const { refreshFileTree, setCurrentView, newThoughtDraft, setNewThoughtDraft } = useAppStore()

  const handleSaved = async () => {
    setNewThoughtDraft('')
    await refreshFileTree()
    setCurrentView('thoughts')
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
