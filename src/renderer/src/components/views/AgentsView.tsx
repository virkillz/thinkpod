import { useState } from 'react'
import { Bot, User, ScrollText, Calendar, Wrench, Puzzle, MessageCircle, Fingerprint } from 'lucide-react'
import { ProfileTab } from './agents/ProfileTab.js'
import { PromptsTab } from './agents/PromptsTab.js'
import { SchedulesTab } from './agents/SchedulesTab.js'
import { ToolsTab } from './agents/ToolsTab.js'
import { SkillsTab } from './agents/SkillsTab.js'
import { SessionsTab } from './agents/SessionsTab.js'
import { PersonalizationTab } from './agents/PersonalizationTab.js'

type Tab = 'profile' | 'prompts' | 'schedules' | 'tools' | 'skills' | 'sessions' | 'personalization'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'personalization', label: 'Personalization', icon: Fingerprint },
  { id: 'prompts', label: 'Prompts', icon: ScrollText },
  { id: 'schedules', label: 'Schedules', icon: Calendar },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'skills', label: 'Skills', icon: Puzzle },
  { id: 'sessions', label: 'Sessions', icon: MessageCircle },
]

export function AgentsView() {
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark">
        <div className="flex items-center gap-3">
          <Bot className="w-5 h-5 text-accent" />
          <h2 className="font-serif font-medium text-lg text-ink-primary">Agents</h2>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-4 border-b border-parchment-dark">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              activeTab === id
                ? 'text-accent border-accent'
                : 'text-ink-muted border-transparent hover:text-ink-primary'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'personalization' && <PersonalizationTab />}
        {activeTab === 'prompts' && <PromptsTab />}
        {activeTab === 'schedules' && <SchedulesTab />}
        {activeTab === 'tools' && <ToolsTab />}
        {activeTab === 'skills' && <SkillsTab />}
        {activeTab === 'sessions' && <SessionsTab />}
      </div>
    </div>
  )
}
