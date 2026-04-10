/**
 * Tool Executor - Executes tools called by the LLM
 */

import path from 'path'
import fs from 'fs/promises'
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
}

export class ToolExecutor {
  private context: ToolContext

  constructor(context: ToolContext) {
    this.context = context
  }

  // Resolve a path argument from the LLM: absolute paths are used as-is,
  // relative paths are joined to the abbey root.
  private resolvePath(p: string): string {
    if (path.isAbsolute(p)) {
      // If the LLM gave a full absolute path that already starts with the abbey
      // root, use it directly. Otherwise join (treating it as relative).
      return p.startsWith(this.context.abbeyPath) ? p : path.join(this.context.abbeyPath, p)
    }
    return path.join(this.context.abbeyPath, p)
  }

  async execute(toolCall: ToolCall): Promise<ToolResult> {
    const { name } = toolCall.function
    let args: Record<string, unknown>

    try {
      args = JSON.parse(toolCall.function.arguments)
    } catch {
      return { success: false, error: 'Invalid JSON arguments' }
    }

    switch (name) {
      case 'read_file':
        return this.readFile(args as { path: string })
      case 'write_file':
        return this.writeFile(args as { path: string; content: string })
      case 'move_file':
        return this.moveFile(args as { from: string; to: string })
      case 'list_files':
        return this.listFiles(args as { path: string; pattern?: string })
      case 'add_comment':
        return this.addComment(args as { file_path: string; content: string; type: string; line?: number })
      case 'write_epistle':
        return this.writeEpistle(args as { title: string; content: string; type: string; source_files?: string[] })
      case 'finish_task':
        return this.finishTask(args as { summary: string })
      default:
        return { success: false, error: `Unknown tool: ${name}` }
    }
  }

  private async readFile(args: { path: string }): Promise<ToolResult> {
    try {
      const fullPath = this.resolvePath(args.path)
      const content = await fs.readFile(fullPath, 'utf-8')
      return { success: true, data: { content, path: args.path } }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  private async writeFile(args: { path: string; content: string }): Promise<ToolResult> {
    try {
      const fullPath = this.resolvePath(args.path)
      await fs.mkdir(path.dirname(fullPath), { recursive: true })
      await fs.writeFile(fullPath, args.content, 'utf-8')
      return { success: true, data: { path: args.path } }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  private async moveFile(args: { from: string; to: string }): Promise<ToolResult> {
    try {
      const fromPath = this.resolvePath(args.from)
      const toPath = this.resolvePath(args.to)
      await fs.mkdir(path.dirname(toPath), { recursive: true })
      await fs.rename(fromPath, toPath)
      return { success: true, data: { from: args.from, to: args.to } }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  private async listFiles(args: { path: string; pattern?: string }): Promise<ToolResult> {
    try {
      const fullPath = this.resolvePath(args.path)
      const entries = await fs.readdir(fullPath, { withFileTypes: true })
      
      const files = entries
        .filter(e => !e.name.startsWith('.') || e.name === '.scriptorium')
        .map(e => ({
          name: e.name,
          path: path.join(args.path, e.name),
          isDirectory: e.isDirectory(),
        }))
        .sort((a, b) => {
          if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name)
          return a.isDirectory ? -1 : 1
        })

      return { success: true, data: { files, path: args.path } }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  private async addComment(args: { file_path: string; content: string; type: string; line?: number }): Promise<ToolResult> {
    try {
      const line = args.line || 0
      const id = this.context.dbManager.addComment(
        args.file_path,
        line,
        args.content,
        args.type as 'question' | 'suggestion' | 'note'
      )
      return { success: true, data: { id, file_path: args.file_path, line } }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  private async writeEpistle(args: { title: string; content: string; type: string; source_files?: string[] }): Promise<ToolResult> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const slug = args.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)
      const filename = `${timestamp}-${slug}.md`

      const frontmatter = `---
type: ${args.type}
created: ${new Date().toISOString()}
source_files: ${JSON.stringify(args.source_files || [])}
status: unread
---

# ${args.title}

${args.content}
`

      const fullPath = path.join(this.context.abbeyPath, '_epistles', filename)
      await fs.mkdir(path.dirname(fullPath), { recursive: true })
      await fs.writeFile(fullPath, frontmatter, 'utf-8')

      return { success: true, data: { path: `_epistles/${filename}` } }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  private async finishTask(args: { summary: string }): Promise<ToolResult> {
    return { success: true, data: { finished: true, summary: args.summary } }
  }
}
