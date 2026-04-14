import type { ToolEntry, ToolContext } from '../types.js'

export const sendMessageTool: ToolEntry = {
  meta: {
    name: 'send_message',
    label: 'Send to User Inbox',
    description: 'Send a message to the user\'s inbox (like an email).',
    category: 'core',
    defaultEnabled: true,
  },
  definition: {
    type: 'function',
    function: {
      name: 'send_message',
      description: 'Send a message to the user inbox. Use this to share insights, recommendations, questions, or plans with the user.',
      parameters: {
        type: 'object',
        properties: {
          subject: { type: 'string', description: 'Subject line of the message (like an email subject)' },
          body: { type: 'string', description: 'Full body of the message in Markdown' },
          type: {
            type: 'string',
            enum: ['insight', 'recommendation', 'question', 'housekeeping', 'plan'],
            description: 'Type of inbox message',
          },
          source_job: {
            type: 'string',
            description: 'Optional: name of the task or schedule that generated this message',
          },
        },
        required: ['subject', 'body', 'type'],
      },
    },
  },
  handler: async (args: Record<string, unknown>, context: ToolContext) => {
    const { subject, body, type, source_job } = args as {
      subject: string
      body: string
      type: string
      source_job?: string
    }

    const id = context.dbManager.createInboxMessage({
      subject,
      body,
      type,
      sourceJob: source_job,
    })

    return { id, subject }
  },
}
