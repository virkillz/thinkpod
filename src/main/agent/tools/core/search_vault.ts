import type { ToolEntry, ToolContext } from '../types.js'

export const searchVaultTool: ToolEntry = {
  meta: {
    name: 'search_vault',
    label: 'Search Vault',
    description: 'Full-text search across all local notes and documents in the vault.',
    category: 'core',
    defaultEnabled: true,
  },
  definition: {
    type: 'function',
    function: {
      name: 'search_vault',
      description:
        'Search all LOCAL notes and documents in the vault by keyword or phrase. This searches your personal vault only, NOT the internet. Returns ranked results with a short snippet and the full file path. Use read_file to get the complete content of any result.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query. Supports FTS5 syntax (e.g. "machine learning", term*, term1 OR term2).',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default 10, max 50).',
          },
        },
        required: ['query'],
      },
    },
  },
  handler: async (args: Record<string, unknown>, context: ToolContext) => {
    const { query, limit } = args as { query: string; limit?: number }
    const cap = Math.min(limit ?? 10, 50)

    let results
    try {
      results = context.dbManager.searchFiles(query, cap)
    } catch {
      // FTS5 query syntax error — retry with the query as a quoted literal
      const escaped = query.replace(/"/g, '""')
      results = context.dbManager.searchFiles(`"${escaped}"`, cap)
    }

    return {
      count: results.length,
      results: results.map(r => ({
        path: r.path,
        title: r.title,
        folder: r.folder,
        snippet: r.snippet,
      })),
    }
  },
}
