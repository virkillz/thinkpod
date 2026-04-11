import { useAppStore } from '../../store/appStore.js'
import { UniversalEditor } from '../editor/UniversalEditor.js'

export function NewThoughtView() {
  const { refreshFileTree, setCurrentView } = useAppStore()

  const handleSaved = async () => {
    await refreshFileTree()
    setCurrentView('thoughts')
  }

  return (
    <UniversalEditor
      mode="new"
      saveToFolder="_thoughts"
      onSaved={handleSaved}
      onCancel={() => setCurrentView('thoughts')}
      showViewToggle={false}
    />
  )
}
