/**
 * Re-exports from the tool registry for backward compatibility.
 * AgentLoop and ChatAgent now call getEnabledToolDefinitions() directly.
 */

export {
  TOOL_REGISTRY,
  DEFAULT_TOOLS_CONFIG,
  getEnabledToolDefinitions,
  getToolMetas,
  executeTool,
} from './tools/index.js'

export type { ToolsConfig, ToolMeta, ToolEntry, ToolContext } from './tools/types.js'
