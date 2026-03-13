import { webSearch, SearchError } from '../search'
import type { RegisteredTool } from '../tool-registry'

export const webSearchTool: RegisteredTool = {
  name: 'web_search',
  version: '1.0.0',
  description:
    'Search the web for current information. Use when asked about recent events, current news, facts you are unsure about, or anything requiring up-to-date information.',

  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query' }
    },
    required: ['query']
  },

  permissions: {
    network: ['api.tavily.com', 'html.duckduckgo.com']
  },

  destructive: false,
  statusMessage: 'Searching the web...',

  async handler(args, context): Promise<string> {
    const query = args.query as string
    const tavilyApiKey = (context.config?.tavilyApiKey as string) || undefined

    try {
      return await webSearch(query, tavilyApiKey)
    } catch (err) {
      if (err instanceof SearchError) {
        switch (err.code) {
          case 'invalid_key':
            return 'Search failed: Invalid Tavily API key. Please check your settings.'
          case 'rate_limited':
            return 'Search failed: Rate limit reached. Try again later.'
          default:
            return `Search failed: ${err.message}`
        }
      }
      return `Search failed: ${String(err)}`
    }
  }
}
