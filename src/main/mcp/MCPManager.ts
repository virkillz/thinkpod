/**
 * MCP (Model Context Protocol) Manager
 *
 * Manages connections to MCP servers, discovers their tools,
 * and bridges MCP tool calls into the existing agent tool pipeline.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { DatabaseManager } from '../database/DatabaseManager.js'

// ─── Config types ────────────────────────────────────────────────────────────

export interface MCPServerConfig {
  /** Unique identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Command to start the server */
  command: string
  /** Arguments for the command */
  args: string[]
  /** Environment variables */
  env?: Record<string, string>
  /** Whether the server is enabled */
  enabled: boolean
}

export interface MCPTool {
  /** Fully-qualified name: serverId::toolName */
  qualifiedName: string
  /** Original tool name from the MCP server */
  originalName: string
  /** Which server this tool belongs to */
  serverId: string
  /** Human-readable server name */
  serverName: string
  /** Tool description */
  description: string
  /** JSON Schema for parameters */
  inputSchema: Record<string, unknown>
}

export interface MCPServerStatus {
  id: string
  name: string
  status: 'connected' | 'disconnected' | 'connecting' | 'error'
  error?: string
  toolCount: number
}

// ─── Internal state per server ───────────────────────────────────────────────

interface ServerConnection {
  config: MCPServerConfig
  client: Client
  transport: StdioClientTransport
  tools: MCPTool[]
  status: 'connected' | 'disconnected' | 'connecting' | 'error'
  error?: string
}

// ─── Manager ─────────────────────────────────────────────────────────────────

export class MCPManager {
  private connections = new Map<string, ServerConnection>()
  private dbManager: DatabaseManager

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager
  }

  // ── Config persistence ───────────────────────────────────────────────────

  getServerConfigs(): MCPServerConfig[] {
    const saved = this.dbManager.getSetting('mcpServers') as MCPServerConfig[] | null
    return saved ?? []
  }

  saveServerConfigs(configs: MCPServerConfig[]): void {
    this.dbManager.setSetting('mcpServers', configs)
  }

  addServer(config: Omit<MCPServerConfig, 'id'>): MCPServerConfig {
    const configs = this.getServerConfigs()
    const newConfig: MCPServerConfig = { ...config, id: crypto.randomUUID() }
    configs.push(newConfig)
    this.saveServerConfigs(configs)
    return newConfig
  }

  updateServer(id: string, updates: Partial<Omit<MCPServerConfig, 'id'>>): MCPServerConfig | null {
    const configs = this.getServerConfigs()
    const idx = configs.findIndex(c => c.id === id)
    if (idx === -1) return null
    configs[idx] = { ...configs[idx], ...updates }
    this.saveServerConfigs(configs)
    return configs[idx]
  }

  removeServer(id: string): boolean {
    const configs = this.getServerConfigs()
    const filtered = configs.filter(c => c.id !== id)
    if (filtered.length === configs.length) return false
    this.saveServerConfigs(filtered)
    // Disconnect if connected
    this.disconnect(id).catch(() => {})
    return true
  }

  // ── Connection lifecycle ─────────────────────────────────────────────────

  async connect(serverId: string): Promise<MCPServerStatus> {
    const configs = this.getServerConfigs()
    const config = configs.find(c => c.id === serverId)
    if (!config) throw new Error(`MCP server not found: ${serverId}`)

    // Disconnect existing connection if any
    if (this.connections.has(serverId)) {
      await this.disconnect(serverId)
    }

    const conn: ServerConnection = {
      config,
      client: null!,
      transport: null!,
      tools: [],
      status: 'connecting',
    }
    this.connections.set(serverId, conn)

    try {
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env ? { ...process.env, ...config.env } as Record<string, string> : undefined,
      })

      const client = new Client({
        name: 'thinkpod',
        version: '1.0.0',
      })

      conn.client = client
      conn.transport = transport

      await client.connect(transport)

      // Discover tools
      const toolsResult = await client.listTools()
      conn.tools = (toolsResult.tools ?? []).map(tool => ({
        qualifiedName: `mcp__${config.name.replace(/\s+/g, '_')}__${tool.name}`,
        originalName: tool.name,
        serverId: config.id,
        serverName: config.name,
        description: tool.description ?? '',
        inputSchema: (tool.inputSchema as Record<string, unknown>) ?? { type: 'object', properties: {} },
      }))

      conn.status = 'connected'
      conn.error = undefined

      return this.getServerStatus(serverId)!
    } catch (err) {
      conn.status = 'error'
      conn.error = (err as Error).message
      return this.getServerStatus(serverId)!
    }
  }

  async disconnect(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId)
    if (!conn) return

    try {
      await conn.client?.close()
    } catch {
      // Ignore close errors
    }
    this.connections.delete(serverId)
  }

  async connectAllEnabled(): Promise<void> {
    const configs = this.getServerConfigs().filter(c => c.enabled)
    await Promise.allSettled(configs.map(c => this.connect(c.id)))
  }

  async disconnectAll(): Promise<void> {
    const ids = [...this.connections.keys()]
    await Promise.allSettled(ids.map(id => this.disconnect(id)))
  }

  // ── Status ───────────────────────────────────────────────────────────────

  getServerStatus(serverId: string): MCPServerStatus | null {
    const conn = this.connections.get(serverId)
    const configs = this.getServerConfigs()
    const config = configs.find(c => c.id === serverId)
    if (!config) return null

    if (!conn) {
      return { id: serverId, name: config.name, status: 'disconnected', toolCount: 0 }
    }

    return {
      id: conn.config.id,
      name: conn.config.name,
      status: conn.status,
      error: conn.error,
      toolCount: conn.tools.length,
    }
  }

  getAllStatuses(): MCPServerStatus[] {
    const configs = this.getServerConfigs()
    return configs.map(c => this.getServerStatus(c.id)!)
  }

  // ── Tool discovery ───────────────────────────────────────────────────────

  /**
   * Returns all tools from all connected MCP servers.
   */
  getConnectedTools(): MCPTool[] {
    const tools: MCPTool[] = []
    for (const conn of this.connections.values()) {
      if (conn.status === 'connected') {
        tools.push(...conn.tools)
      }
    }
    return tools
  }

  /**
   * Converts MCP tools to OpenAI-compatible function tool definitions.
   */
  getToolDefinitions(): object[] {
    return this.getConnectedTools().map(tool => ({
      type: 'function',
      function: {
        name: tool.qualifiedName,
        description: `[MCP: ${tool.serverName}] ${tool.description}`,
        parameters: tool.inputSchema,
      },
    }))
  }

  // ── Tool execution ─────────────────────────────────────────────────────

  /**
   * Check if a tool name belongs to an MCP server.
   */
  isMCPTool(toolName: string): boolean {
    return toolName.startsWith('mcp__')
  }

  /**
   * Execute a tool call on the appropriate MCP server.
   */
  async callTool(
    qualifiedName: string,
    args: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    // Find which server owns this tool
    for (const conn of this.connections.values()) {
      const tool = conn.tools.find(t => t.qualifiedName === qualifiedName)
      if (!tool) continue

      if (conn.status !== 'connected') {
        return { success: false, error: `MCP server "${conn.config.name}" is not connected` }
      }

      try {
        const result = await conn.client.callTool({
          name: tool.originalName,
          arguments: args,
        })

        // Extract text content from MCP result
        const textContent = (result.content as Array<{ type: string; text?: string }>)
          ?.filter(c => c.type === 'text')
          .map(c => c.text)
          .join('\n')

        if (result.isError) {
          return { success: false, error: textContent || 'MCP tool returned an error' }
        }

        return { success: true, data: textContent || result.content }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }

    return { success: false, error: `MCP tool not found: ${qualifiedName}` }
  }
}
