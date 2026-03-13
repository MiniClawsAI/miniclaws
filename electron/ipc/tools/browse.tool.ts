import { shell } from 'electron'
import type { RegisteredTool, ToolResult } from '../tool-registry'
import { fetchPageContent, screenshotPage } from '../system-api'

/**
 * Normalise a URL — add https:// if missing.
 */
function normalizeUrl(input: string): string {
  let url = input.trim()
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url
  }
  return url
}

export const browseTool: RegisteredTool = {
  name: 'browse',
  version: '1.0.0',
  description:
    'Browse the web: open a URL in the user\'s browser, read a page\'s text content, ' +
    'or take a screenshot of a webpage. Use "open" to show a page to the user, ' +
    '"read" to extract text for research, or "screenshot" to see what a page looks like.',

  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description:
          'Action to perform: "open" opens the URL in the user\'s default browser, ' +
          '"read" fetches and extracts the page text content (for research), ' +
          '"screenshot" takes a visual screenshot of the page'
      },
      url: {
        type: 'string',
        description: 'The URL to browse (e.g., "https://example.com" or "example.com")'
      }
    },
    required: ['action', 'url']
  },

  permissions: {
    network: ['*'],
    system: {}
  },

  destructive: false,
  statusMessage: 'Browsing the web...',

  async handler(args): Promise<ToolResult> {
    const action = ((args.action as string) || 'open').toLowerCase()
    const rawUrl = (args.url as string) || ''

    if (!rawUrl.trim()) return 'No URL provided.'

    const url = normalizeUrl(rawUrl)

    console.log(`[browse] action="${action}" url="${url}"`)

    // ── Open in user's browser ──────────────────────────────
    if (action === 'open') {
      try {
        await shell.openExternal(url)
        return `Opened ${url} in your default browser.`
      } catch (err) {
        return `Failed to open URL: ${err instanceof Error ? err.message : String(err)}`
      }
    }

    // ── Read page content ───────────────────────────────────
    if (action === 'read') {
      try {
        const result = await fetchPageContent(url, { maxChars: 4000, timeout: 12000 })

        if (!result.text || result.text.trim().length < 20) {
          return (
            `Page loaded (${result.title || url}) but had very little readable text. ` +
            `This might be a heavily JavaScript-based app or require login. ` +
            `Try using "screenshot" to see what the page looks like visually.`
          )
        }

        const header = result.title ? `📄 ${result.title}\n${url}\n\n` : `📄 ${url}\n\n`
        return header + result.text
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg === 'PAGE_TIMEOUT') {
          return `The page took too long to load (>12s). It might be down or very slow.`
        }
        return `Failed to read page: ${msg}`
      }
    }

    // ── Screenshot the page ─────────────────────────────────
    if (action === 'screenshot') {
      try {
        const result = await screenshotPage(url, { maxWidth: 1280, quality: 75, timeout: 15000 })
        return {
          type: 'image',
          mimeType: result.mimeType,
          base64: result.base64,
          text: `Screenshot of "${result.title || url}" (${result.width}×${result.height})`
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg === 'PAGE_TIMEOUT') {
          return `The page took too long to load (>15s). It might be down or very slow.`
        }
        return `Failed to screenshot page: ${msg}`
      }
    }

    return `Unknown action "${action}". Use "open", "read", or "screenshot".`
  }
}
