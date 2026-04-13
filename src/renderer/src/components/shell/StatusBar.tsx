import { useEffect, useState } from 'react'
import { Folder, Cpu, Globe } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'

const QUANT_LABELS: Record<string, string> = {
  Q3_K_M: 'Light',
  Q4_K_M: 'Balanced',
  Q5_K_M: 'Quality',
}

type ServerStatus = 'loading' | 'ready' | 'stopped' | 'error'

export function StatusBar() {
  const { vault, llmConfig, setCurrentView, setPendingSettingsTab } = useAppStore()
  const [version, setVersion] = useState<string>('')
  const [serverStatus, setServerStatus] = useState<ServerStatus>('stopped')

  useEffect(() => {
    window.electronAPI.getAppVersion().then(setVersion)

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
  }, [])

  const handleLLMClick = () => {
    setPendingSettingsTab('inference')
    setCurrentView('settings')
  }

  const modelLabel =
    llmConfig.mode === 'builtin'
      ? (QUANT_LABELS[llmConfig.builtinQuant ?? ''] ?? llmConfig.builtinQuant ?? 'Built-in')
      : llmConfig.model || 'No model'

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
      : 'stopped'

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
        {llmConfig.mode === 'builtin' ? (
          <Cpu className="w-3 h-3 shrink-0" />
        ) : (
          <Globe className="w-3 h-3 shrink-0" />
        )}
        <span className="group-hover:text-ink-primary">{modelLabel}</span>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
        <span>{statusLabel}</span>
      </button>

      {/* Version */}
      {version && <span className="text-ink-light">v{version}</span>}
    </div>
  )
}
