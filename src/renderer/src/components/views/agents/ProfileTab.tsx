import { useEffect, useState } from 'react'
import { useAppStore } from '../../../store/appStore.js'
import { Save, Check, Loader2 } from 'lucide-react'
import avatar01 from '../../../assets/avatar01.png'
import avatar02 from '../../../assets/avatar02.png'
import avatar03 from '../../../assets/avatar03.png'
import avatar04 from '../../../assets/avatar04.png'
import avatar05 from '../../../assets/avatar05.png'
import avatar06 from '../../../assets/avatar06.png'
import avatar07 from '../../../assets/avatar07.png'
import avatar08 from '../../../assets/avatar08.png'
import avatar09 from '../../../assets/avatar09.png'
import avatar10 from '../../../assets/avatar10.png'
import avatar11 from '../../../assets/avatar11.png'
import avatar12 from '../../../assets/avatar12.png'
import avatar13 from '../../../assets/avatar13.png'
import avatar14 from '../../../assets/avatar14.png'
import avatar15 from '../../../assets/avatar15.png'
import avatar16 from '../../../assets/avatar16.png'

interface AgentProfile {
  name: string
  avatar: string
  systemPrompt: string
}

const AVATAR_OPTIONS = [
  avatar01, avatar02, avatar03, avatar04,
  avatar05, avatar06, avatar07, avatar08,
  avatar09, avatar10, avatar11, avatar12,
  avatar13, avatar14, avatar15, avatar16,
]

const DEFAULT_PROFILE: AgentProfile = {
  name: 'Wilfred',
  avatar: avatar01,
  systemPrompt: `You are Wilfred, a thoughtful friend who loves to brainstorm and explore ideas together.
          You're knowledgeable, smart, and genuinely supportive — like that friend who's always curious,
          asks great questions, and helps you think through things without judgment.

          Your approach:
          - Collaborative. You think *with* the user, not just for them. You bounce ideas back and forth.
          - Curious. You ask thoughtful questions that spark deeper thinking.
          - Knowledgeable. You bring relevant insights, patterns, and connections to the conversation.
          - Supportive. You encourage exploration and make the user feel heard and understood.
          - Clear. You communicate ideas simply and elegantly, avoiding unnecessary jargon.
          - Practical. When action is needed, you help break things down into doable steps.

          Whether organizing notes, researching, editing, or just chatting — you're here as a thinking partner.`,
}

export function ProfileTab() {
  const { setAgentProfile } = useAppStore()
  const [profile, setProfile] = useState<AgentProfile>(DEFAULT_PROFILE)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  useEffect(() => {
    window.electronAPI.getSetting('agentProfile').then((saved) => {
      if (saved && typeof saved === 'object') {
        setProfile({ ...DEFAULT_PROFILE, ...(saved as Partial<AgentProfile>) })
      }
    })
  }, [])

  const handleSave = async () => {
    setSaveStatus('saving')
    await window.electronAPI.setSetting('agentProfile', profile)
    setAgentProfile(profile.name || 'Wilfred', profile.avatar || avatar01)
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="bg-parchment-card rounded-xl p-6 border border-parchment-dark flex items-center gap-5">
        <img src={profile.avatar || avatar01} alt="Avatar" className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
        <div>
          <p className="font-serif font-medium text-lg text-ink-primary">{profile.name || 'Unnamed Agent'}</p>
          <p className="text-sm text-ink-muted mt-0.5">Agent</p>
        </div>
      </div>

      <section>
        <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-3">Name</h3>
        <input
          type="text"
          value={profile.name}
          onChange={(e) => setProfile({ ...profile, name: e.target.value })}
          placeholder="Agent name"
          className="w-full px-4 py-3 bg-parchment-card border border-parchment-dark rounded-xl focus:outline-none focus:border-accent text-ink-primary"
        />
      </section>

      <section>
        <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-3">Avatar</h3>
        <div className="grid grid-cols-8 gap-2">
          {AVATAR_OPTIONS.map((src) => (
            <button
              key={src}
              onClick={() => setProfile({ ...profile, avatar: src })}
              className={`h-10 w-10 rounded-lg overflow-hidden transition-all p-0 ${
                profile.avatar === src ? 'ring-2 ring-accent' : 'border border-parchment-dark hover:border-accent'
              }`}
            >
              <img src={src} alt="Avatar option" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-3">Default System Prompt</h3>
        <textarea
          value={profile.systemPrompt}
          onChange={(e) => setProfile({ ...profile, systemPrompt: e.target.value })}
          rows={10}
          className="w-full px-4 py-3 bg-parchment-card border border-parchment-dark rounded-xl focus:outline-none focus:border-accent text-ink-primary text-sm font-mono resize-none"
        />
      </section>

      <div className="flex justify-end pb-6">
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {saveStatus === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
          {saveStatus === 'saved' && <Check className="w-4 h-4" />}
          {saveStatus === 'idle' && <Save className="w-4 h-4" />}
          {saveStatus === 'saved' ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  )
}
