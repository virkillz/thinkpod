import type { ToolEntry, ToolContext } from '../types.js'

export const createScheduleTool: ToolEntry = {
  meta: {
    name: 'create_schedule',
    label: 'Create Schedule',
    description: 'Create a recurring schedule so you can wake up and perform tasks automatically.',
    category: 'core',
    defaultEnabled: true,
  },
  definition: {
    type: 'function',
    function: {
      name: 'create_schedule',
      description:
        'Create a new recurring schedule. The schedule uses cron syntax (e.g. "0 9 * * *" for daily at 9 AM, "0 * * * *" for every hour, "*/5 * * * *" for every 5 minutes, "0 20 * * 0" for Sundays at 8 PM).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Human-readable name for the schedule (e.g. "Daily Summary")' },
          schedule: { type: 'string', description: 'Cron expression defining when the task runs' },
          prompt: { type: 'string', description: 'The prompt/instruction to execute each time the schedule fires' },
        },
        required: ['name', 'schedule', 'prompt'],
      },
    },
  },
  handler: async (args: Record<string, unknown>, context: ToolContext) => {
    const { name, schedule, prompt } = args as {
      name: string
      schedule: string
      prompt: string
    }

    if (!name.trim()) throw new Error('Schedule name is required')
    if (!schedule.trim()) throw new Error('Cron expression is required')
    if (!prompt.trim()) throw new Error('Prompt is required')

    const id = context.dbManager.createSchedule(name.trim(), schedule.trim(), prompt.trim())

    // Notify the scheduler to pick up the new schedule
    context.onScheduleChange?.()

    return { id, name: name.trim(), schedule: schedule.trim() }
  },
}
