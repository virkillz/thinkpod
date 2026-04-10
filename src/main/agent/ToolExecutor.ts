/**
 * Tool Executor - thin dispatcher that delegates to the tool registry.
 */

import { executeTool } from './tools/index.js'
import type { ToolsConfig } from './tools/types.js'
import type { DatabaseManager } from '../database/DatabaseManager.js'
import type { ToolCall } from './LLMClient.js'

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
}

export interface ToolContext {
  abbeyPath: string
  dbManager: DatabaseManager
  toolsConfig: ToolsConfig
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

    return executeTool(name, args, this.context)
  }
}
