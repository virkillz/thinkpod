import type { ToolEntry, ToolContext } from '../types.js'

export const getSchedulesTool: ToolEntry = {
  meta: {
    name: 'get_schedules',
    label: 'Get Schedules',
    description: 'List all recurring schedules and their current status.',
    category: 'core',
    defaultEnabled: true,
  },
  definition: {
    type: 'function',
    function: {
      name: 'get_schedules',
      description: 'List all recurring schedules. Returns each schedule\'s ID, name, cron expression, prompt, and whether it is active.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  handler: async (_args: Record<string, unknown>, context: ToolContext) => {
    const schedules = context.dbManager.getSchedules()

    return {
      count: schedules.length,
      schedules: schedules.map(s => ({
        id: s.id,
        name: s.name,
        schedule: s.schedule,
        prompt: s.prompt,
        is_active: s.is_active === 1,
      })),
    }
  },
}
