import { SkillRegistry } from '../../SkillRegistry.js'
import type { ToolEntry, ToolContext } from '../types.js'

export const readSkillTool: ToolEntry = {
  meta: {
    name: 'read_skill',
    label: 'Read Skill',
    description: 'Load the full instructions for an installed skill. Call this when the user\'s request matches a skill\'s description.',
    category: 'core',
    defaultEnabled: true,
  },
  definition: {
    type: 'function',
    function: {
      name: 'read_skill',
      description: 'Load the full instructions for an installed skill. Use when the user\'s request matches a skill description in the system prompt.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'The skill name (as listed in the Available Skills section)',
          },
          file: {
            type: 'string',
            description: 'Optional sub-file to read (e.g. "REFERENCE.md"). Defaults to SKILL.md.',
          },
        },
        required: ['name'],
      },
    },
  },
  handler: async (args: Record<string, unknown>, context: ToolContext) => {
    const { name, file } = args as { name: string; file?: string }
    const registry = new SkillRegistry(context.vaultPath)
    const content = await registry.readSkillFile(name, file)
    return { skill: name, file: file ?? 'SKILL.md', content }
  },
}
