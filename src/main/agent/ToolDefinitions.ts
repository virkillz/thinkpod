/**
 * Tool definitions for Wilfred
 * Each tool can be called by the LLM during task execution
 */

export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file in the abbey',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file relative to abbey root',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write or overwrite a file in the abbey',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file relative to abbey root',
          },
          content: {
            type: 'string',
            description: 'Content to write to the file',
          },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'move_file',
      description: 'Move or rename a file within the abbey',
      parameters: {
        type: 'object',
        properties: {
          from: {
            type: 'string',
            description: 'Current path relative to abbey root',
          },
          to: {
            type: 'string',
            description: 'New path relative to abbey root',
          },
        },
        required: ['from', 'to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List files in a directory',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Directory path relative to abbey root',
          },
          pattern: {
            type: 'string',
            description: 'Optional glob pattern filter',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_comment',
      description: 'Add a question or note to a file (stored in SQLite, not in the file itself)',
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Path to the file',
          },
          content: {
            type: 'string',
            description: 'Comment content',
          },
          type: {
            type: 'string',
            enum: ['question', 'suggestion', 'note'],
            description: 'Type of comment',
          },
          line: {
            type: 'number',
            description: 'Line number to attach comment to (optional)',
          },
        },
        required: ['file_path', 'content', 'type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_epistle',
      description: 'Write a new epistle to the _epistles/ folder',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Title of the epistle',
          },
          content: {
            type: 'string',
            description: 'Markdown content of the epistle',
          },
          type: {
            type: 'string',
            enum: ['insight', 'recommendation', 'question', 'housekeeping'],
            description: 'Type of epistle',
          },
          source_files: {
            type: 'array',
            items: { type: 'string' },
            description: 'Files referenced in this epistle',
          },
        },
        required: ['title', 'content', 'type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finish_task',
      description: 'Signal that the task is complete. Use this when you have finished your work.',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'Brief summary of what was accomplished',
          },
        },
        required: ['summary'],
      },
    },
  },
] as const

export type ToolName = typeof TOOL_DEFINITIONS[number]['function']['name']

// Tool definitions for chat agents — excludes finish_task (chat ends naturally)
export const CHAT_TOOL_DEFINITIONS = TOOL_DEFINITIONS.filter(
  t => t.function.name !== 'finish_task'
)
