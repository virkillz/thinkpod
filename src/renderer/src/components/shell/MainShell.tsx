import { useEffect } from 'react'
import { useAppStore } from '../../store/appStore.js'
import { Sidebar } from './Sidebar.js'
import { CodexView } from '../views/CodexView.js'
import { EpistlesView } from '../views/EpistlesView.js'
import { ChapterView } from '../views/ChapterView.js'
import { HoursView } from '../views/HoursView.js'
import { RuleView } from '../views/RuleView.js'
import { WilfredFAB } from './WilfredFAB.js'

export function MainShell() {
  const { currentView, refreshFileTree } = useAppStore()

  useEffect(() => {
    refreshFileTree()
  }, [refreshFileTree])

  const renderView = () => {
    switch (currentView) {
      case 'codex':
        return <CodexView />
      case 'epistles':
        return <EpistlesView />
      case 'chapter':
        return <ChapterView />
      case 'hours':
        return <HoursView />
      case 'rule':
        return <RuleView />
      default:
        return <CodexView />
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
