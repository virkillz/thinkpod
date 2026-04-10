import { useEffect, useState } from 'react'
import { ScrollText, Save, Check, Loader2 } from 'lucide-react'

const INVOCATION_TYPES: {
  key: 'docs_review' | 'general_chat'
  label: string
  description: string
  variables: string[]
}[] = [
  {
    key: 'docs_review',
    label: 'Document Review',
    description: 'Used when the Agent FAB is opened while viewing a note.',
    variables: ['{file_path}', '{file_content}'],
  },
  {
    key: 'general_chat',
    label: 'General Chat',
    description: 'Used when the Agent FAB is opened outside of a note.',
    variables: [],
  },
]

const DEFAULT_INVOCATION_PROMPTS: Record<string, string> = {
  docs_review: `You are currently reviewing the markdown document at {file_path}.
The user may want to discuss the content, ask questions, or request edits, summaries, or other operations.
Use available tools when appropriate.

Current document content:
---
{file_content}
---`,
  general_chat: `The user is in a general conversation. No specific document is open.
Answer questions, help with the vault, or discuss ideas.`,
}

export function PromptsTab() {
  const [prompts, setPrompts] = useState<Record<string, string>>({})
  const [saveStatus, setSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({})

  useEffect(() => {
    window.electronAPI.getSetting('invocationPrompts').then((saved) => {
      if (saved && typeof saved === 'object') {
        setPrompts({ ...DEFAULT_INVOCATION_PROMPTS, ...(saved as Record<string, string>) })
      } else {
        setPrompts({ ...DEFAULT_INVOCATION_PROMPTS })
      }
    })
  }, [])

  const handleSave = async (key: string) => {
    setSaveStatus(prev => ({ ...prev, [key]: 'saving' }))
    const current = (await window.electronAPI.getSetting('invocationPrompts') as Record<string, string> | null) ?? {}
    await window.electronAPI.setSetting('invocationPrompts', { ...current, [key]: prompts[key] })
    setSaveStatus(prev => ({ ...prev, [key]: 'saved' }))
    setTimeout(() => setSaveStatus(prev => ({ ...prev, [key]: 'idle' })), 2000)
  }

  const handleReset = (key: string) => {
    setPrompts(prev => ({ ...prev, [key]: DEFAULT_INVOCATION_PROMPTS[key] }))
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-6">
      <p className="text-sm text-ink-muted">
        Each invocation type uses a different context prompt appended to the agent's base persona.
        Changes take effect on the next new conversation.
      </p>

      {INVOCATION_TYPES.map(({ key, label, description, variables }) => {
        const status = saveStatus[key] ?? 'idle'
        return (
          <div key={key} className="bg-parchment-card rounded-xl border border-parchment-dark overflow-hidden">
            <div className="px-5 py-4 border-b border-parchment-dark flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <ScrollText className="w-4 h-4 text-accent" />
                  <h3 className="font-medium text-ink-primary text-sm">{label}</h3>
                  <span className="text-xs text-ink-light font-mono bg-parchment-sidebar px-1.5 py-0.5 rounded">{key}</span>
                </div>
                <p className="text-xs text-ink-muted mt-1">{description}</p>
                {variables.length > 0 && (
                  <p className="text-xs text-ink-light mt-1">
                    Variables: {variables.map(v => (
                      <span key={v} className="font-mono bg-parchment-sidebar px-1 rounded mr-1">{v}</span>
                    ))}
                  </p>
                )}
              </div>
            </div>
            <div className="p-5 space-y-3">
              <textarea
                value={prompts[key] ?? ''}
                onChange={(e) => setPrompts(prev => ({ ...prev, [key]: e.target.value }))}
                rows={8}
                className="w-full px-4 py-3 bg-parchment-base border border-parchment-dark rounded-xl focus:outline-none focus:border-accent text-ink-primary text-xs font-mono resize-none"
              />
              <div className="flex justify-between items-center">
                <button onClick={() => handleReset(key)} className="text-xs text-ink-muted hover:text-ink-primary transition-colors">
                  Reset to default
                </button>
                <button
                  onClick={() => handleSave(key)}
                  disabled={status === 'saving'}
                  className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {status === 'saving' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {status === 'saved' && <Check className="w-3.5 h-3.5" />}
                  {status === 'idle' && <Save className="w-3.5 h-3.5" />}
                  {status === 'saved' ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
