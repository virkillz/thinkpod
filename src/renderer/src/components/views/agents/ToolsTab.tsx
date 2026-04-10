import { useState, useEffect } from 'react'
import { Loader2, Check, Save, TriangleAlert } from 'lucide-react'

interface ToolMeta {
  name: string
  label: string
  description: string
  category: 'core' | 'extended'
  defaultEnabled: boolean
  dangerous?: boolean
  configSchema?: Record<string, { label: string; type: 'text' | 'password'; placeholder?: string }>
}

interface ToolsConfig {
  [name: string]: { enabled: boolean; config?: Record<string, string> }
}

export function ToolsTab() {
  const [metas, setMetas] = useState<ToolMeta[]>([])
  const [config, setConfig] = useState<ToolsConfig>({})
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.electronAPI.getToolsConfig().then(({ config: c, metas: m }) => {
      setConfig(c as ToolsConfig)
      setMetas(m as ToolMeta[])
      setLoading(false)
    })
  }, [])

  const toggle = (name: string, enabled: boolean) => {
    setConfig(prev => ({ ...prev, [name]: { ...prev[name], enabled } }))
    setSaveStatus('idle')
  }

  const setConfigField = (toolName: string, field: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      [toolName]: { ...prev[toolName], config: { ...prev[toolName]?.config, [field]: value } },
    }))
    setSaveStatus('idle')
  }

  const handleSave = async () => {
    await window.electronAPI.setToolsConfig(config as Record<string, { enabled: boolean; config?: Record<string, string> }>)
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }

  const coreMetas = metas.filter(m => m.category === 'core')
  const extendedMetas = metas.filter(m => m.category === 'extended')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-ink-muted" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {[{ label: 'Core', items: coreMetas }, { label: 'Extended', items: extendedMetas }].map(group => (
        <section key={group.label}>
          <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">{group.label}</h3>
          <div className="space-y-3">
            {group.items.map(meta => {
              const entry = config[meta.name] ?? { enabled: meta.defaultEnabled }
              const isEnabled = entry.enabled

              return (
                <div
                  key={meta.name}
                  className="bg-parchment-card rounded-xl border border-parchment-dark overflow-hidden"
                >
                  {/* Row */}
                  <div className="flex items-start gap-3 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-ink-primary">{meta.label}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-parchment-sidebar text-ink-muted font-mono">
                          {meta.name}
                        </span>
                        {meta.dangerous && (
                          <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700">
                            <TriangleAlert className="w-3 h-3" />
                            Dangerous
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-muted mt-0.5">{meta.description}</p>
                    </div>
                    {/* Toggle */}
                    <button
                      role="switch"
                      aria-checked={isEnabled}
                      onClick={() => toggle(meta.name, !isEnabled)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                        isEnabled ? 'bg-accent' : 'bg-ink-light'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                          isEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Config fields (shown when enabled and schema exists) */}
                  {isEnabled && meta.configSchema && (
                    <div className="px-4 pb-4 pt-0 border-t border-parchment-dark space-y-3 mt-0 bg-parchment-base/50">
                      {Object.entries(meta.configSchema).map(([field, schema]) => (
                        <div key={field} className="pt-3">
                          <label className="block text-xs font-medium text-ink-primary mb-1">{schema.label}</label>
                          <input
                            type={schema.type}
                            value={entry.config?.[field] ?? ''}
                            onChange={e => setConfigField(meta.name, field, e.target.value)}
                            placeholder={schema.placeholder}
                            className="w-full px-3 py-2 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <div className="flex justify-start">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
        >
          {saveStatus === 'saved' ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saveStatus === 'saved' ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  )
}
