import type { ToolEntry, ToolContext } from '../types.js'

export const braveSearchTool: ToolEntry = {
  meta: {
    name: 'brave_search',
    label: 'Brave Search',
    description: 'Search the web and internet using the Brave Search API.',
    category: 'extended',
    defaultEnabled: false,
    configSchema: {
      apiKey: {
        label: 'API Key',
        type: 'password',
        placeholder: 'BSA…',
      },
    },
  },
  definition: {
    type: 'function',
    function: {
      name: 'brave_search',
      description: 'Search the WEB and INTERNET using the Brave Search API. Use this for finding information online, NOT for searching local vault documents. Returns web search results with title, URL, and description.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query.' },
          count: { type: 'number', description: 'Number of results to return (1–10). Defaults to 5.' },
        },
        required: ['query'],
      },
    },
  },
  handler: async (args: Record<string, unknown>, context: ToolContext) => {
    const { query, count = 5 } = args as { query: string; count?: number }
    const apiKey = context.toolsConfig['brave_search']?.config?.apiKey
    if (!apiKey) return { error: 'Brave Search API key is not configured.' }

    const n = Math.min(Math.max(1, count), 10)
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${n}`

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) return { error: `Brave API returned ${res.status}: ${await res.text()}` }

    const data = await res.json() as {
      web?: { results: Array<{ title: string; url: string; description: string }> }
    }
    const results = (data.web?.results ?? []).map(r => ({
      title: r.title,
      url: r.url,
      description: r.description,
    }))

    return { query, results }
  },
}
