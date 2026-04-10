import fs from 'fs/promises'
import type { ToolEntry, ToolContext } from '../types.js'
import { resolvePath } from '../utils.js'

export const readFileTool: ToolEntry = {
  meta: {
    name: 'read_file',
    label: 'Read File',
    description: 'Read the contents of a file in the vault.',
    category: 'core',
    defaultEnabled: true,
  },
  definition: {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file in the vault',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file relative to vault root' },
        },
        required: ['path'],
      },
    },
  },
  handler: async (args: Record<string, unknown>, context: ToolContext) => {
    const { path } = args as { path: string }
    const fullPath = resolvePath(context.vaultPath, path)
    const content = await fs.readFile(fullPath, 'utf-8')
    return { content, path }
  },
}
