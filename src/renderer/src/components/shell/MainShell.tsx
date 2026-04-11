import { useEffect } from 'react'
import { useAppStore } from '../../store/appStore.js'
import type { ThemeId } from '../../store/appStore.js'
import { Sidebar } from './Sidebar.js'
import { DashboardView } from '../views/DashboardView.js'
import { NotesView } from '../views/NotesView.js'
import { InboxView } from '../views/InboxView.js'
import { ThoughtsView } from '../views/ThoughtsView.js'
import { NewThoughtView } from '../views/NewThoughtView.js'
import { AgentsView } from '../views/AgentsView.js'
import { SettingsView } from '../views/SettingsView.js'
import { AboutView } from '../views/AboutView.js'
import { AgentFAB } from './AgentFAB.js'
import { ThoughtFAB } from './ThoughtFAB.js'

export function MainShell() {
  const { currentView, refreshFileTree, refreshThoughtCount, setTheme, setCurrentView, setAgentProfile, toggleSidebar, toggleAgentChat } = useAppStore()

  useEffect(() => {
    refreshFileTree()
    refreshThoughtCount()
  }, [refreshFileTree, refreshThoughtCount])

  useEffect(() => {
    window.electronAPI.getSetting('theme').then((saved) => {
      const theme = (saved as ThemeId) || 'midnight'
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
      const isMod = e.metaKey || e.ctrlKey
      
      // New Thought: Cmd/Ctrl+N
      if (isMod && e.key === 'n' && currentView !== 'settings') {
        e.preventDefault()
        setCurrentView('newthought')
        return
      }
      
      // Toggle Sidebar: Cmd/Ctrl+B
      if (isMod && e.key === 'b') {
        e.preventDefault()
        toggleSidebar()
        return
      }
      
      // Toggle Agent Chat: Cmd/Ctrl+J
      if (isMod && e.key === 'j') {
        e.preventDefault()
        toggleAgentChat()
        return
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentView, setCurrentView, toggleSidebar, toggleAgentChat])

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />
      case 'notes':
        return <NotesView />
      case 'inbox':
        return <InboxView />
      case 'thoughts':
        return <ThoughtsView />
      case 'newthought':
        return <NewThoughtView />
      case 'agents':
        return <AgentsView />
      case 'settings':
        return <SettingsView />
      case 'about':
        return <AboutView />
      default:
        return <DashboardView />
    }
  }

  return (
    <div className="w-full h-screen flex bg-parchment-base overflow-hidden">
      <Sidebar />
      <main className="flex-1 relative overflow-hidden">
        {renderView()}
        <ThoughtFAB />
        <AgentFAB />
      </main>
    </div>
  )
}
