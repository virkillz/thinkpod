import fs from 'fs/promises'
import path from 'path'
import type { ToolEntry, ToolContext } from '../types.js'
import { resolvePath } from '../utils.js'

export const writeFileTool: ToolEntry = {
  meta: {
    name: 'write_file',
    label: 'Write File',
    description: 'Write or overwrite a file in the abbey.',
    category: 'core',
    defaultEnabled: true,
  },
  definition: {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write or overwrite a file in the abbey',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file relative to abbey root' },
          content: { type: 'string', description: 'Content to write to the file' },
        },
        required: ['path', 'content'],
      },
    },
  },
  handler: async (args: Record<string, unknown>, context: ToolContext) => {
    const { path: p, content } = args as { path: string; content: string }
    const fullPath = resolvePath(context.abbeyPath, p)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, content, 'utf-8')
    return { path: p }
  },
}
