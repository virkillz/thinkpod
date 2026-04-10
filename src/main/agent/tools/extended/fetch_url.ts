import type { ToolEntry } from '../types.js'

export const fetchUrlTool: ToolEntry = {
  meta: {
    name: 'fetch_url',
    label: 'Fetch URL',
    description: 'Fetch the content of any URL and return it as text.',
    category: 'extended',
    defaultEnabled: false,
  },
  definition: {
    type: 'function',
    function: {
      name: 'fetch_url',
      description: 'Fetch the content of a URL and return the response body as text.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The full URL to fetch.' },
          headers: { type: 'object', description: 'Optional HTTP headers to include.' },
        },
        required: ['url'],
      },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const { url, headers = {} } = args as { url: string; headers?: Record<string, string> }
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) })
    const text = await res.text()
    return {
      url,
      status: res.status,
      content_type: res.headers.get('content-type') ?? 'unknown',
      body: text.slice(0, 20_000),
    }
  },
}
