import fs from 'fs/promises'
import path from 'path'
import type { ToolEntry, ToolContext } from '../types.js'
import { resolvePath } from '../utils.js'

export const moveFileTool: ToolEntry = {
  meta: {
    name: 'move_file',
    label: 'Move File',
    description: 'Move or rename a file within the abbey.',
    category: 'core',
    defaultEnabled: true,
  },
  definition: {
    type: 'function',
    function: {
      name: 'move_file',
      description: 'Move or rename a file within the abbey',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Current path relative to abbey root' },
          to: { type: 'string', description: 'New path relative to abbey root' },
        },
        required: ['from', 'to'],
      },
    },
  },
  handler: async (args: Record<string, unknown>, context: ToolContext) => {
    const { from, to } = args as { from: string; to: string }
    const fromPath = resolvePath(context.abbeyPath, from)
    const toPath = resolvePath(context.abbeyPath, to)
    await fs.mkdir(path.dirname(toPath), { recursive: true })
    await fs.rename(fromPath, toPath)
    return { from, to }
  },
}
