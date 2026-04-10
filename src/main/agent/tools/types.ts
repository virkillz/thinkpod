/**
 * Shared types for the tool registry system.
 */

import type { DatabaseManager } from '../../database/DatabaseManager.js'

// ─── Config ──────────────────────────────────────────────────────────────────

export interface ToolConfigEntry {
  enabled: boolean
  config?: Record<string, string>
}

export type ToolsConfig = Record<string, ToolConfigEntry>

// ─── Context passed to every handler ─────────────────────────────────────────

export interface ToolContext {
  abbeyPath: string
  dbManager: DatabaseManager
  toolsConfig: ToolsConfig
}

// ─── UI metadata ──────────────────────────────────────────────────────────────

export interface ConfigFieldSchema {
  label: string
  type: 'text' | 'password'
  placeholder?: string
}

export interface ToolMeta {
  name: string
  label: string
  description: string
  category: 'core' | 'extended'
  /** Tool is enabled by default when no config exists */
  defaultEnabled: boolean
  /** Mark tools that can do destructive things (e.g. run_bash) */
  dangerous?: boolean
  /** If present, the UI will show config fields when the tool is enabled */
  configSchema?: Record<string, ConfigFieldSchema>
}

// ─── Registry entry ───────────────────────────────────────────────────────────

export interface ToolEntry {
  meta: ToolMeta
  /** OpenAI-compatible function tool object passed to the LLM */
  definition: object
  handler: (args: Record<string, unknown>, context: ToolContext) => Promise<unknown>
}
