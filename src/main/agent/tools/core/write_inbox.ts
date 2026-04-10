import fs from 'fs/promises'
import path from 'path'
import type { ToolEntry, ToolContext } from '../types.js'

export const writeInboxTool: ToolEntry = {
  meta: {
    name: 'write_inbox',
    label: 'Write to Inbox',
    description: 'Write a new note to the _inbox/ folder.',
    category: 'core',
    defaultEnabled: true,
  },
  definition: {
    type: 'function',
    function: {
      name: 'write_inbox',
      description: 'Write a new note to the _inbox/ folder',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Title of the note' },
          content: { type: 'string', description: 'Markdown content of the note' },
          type: {
            type: 'string',
            enum: ['insight', 'recommendation', 'question', 'housekeeping'],
            description: 'Type of inbox note',
          },
          source_files: {
            type: 'array',
            items: { type: 'string' },
            description: 'Files referenced in this note',
          },
        },
        required: ['title', 'content', 'type'],
      },
    },
  },
  handler: async (args: Record<string, unknown>, context: ToolContext) => {
    const { title, content, type, source_files = [] } = args as {
      title: string; content: string; type: string; source_files?: string[]
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)
    const filename = `${timestamp}-${slug}.md`

    const frontmatter = `---
type: ${type}
created: ${new Date().toISOString()}
source_files: ${JSON.stringify(source_files)}
status: unread
---

# ${title}

${content}
`
    const fullPath = path.join(context.abbeyPath, '_inbox', filename)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, frontmatter, 'utf-8')
    return { path: `_inbox/${filename}` }
  },
}
