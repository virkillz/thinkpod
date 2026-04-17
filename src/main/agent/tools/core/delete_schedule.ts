import type { ToolEntry, ToolContext } from '../types.js'

export const deleteScheduleTool: ToolEntry = {
  meta: {
    name: 'delete_schedule',
    label: 'Delete Schedule',
    description: 'Delete a recurring schedule by its ID.',
    category: 'core',
    defaultEnabled: true,
  },
  definition: {
    type: 'function',
    function: {
      name: 'delete_schedule',
      description: 'Delete an existing recurring schedule. Use get_schedules first to find the schedule ID.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'The ID of the schedule to delete' },
        },
        required: ['id'],
      },
    },
  },
  handler: async (args: Record<string, unknown>, context: ToolContext) => {
    const { id } = args as { id: number }

    // Verify the schedule exists
    const schedules = context.dbManager.getSchedules()
    const target = schedules.find(s => s.id === id)
    if (!target) throw new Error(`No schedule found with id ${id}`)

    context.dbManager.deleteSchedule(id)

    // Notify the scheduler to stop the job
    context.onScheduleChange?.()

    return { deleted: true, id, name: target.name }
  },
}
