import https from 'https'
import { BrowserWindow } from 'electron'

// ── Types ────────────────────────────────────────────────────
export interface SearchResult {
  title: string
  url: string
  snippet: string
}

export class SearchError extends Error {
  code: 'invalid_key' | 'rate_limited' | 'scrape_failed' | 'no_results'
  constructor(code: SearchError['code'], message?: string) {
    super(message || code)
    this.code = code
  }
}

// ── Public API ───────────────────────────────────────────────
export async function webSearch(query: string, tavilyKey?: string): Promise<string> {
  try {
    if (tavilyKey) {
      return await tavilySearch(query, tavilyKey)
    }
    return await scraperSearch(query)
  } catch (err) {
    if (err instanceof SearchError) throw err
    return `Search failed: ${String(err)}`
  }
}

// ── Tavily provider ──────────────────────────────────────────
async function tavilySearch(query: string, apiKey: string): Promise<string> {
  const body = JSON.stringify({
    api_key: apiKey,
    query,
    search_depth: 'basic',
    max_results: 5,
    include_raw_content: false
  })

  const data: string = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.tavily.com',
        path: '/search',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (res) => {
        let raw = ''
        res.on('data', (chunk: Buffer) => { raw += chunk.toString() })
        res.on('end', () => {
          if (res.statusCode === 401) {
            reject(new SearchError('invalid_key', 'Invalid Tavily API key'))
          } else if (res.statusCode === 429) {
            reject(new SearchError('rate_limited', 'Tavily rate limit reached'))
          } else if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Tavily API error ${res.statusCode}: ${raw}`))
          } else {
            resolve(raw)
          }
        })
        res.on('error', reject)
      }
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })

  const parsed = JSON.parse(data)
  const results: SearchResult[] = (parsed.results || []).map(
    (r: { title: string; url: string; content: string }) => ({
      title: r.title,
      url: r.url,
      snippet: r.content
    })
  )

  if (results.length === 0) throw new SearchError('no_results', 'No search results found')
  return normalizeResults(results)
}

// ── DuckDuckGo scraper + deep content fetch ──────────────────
async function scraperSearch(query: string): Promise<string> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  })

  try {
    // Step 1: Get search results from DDG HTML
    await win.loadURL(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`)

    const raw: SearchResult[] = await win.webContents.executeJavaScript(`
      [...document.querySelectorAll('.result')].slice(0, 5).map(el => {
        const linkEl = el.querySelector('.result__a')
        return {
          title:   el.querySelector('.result__title')?.innerText   ?? '',
          url:     linkEl?.href ?? el.querySelector('.result__url')?.innerText ?? '',
          snippet: el.querySelector('.result__snippet')?.innerText ?? ''
        }
      })
    `)

    console.log('[Search:DDG] Raw results count:', raw?.length || 0)

    if (!raw || raw.length === 0) {
      throw new SearchError('no_results', 'No search results found')
    }

    const filtered = raw.filter(r => r.snippet)

    // Step 2: Fetch actual page content from top result for richer data
    let deepContent = ''
    const topUrl = extractRealUrl(filtered[0]?.url || '')
    if (topUrl) {
      try {
        console.log('[Search:DDG] Fetching deep content from:', topUrl)
        deepContent = await fetchPageContent(win, topUrl)
        console.log('[Search:DDG] Deep content length:', deepContent.length)
      } catch (e) {
        console.log('[Search:DDG] Deep fetch failed:', String(e))
      }
    }

    // Combine: deep content first (most useful), then snippet summaries
    let result = ''
    if (deepContent) {
      result += `## Content from ${filtered[0]?.title || topUrl}\n${deepContent}\n\n`
    }
    result += filtered
      .map(r => `### ${r.title}\n${r.snippet}`)
      .join('\n\n')

    return result
  } catch (err) {
    if (err instanceof SearchError) throw err
    throw new SearchError('scrape_failed', `DuckDuckGo scrape failed: ${String(err)}`)
  } finally {
    win.destroy()
  }
}

// ── Extract real URL from DDG redirect ───────────────────────
function extractRealUrl(ddgUrl: string): string {
  if (!ddgUrl) return ''
  // DDG wraps URLs like //duckduckgo.com/l/?uddg=https%3A%2F%2F...&rut=...
  try {
    if (ddgUrl.includes('uddg=')) {
      const u = new URL(ddgUrl, 'https://duckduckgo.com')
      return u.searchParams.get('uddg') || ddgUrl
    }
    // If it's already a direct URL
    if (ddgUrl.startsWith('http')) return ddgUrl
    if (ddgUrl.startsWith('//')) return 'https:' + ddgUrl
    return 'https://' + ddgUrl
  } catch {
    return ddgUrl.startsWith('http') ? ddgUrl : ''
  }
}

// ── Fetch and extract text from a page ───────────────────────
async function fetchPageContent(win: BrowserWindow, url: string): Promise<string> {
  // Set a timeout for slow pages
  const loadPromise = win.loadURL(url)
  const timeout = new Promise<never>((_, rej) =>
    setTimeout(() => rej(new Error('Page load timeout')), 8000)
  )

  await Promise.race([loadPromise, timeout])

  // Extract readable text content (skip nav, ads, scripts)
  const text: string = await win.webContents.executeJavaScript(`
    (function() {
      // Remove noisy elements
      const remove = ['script','style','nav','header','footer','iframe',
                       'noscript','.ad','.ads','.sidebar','[role="navigation"]',
                       '[role="banner"]','[role="complementary"]'];
      remove.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => el.remove());
      });

      // Get main content area or body
      const main = document.querySelector('main, article, [role="main"], .content, #content')
                   || document.body;

      // Get text, clean up whitespace
      const text = main.innerText || '';
      // Collapse whitespace, trim to ~2000 chars for LLM context
      return text.replace(/\\n{3,}/g, '\\n\\n').replace(/[ \\t]+/g, ' ').trim().slice(0, 2000);
    })()
  `)

  return text
}

// ── Shared normalizer ────────────────────────────────────────
function normalizeResults(results: SearchResult[]): string {
  return results
    .map(r => `### ${r.title}\n${r.url}\n${r.snippet}`)
    .join('\n\n')
}
