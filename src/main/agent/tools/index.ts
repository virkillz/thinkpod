/**
 * Tool registry — the single source of truth for all agent tools.
 *
 * To add a new tool:
 *   1. Create a file in core/ or extended/ exporting a ToolEntry
 *   2. Import it here and add it to TOOL_REGISTRY
 *
 * The registry drives everything: LLM definitions, execution dispatch,
 * and the tools management UI in Settings.
 */

import type { ToolEntry, ToolsConfig, ToolMeta, ToolContext } from './types.js'

// ─── Core tools ───────────────────────────────────────────────────────────────
import { readFileTool }   from './core/read_file.js'
import { writeFileTool }  from './core/write_file.js'
import { moveFileTool }   from './core/move_file.js'
import { listFilesTool }  from './core/list_files.js'
import { addCommentTool } from './core/add_comment.js'
import { sendMessageTool } from './core/send_message.js'
import { finishTaskTool } from './core/finish_task.js'
import { readSkillTool }    from './core/read_skill.js'
import { searchVaultTool }  from './core/search_vault.js'
import { getTopicTool }     from './core/get_topic.js'
import { createScheduleTool } from './core/create_schedule.js'
import { deleteScheduleTool } from './core/delete_schedule.js'
import { getSchedulesTool }   from './core/get_schedules.js'

// ─── Extended tools ───────────────────────────────────────────────────────────
import { fetchUrlTool }    from './extended/fetch_url.js'
import { runBashTool }     from './extended/run_bash.js'
import { braveSearchTool } from './extended/brave_search.js'

// ─── Registry ─────────────────────────────────────────────────────────────────

export const TOOL_REGISTRY: ToolEntry[] = [
  readFileTool,
  writeFileTool,
  moveFileTool,
  listFilesTool,
  addCommentTool,
  sendMessageTool,
  finishTaskTool,
  readSkillTool,
  searchVaultTool,
  getTopicTool,
  createScheduleTool,
  deleteScheduleTool,
  getSchedulesTool,
  fetchUrlTool,
  runBashTool,
  braveSearchTool,
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Default config: core tools on, extended tools off.
 * finish_task is always treated as enabled and is excluded from the UI.
 */
export const DEFAULT_TOOLS_CONFIG: ToolsConfig = Object.fromEntries(
  TOOL_REGISTRY.map(t => [t.meta.name, { enabled: t.meta.defaultEnabled }])
)

/**
 * Returns tool metas for the UI (excludes finish_task which is internal).
 */
export function getToolMetas(): ToolMeta[] {
  return TOOL_REGISTRY
    .filter(t => t.meta.name !== 'finish_task')
    .map(t => t.meta)
}

/**
 * Returns OpenAI-compatible tool definition objects for enabled tools.
 * finish_task is always included when includeFinishTask is true (default for task loop).
 */
export function getEnabledToolDefinitions(
  config: ToolsConfig,
  { includeFinishTask = true }: { includeFinishTask?: boolean } = {}
): object[] {
  return TOOL_REGISTRY
    .filter(t => {
      if (t.meta.name === 'finish_task') return includeFinishTask
      return config[t.meta.name]?.enabled ?? t.meta.defaultEnabled
    })
    .map(t => t.definition)
}

/**
 * Dispatch a tool call by name. Wraps errors in a standard shape.
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  context: ToolContext
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const entry = TOOL_REGISTRY.find(t => t.meta.name === name)
  if (!entry) return { success: false, error: `Unknown tool: ${name}` }

  try {
    const data = await entry.handler(args, context)
    return { success: true, data }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

export type { ToolEntry, ToolsConfig, ToolMeta, ToolContext }
