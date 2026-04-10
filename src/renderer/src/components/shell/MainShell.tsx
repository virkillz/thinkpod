import { useEffect } from 'react'
import { useAppStore } from '../../store/appStore.js'
import type { ThemeId } from '../../store/appStore.js'
import { Sidebar } from './Sidebar.js'
import { NotesView } from '../views/NotesView.js'
import { InboxView } from '../views/InboxView.js'
import { DraftsView } from '../views/DraftsView.js'
import { NewDraftView } from '../views/NewDraftView.js'
import { AgentsView } from '../views/AgentsView.js'
import { SettingsView } from '../views/SettingsView.js'
import { WilfredFAB } from './WilfredFAB.js'

export function MainShell() {
  const { currentView, refreshFileTree, setTheme, setCurrentView, setAgentProfile } = useAppStore()

  useEffect(() => {
    refreshFileTree()
  }, [refreshFileTree])

  useEffect(() => {
    window.electronAPI.getSetting('theme').then((saved) => {
      const theme = (saved as ThemeId) || 'parchment'
      document.documentElement.dataset.theme = theme
      setTheme(theme)
    })
    window.electronAPI.getSetting('agentProfile').then((saved) => {
      if (saved && typeof saved === 'object') {
        const p = saved as { name?: string; avatar?: string }
        setAgentProfile(p.name || 'Wilfred', p.avatar || '✦')
      }
    })
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n' && currentView !== 'settings') {
        e.preventDefault()
        setCurrentView('newdraft')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentView, setCurrentView])

  const renderView = () => {
    switch (currentView) {
      case 'notes':
        return <NotesView />
      case 'inbox':
        return <InboxView />
      case 'drafts':
        return <DraftsView />
      case 'newdraft':
        return <NewDraftView />
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
