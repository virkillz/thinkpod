import fs from 'fs/promises'
import path from 'path'
import type { ToolEntry, ToolContext } from '../types.js'
import { resolvePath } from '../utils.js'

export const listFilesTool: ToolEntry = {
  meta: {
    name: 'list_files',
    label: 'List Files',
    description: 'List files and directories inside a path.',
    category: 'core',
    defaultEnabled: true,
  },
  definition: {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List files in a directory',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path relative to vault root' },
          pattern: { type: 'string', description: 'Optional glob pattern filter' },
        },
        required: ['path'],
      },
    },
  },
  handler: async (args: Record<string, unknown>, context: ToolContext) => {
    const { path: p } = args as { path: string; pattern?: string }
    const fullPath = resolvePath(context.vaultPath, p)
    const entries = await fs.readdir(fullPath, { withFileTypes: true })

    const files = entries
      .filter(e => !e.name.startsWith('.') || e.name === '.thinkpod')
      .map(e => ({
        name: e.name,
        path: path.join(p, e.name),
        isDirectory: e.isDirectory(),
      }))
      .sort((a, b) => {
        if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name)
        return a.isDirectory ? -1 : 1
      })

    return { files, path: p }
  },
}
