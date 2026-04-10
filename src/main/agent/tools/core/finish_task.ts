import type { ToolEntry } from '../types.js'

export const finishTaskTool: ToolEntry = {
  meta: {
    name: 'finish_task',
    label: 'Finish Task',
    description: 'Signal that the task is complete. Always enabled; not shown in tools UI.',
    category: 'core',
    defaultEnabled: true,
  },
  definition: {
    type: 'function',
    function: {
      name: 'finish_task',
      description: 'Signal that the task is complete. Use this when you have finished your work.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Brief summary of what was accomplished' },
        },
        required: ['summary'],
      },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const { summary } = args as { summary: string }
    return { finished: true, summary }
  },
}
