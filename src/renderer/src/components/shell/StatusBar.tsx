import { useEffect, useState } from 'react'
import { Folder, Cpu, Globe } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'

type ServerStatus = 'loading' | 'ready' | 'stopped' | 'error'

export function StatusBar() {
  const { vault, llmProfiles, activeProfileId, setCurrentView, setPendingSettingsTab } = useAppStore()
  const [version, setVersion] = useState<string>('')
  const [serverStatus, setServerStatus] = useState<ServerStatus>('stopped')

  const activeProfile = llmProfiles.find(p => p.id === activeProfileId) ?? null
  const isBuiltinProvider = activeProfile?.provider === 'builtin'

  useEffect(() => {
    window.electronAPI.getAppVersion().then(setVersion)

    // For API-based providers, assume they're ready
    if (!isBuiltinProvider) {
      setServerStatus(activeProfile ? 'ready' : 'stopped')
      return
    }

    // For built-in provider, monitor actual server status
    window.electronAPI.getLLMModelInfo().then((info) => {
      setServerStatus(info.serverRunning ? 'ready' : 'stopped')
    })

    const unsub = window.electronAPI.onLLMStatus((status: string) => {
      if (status === 'loading') setServerStatus('loading')
      else if (status === 'ready') setServerStatus('ready')
      else if (status === 'stopped') setServerStatus('stopped')
      else if (status === 'error') setServerStatus('error')
    })
    return unsub
  }, [isBuiltinProvider, activeProfile])

  const handleLLMClick = () => {
    setPendingSettingsTab('inference')
    setCurrentView('settings')
  }

  const modelLabel = activeProfile
    ? activeProfile.provider === 'builtin'
      ? (activeProfile.builtinQuant ?? 'Built-in')
      : (activeProfile.model || activeProfile.name)
    : 'No model'

  const dotColor =
    serverStatus === 'ready'
      ? 'bg-green-500'
      : serverStatus === 'loading'
      ? 'bg-amber-400 animate-pulse'
      : serverStatus === 'error'
      ? 'bg-red-500'
      : 'bg-ink-light'

  const statusLabel =
    serverStatus === 'ready'
      ? 'running'
      : serverStatus === 'loading'
      ? 'starting…'
      : serverStatus === 'error'
      ? 'error'
      : activeProfile
      ? 'idle'
      : 'not configured'

  return (
    <div className="h-7 flex items-center px-3 border-t border-parchment-dark bg-parchment-sidebar text-xs text-ink-muted shrink-0 select-none gap-4">
      {/* Vault */}
      {vault && (
        <div className="flex items-center gap-1.5 min-w-0">
          <Folder className="w-3 h-3 shrink-0" />
          <span className="truncate max-w-48">{vault.name}</span>
        </div>
      )}

      <div className="flex-1" />

      {/* LLM status */}
      <button
        onClick={handleLLMClick}
        className="flex items-center gap-1.5 hover:text-ink-primary transition-colors group"
        title="Open Inference settings"
      >
        {activeProfile?.provider === 'builtin' ? (
          <Cpu className="w-3 h-3 shrink-0" />
        ) : (
          <Globe className="w-3 h-3 shrink-0" />
        )}
        <span className="group-hover:text-ink-primary">{modelLabel}</span>
        {activeProfile && (
          <>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
            <span>{statusLabel}</span>
          </>
        )}
      </button>

      {/* Version */}
      {version && <span className="text-ink-light">v{version}</span>}
    </div>
  )
}
