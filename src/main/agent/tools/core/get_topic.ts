import type { ToolEntry, ToolContext } from '../types.js'

export const getTopicTool: ToolEntry = {
  meta: {
    name: 'get_topic',
    label: 'Get Topic',
    description: 'Get top 10 tags based on user interests from vault files.',
    category: 'core',
    defaultEnabled: true,
  },
  definition: {
    type: 'function',
    function: {
      name: 'get_topic',
      description: 'Returns a list of top 10 tags based on user interests. Use this when you need to find ideas or topics related to the user.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  handler: async (_args: Record<string, unknown>, context: ToolContext) => {
    // Query all files with tags from the database
    const files = context.dbManager['db'].prepare(`
      SELECT tags FROM files WHERE tags IS NOT NULL AND tags != ''
    `).all() as Array<{ tags: string }>

    // Count tag occurrences
    const tagCounts = new Map<string, number>()
    
    for (const file of files) {
      // Tags are stored as comma-separated strings
      const tags = file.tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      }
    }

    // Sort by count and get top 10
    const sortedTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }))

    return {
      topics: sortedTags,
      total_tags: tagCounts.size,
      message: sortedTags.length > 0 
        ? `Found ${sortedTags.length} top topics based on user interests.`
        : 'No tags found in vault files. The user may not have tagged any files yet.',
    }
  },
}
