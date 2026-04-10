import { BookOpen, Mail, Inbox, Bot, Settings, Menu, X, PenLine } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'
import { FileTree } from '../codex/FileTree.js'

type NavItem = {
  id: 'notes' | 'inbox' | 'drafts' | 'agents' | 'settings' | 'newdraft'
  label: string
  icon: React.ElementType
  badge?: number
}

const mainNavItems: NavItem[] = [
  { id: 'newdraft', label: 'New Draft', icon: PenLine },
  { id: 'inbox', label: 'Inbox', icon: Mail, badge: 0 },
  { id: 'drafts', label: 'Drafts', icon: Inbox },
  { id: 'notes', label: 'Notes', icon: BookOpen },
]

const bottomNavItems: NavItem[] = [
  { id: 'agents', label: 'Agents', icon: Bot },
]

export function Sidebar() {
  const {
    currentView,
    setCurrentView,
    isSidebarOpen,
    toggleSidebar,
    isFileTreeVisible,
    toggleFileTree,
    unreadInbox,
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
              <span className="font-serif font-medium text-ink-primary">ThinkPod</span>
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

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        <div className="space-y-1">
          {mainNavItems.map((item) => {
            const Icon = item.icon
            const isActive = currentView === item.id
            const badge = item.id === 'inbox' ? unreadInbox : item.badge

            const isNewDraft = item.id === 'newdraft'

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'notes') {
                    toggleFileTree()
                  }
                  setCurrentView(item.id)
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  isNewDraft
                    ? isActive
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-accent hover:bg-accent-hover text-white shadow-sm hover:shadow'
                    : isActive
                      ? 'bg-accent/10 text-accent border-l-2 border-accent'
                      : 'text-ink-muted hover:bg-parchment-dark hover:text-ink-primary'
                } ${isSidebarOpen ? '' : 'justify-center'}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {isSidebarOpen && (
                  <>
                    <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
                    {badge && badge > 0 && (
                      <span className={`${isNewDraft ? 'bg-white/20 text-white' : 'bg-accent text-white'} text-xs px-2 py-0.5 rounded-full`}>
                        {badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            )
          })}
        </div>

        {isSidebarOpen && isFileTreeVisible && (
          <div className="mt-4 mb-4">
            <FileTree />
          </div>
        )}
      </nav>

      {/* Footer - Settings, Tasks, Schedule */}
      <div className="p-3 space-y-1 border-t border-parchment-dark">
        <button
          onClick={() => setCurrentView('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
            currentView === 'settings'
              ? 'bg-accent/10 text-accent border-l-2 border-accent'
              : 'text-ink-muted hover:bg-parchment-dark hover:text-ink-primary'
          } ${isSidebarOpen ? '' : 'justify-center'}`}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {isSidebarOpen && (
            <span className="flex-1 text-left text-sm font-medium">Settings</span>
          )}
        </button>

        {bottomNavItems.map((item) => {
          const Icon = item.icon
          const isActive = currentView === item.id
          const badge = item.badge

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

        {isSidebarOpen && abbey && (
          <div className="mt-4 px-3 text-xs text-ink-muted truncate">
            {abbey.name}
          </div>
        )}
      </div>
    </aside>
  )
}
