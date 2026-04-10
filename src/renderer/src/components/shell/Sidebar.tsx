import { BookOpen, Mail, Inbox, Clock, Calendar, Settings, Menu, X } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'
import { FileTree } from '../codex/FileTree.js'
import { InkwellButton } from './InkwellButton.js'

type NavItem = {
  id: 'codex' | 'epistles' | 'folios' | 'chapter' | 'hours' | 'rule'
  label: string
  icon: React.ElementType
  badge?: number
}

const navItems: NavItem[] = [
  { id: 'codex', label: 'Codex', icon: BookOpen },
  { id: 'epistles', label: 'Epistles', icon: Mail, badge: 0 },
  { id: 'folios', label: 'Folios', icon: Inbox },
  { id: 'chapter', label: 'Chapter', icon: Clock },
  { id: 'hours', label: 'Hours', icon: Calendar },
]

export function Sidebar() {
  const { 
    currentView, 
    setCurrentView, 
    isSidebarOpen, 
    toggleSidebar,
    unreadEpistles,
    abbey 
  } = useAppStore()

  return (
    <aside 
      className={`h-full bg-parchment-sidebar border-r border-parchment-dark flex flex-col transition-all duration-300 ${
        isSidebarOpen ? 'w-64' : 'w-16'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-parchment-dark flex items-center justify-between">
        {isSidebarOpen ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xl">✦</span>
              <span className="font-serif font-medium text-ink-primary">Scriptorium</span>
            </div>
            <button 
              onClick={toggleSidebar}
              className="p-1.5 hover:bg-parchment-dark rounded-md transition-colors"
            >
              <X className="w-4 h-4 text-ink-muted" />
            </button>
          </>
        ) : (
          <button 
            onClick={toggleSidebar}
            className="p-1.5 hover:bg-parchment-dark rounded-md transition-colors mx-auto"
          >
            <Menu className="w-4 h-4 text-ink-muted" />
          </button>
        )}
      </div>

      {/* Inkwell - Capture Button */}
      <div className="p-4">
        <InkwellButton compact={!isSidebarOpen} />
      </div>

      {/* Divider */}
      <div className="border-b border-parchment-dark mx-4" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        {currentView === 'codex' && isSidebarOpen && (
          <div className="mb-4">
            <FileTree />
          </div>
        )}

        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentView === item.id
            const badge = item.id === 'epistles' ? unreadEpistles : item.badge

            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  isActive
                    ? 'bg-accent/10 text-accent border-l-2 border-accent'
                    : 'text-ink-muted hover:bg-parchment-dark hover:text-ink-primary'
                } ${isSidebarOpen ? '' : 'justify-center'}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {isSidebarOpen && (
                  <>
                    <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
                    {badge && badge > 0 && (
                      <span className="bg-accent text-white text-xs px-2 py-0.5 rounded-full">
                        {badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Divider */}
      <div className="border-t border-parchment-dark mx-4" />

      {/* Footer - Settings */}
      <div className="p-3">
        <button
          onClick={() => setCurrentView('rule')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
            currentView === 'rule'
              ? 'bg-accent/10 text-accent border-l-2 border-accent'
              : 'text-ink-muted hover:bg-parchment-dark hover:text-ink-primary'
          } ${isSidebarOpen ? '' : 'justify-center'}`}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {isSidebarOpen && (
            <span className="flex-1 text-left text-sm font-medium">Rule</span>
          )}
        </button>
        
        {isSidebarOpen && abbey && (
          <div className="mt-4 px-3 text-xs text-ink-muted truncate">
            {abbey.name}
          </div>
        )}
      </div>
    </aside>
  )
}
