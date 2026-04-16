/**
 * Tool Executor - thin dispatcher that delegates to the tool registry.
 * Also routes MCP tool calls to the appropriate MCP server.
 */

import { executeTool } from './tools/index.js'
import type { ToolsConfig } from './tools/types.js'
import type { DatabaseManager } from '../database/DatabaseManager.js'
import type { ToolCall } from './LLMClient.js'
import type { MCPManager } from '../mcp/MCPManager.js'

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
}

export interface ToolContext {
  vaultPath: string
  dbManager: DatabaseManager
  toolsConfig: ToolsConfig
  mcpManager?: MCPManager
}

export class ToolExecutor {
  constructor(private context: ToolContext) {}

  async execute(toolCall: ToolCall): Promise<ToolResult> {
    const { name } = toolCall.function
    let args: Record<string, unknown>

    try {
      args = JSON.parse(toolCall.function.arguments)
    } catch {
      return { success: false, error: 'Invalid JSON arguments' }
    }

    // Route MCP tool calls to the appropriate MCP server
    if (this.context.mcpManager?.isMCPTool(name)) {
      return this.context.mcpManager.callTool(name, args)
    }

    return executeTool(name, args, this.context)
  }
}
