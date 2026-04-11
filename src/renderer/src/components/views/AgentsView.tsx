import { useState } from 'react'
import { Bot, User, ScrollText, Clock, Calendar, Brain, Wrench, Puzzle } from 'lucide-react'
import { ProfileTab } from './agents/ProfileTab.js'
import { PromptsTab } from './agents/PromptsTab.js'
import { TasksTab } from './agents/TasksTab.js'
import { SchedulesTab } from './agents/SchedulesTab.js'
import { CognitiveSchedulerTab } from './agents/CognitiveSchedulerTab.js'
import { ToolsTab } from './agents/ToolsTab.js'
import { SkillsTab } from './agents/SkillsTab.js'

type Tab = 'profile' | 'prompts' | 'tasks' | 'schedules' | 'cognitive' | 'tools' | 'skills'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'prompts', label: 'Prompts', icon: ScrollText },
  { id: 'tasks', label: 'Tasks', icon: Clock },
  { id: 'schedules', label: 'Schedules', icon: Calendar },
  { id: 'cognitive', label: 'Cognitive', icon: Brain },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'skills', label: 'Skills', icon: Puzzle },
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
        {activeTab === 'prompts' && <PromptsTab />}
        {activeTab === 'tasks' && <TasksTab />}
        {activeTab === 'schedules' && <SchedulesTab />}
        {activeTab === 'cognitive' && <CognitiveSchedulerTab />}
        {activeTab === 'tools' && <ToolsTab />}
        {activeTab === 'skills' && <SkillsTab />}
      </div>
    </div>
  )
}
