import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, Trash2, Power, PowerOff, RefreshCw, ChevronDown, ChevronRight, Wrench } from 'lucide-react'

interface MCPServerConfig {
  id: string
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  enabled: boolean
}

interface MCPServerStatus {
  id: string
  name: string
  status: 'connected' | 'disconnected' | 'connecting' | 'error'
  error?: string
  toolCount: number
}

interface MCPTool {
  qualifiedName: string
  originalName: string
  serverId: string
  serverName: string
  description: string
}

type AddFormState = {
  name: string
  command: string
  args: string
  env: string
}

const EMPTY_FORM: AddFormState = { name: '', command: '', args: '', env: '' }

export function MCPTab() {
  const [servers, setServers] = useState<MCPServerConfig[]>([])
  const [statuses, setStatuses] = useState<MCPServerStatus[]>([])
  const [tools, setTools] = useState<MCPTool[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState<AddFormState>(EMPTY_FORM)
  const [expandedServer, setExpandedServer] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const [srvs, sts, tls] = await Promise.all([
      window.electronAPI.mcpGetServers(),
      window.electronAPI.mcpGetStatuses(),
      window.electronAPI.mcpGetTools(),
    ])
    setServers(srvs as MCPServerConfig[])
    setStatuses(sts as MCPServerStatus[])
    setTools(tls as MCPTool[])
  }, [])

  useEffect(() => {
    refresh().then(() => setLoading(false))
  }, [refresh])

  const getStatus = (id: string): MCPServerStatus | undefined =>
    statuses.find(s => s.id === id)

  const handleAdd = async () => {
    if (!form.name || !form.command) return
    let env: Record<string, string> | undefined
    if (form.env.trim()) {
      try {
        env = JSON.parse(form.env)
      } catch {
        env = Object.fromEntries(
          form.env.split('\n').filter(l => l.includes('=')).map(l => {
            const idx = l.indexOf('=')
            return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
          })
        )
      }
    }

    const config = {
      name: form.name,
      command: form.command,
      args: form.args.trim() ? form.args.split(/\s+/) : [],
      env,
      enabled: true,
    }

    const newServer = await window.electronAPI.mcpAddServer(config) as MCPServerConfig
    setForm(EMPTY_FORM)
    setShowAddForm(false)

    // Auto-connect the new server
    setBusy(newServer.id)
    await window.electronAPI.mcpConnect(newServer.id)
    setBusy(null)
    await refresh()
  }

  const handleRemove = async (id: string) => {
    setBusy(id)
    await window.electronAPI.mcpRemoveServer(id)
    setBusy(null)
    await refresh()
  }

  const handleConnect = async (id: string) => {
    setBusy(id)
    await window.electronAPI.mcpConnect(id)
    setBusy(null)
    await refresh()
  }

  const handleDisconnect = async (id: string) => {
    setBusy(id)
    await window.electronAPI.mcpDisconnect(id)
    setBusy(null)
    await refresh()
  }

  const serverTools = (serverId: string) =>
    tools.filter(t => t.serverId === serverId)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-ink-muted" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-ink-primary">MCP Servers</h3>
          <p className="text-xs text-ink-muted mt-0.5">
            Connect external tool servers via the Model Context Protocol
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refresh()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink-primary border border-parchment-dark rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Server
          </button>
        </div>
      </div>

      {/* Add server form */}
      {showAddForm && (
        <div className="bg-parchment-card rounded-xl border border-parchment-dark p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink-primary mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. filesystem"
              className="w-full px-3 py-2 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-primary mb-1">Command</label>
            <input
              type="text"
              value={form.command}
              onChange={e => setForm(f => ({ ...f, command: e.target.value }))}
              placeholder="e.g. npx"
              className="w-full px-3 py-2 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-primary mb-1">Arguments (space-separated)</label>
            <input
              type="text"
              value={form.args}
              onChange={e => setForm(f => ({ ...f, args: e.target.value }))}
              placeholder="e.g. -y @modelcontextprotocol/server-filesystem /path/to/dir"
              className="w-full px-3 py-2 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-primary mb-1">
              Environment Variables <span className="text-ink-muted font-normal">(optional, KEY=VALUE per line or JSON)</span>
            </label>
            <textarea
              value={form.env}
              onChange={e => setForm(f => ({ ...f, env: e.target.value }))}
              placeholder={'API_KEY=sk-...\nANOTHER_VAR=value'}
              rows={3}
              className="w-full px-3 py-2 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent text-sm font-mono resize-none"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAdd}
              disabled={!form.name || !form.command}
              className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
            >
              Add & Connect
            </button>
            <button
              onClick={() => { setShowAddForm(false); setForm(EMPTY_FORM) }}
              className="px-4 py-2 border border-parchment-dark text-ink-muted hover:text-ink-primary rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Server list */}
      {servers.length === 0 && !showAddForm && (
        <div className="text-center py-12 text-ink-muted text-sm">
          No MCP servers configured. Click "Add Server" to get started.
        </div>
      )}

      <div className="space-y-3">
        {servers.map(server => {
          const status = getStatus(server.id)
          const isConnected = status?.status === 'connected'
          const isConnecting = status?.status === 'connecting'
          const hasError = status?.status === 'error'
          const isBusy = busy === server.id
          const isExpanded = expandedServer === server.id
          const sTools = serverTools(server.id)

          return (
            <div
              key={server.id}
              className="bg-parchment-card rounded-xl border border-parchment-dark overflow-hidden"
            >
              {/* Server row */}
              <div className="flex items-start gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-ink-primary">{server.name}</span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        isConnected
                          ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                          : isConnecting
                            ? 'bg-blue-50 border border-blue-200 text-blue-700'
                            : hasError
                              ? 'bg-red-50 border border-red-200 text-red-700'
                              : 'bg-parchment-sidebar text-ink-muted'
                      }`}
                    >
                      {isConnecting ? 'Connecting...' : status?.status ?? 'disconnected'}
                    </span>
                    {isConnected && (
                      <span className="text-xs text-ink-muted">
                        {status?.toolCount} tool{status?.toolCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-muted mt-0.5 font-mono">
                    {server.command} {server.args.join(' ')}
                  </p>
                  {hasError && status?.error && (
                    <p className="text-xs text-red-600 mt-1">{status.error}</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* Expand tools */}
                  {isConnected && sTools.length > 0 && (
                    <button
                      onClick={() => setExpandedServer(isExpanded ? null : server.id)}
                      className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-parchment-sidebar transition-colors"
                      title="Show tools"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  )}

                  {/* Connect / Disconnect */}
                  {isConnected ? (
                    <button
                      onClick={() => handleDisconnect(server.id)}
                      disabled={isBusy}
                      className="p-1.5 rounded-lg text-ink-muted hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Disconnect"
                    >
                      {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PowerOff className="w-4 h-4" />}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect(server.id)}
                      disabled={isBusy}
                      className="p-1.5 rounded-lg text-ink-muted hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                      title="Connect"
                    >
                      {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                    </button>
                  )}

                  {/* Remove */}
                  <button
                    onClick={() => handleRemove(server.id)}
                    disabled={isBusy}
                    className="p-1.5 rounded-lg text-ink-muted hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    title="Remove server"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Expanded tools list */}
              {isExpanded && sTools.length > 0 && (
                <div className="border-t border-parchment-dark bg-parchment-base/50 px-4 py-3">
                  <div className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-2">Available Tools</div>
                  <div className="space-y-1.5">
                    {sTools.map(tool => (
                      <div key={tool.qualifiedName} className="flex items-start gap-2">
                        <Wrench className="w-3.5 h-3.5 text-ink-muted mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-ink-primary">{tool.originalName}</span>
                          {tool.description && (
                            <p className="text-xs text-ink-muted">{tool.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
