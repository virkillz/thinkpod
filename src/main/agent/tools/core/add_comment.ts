import type { ToolEntry, ToolContext } from '../types.js'

export const addCommentTool: ToolEntry = {
  meta: {
    name: 'add_comment',
    label: 'Add Comment',
    description: 'Attach a question, suggestion, or note to a file (stored in SQLite).',
    category: 'core',
    defaultEnabled: true,
  },
  definition: {
    type: 'function',
    function: {
      name: 'add_comment',
      description: 'Add a question or note to a file (stored in SQLite, not in the file itself)',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Path to the file' },
          content: { type: 'string', description: 'Comment content' },
          type: {
            type: 'string',
            enum: ['question', 'suggestion', 'note'],
            description: 'Type of comment',
          },
          line: { type: 'number', description: 'Line number to attach comment to (optional)' },
        },
        required: ['file_path', 'content', 'type'],
      },
    },
  },
  handler: async (args: Record<string, unknown>, context: ToolContext) => {
    const { file_path, content, type, line = 0 } = args as {
      file_path: string; content: string; type: string; line?: number
    }
    const id = context.dbManager.addComment(
      file_path,
      line,
      content,
      type as 'question' | 'suggestion' | 'note'
    )
    return { id, file_path, line }
  },
}
