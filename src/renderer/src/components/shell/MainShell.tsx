import { useEffect } from 'react'
import { useAppStore } from '../../store/appStore.js'
import { Sidebar } from './Sidebar.js'
import { NotesView } from '../views/NotesView.js'
import { InboxView } from '../views/InboxView.js'
import { DraftsView } from '../views/DraftsView.js'
import { AgentsView } from '../views/AgentsView.js'
import { SettingsView } from '../views/SettingsView.js'
import { WilfredFAB } from './WilfredFAB.js'

export function MainShell() {
  const { currentView, refreshFileTree } = useAppStore()

  useEffect(() => {
    refreshFileTree()
  }, [refreshFileTree])

  const renderView = () => {
    switch (currentView) {
      case 'notes':
        return <NotesView />
      case 'inbox':
        return <InboxView />
      case 'drafts':
        return <DraftsView />
      case 'agents':
        return <AgentsView />
      case 'settings':
        return <SettingsView />
      default:
        return <NotesView />
    }
  }

  return (
    <div className="w-full h-screen flex bg-parchment-base overflow-hidden">
      <Sidebar />
      <main className="flex-1 relative overflow-hidden">
        {renderView()}
        <WilfredFAB />
      </main>
    </div>
  )
}
