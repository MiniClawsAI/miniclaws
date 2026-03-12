import { ipcMain, BrowserWindow } from 'electron'
import https from 'https'

export type AIProvider = 'anthropic' | 'openai' | 'gemini' | 'ollama'

export interface AIConfig {
  provider: AIProvider
  apiKey?: string
  model?: string
  baseUrl?: string
  systemPrompt?: string
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

const DEFAULT_SYSTEM = `You are a friendly 3D desktop companion character. 
You're helpful, witty, and concise. You live on the user's desktop and assist them.
Keep responses short and conversational - 1-3 sentences unless asked for more.`

// ── Anthropic streaming ────────────────────────────────────
async function* streamAnthropic(
  messages: Message[],
  config: AIConfig
): AsyncGenerator<string> {
  const body = JSON.stringify({
    model: config.model || 'claude-sonnet-4-5-20251001',
    max_tokens: 1024,
    system: config.systemPrompt || DEFAULT_SYSTEM,
    stream: true,
    messages
  })

  yield* streamPost({
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey || '',
      'anthropic-version': '2023-06-01'
    },
    body,
    parseChunk: (line) => {
      if (!line.startsWith('data: ')) return null
      const data = JSON.parse(line.slice(6))
      if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
        return data.delta.text
      }
      return null
    }
  })
}

// ── OpenAI streaming ───────────────────────────────────────
async function* streamOpenAI(
  messages: Message[],
  config: AIConfig
): AsyncGenerator<string> {
  const body = JSON.stringify({
    model: config.model || 'gpt-4o-mini',
    max_tokens: 1024,
    stream: true,
    messages: [
      { role: 'system', content: config.systemPrompt || DEFAULT_SYSTEM },
      ...messages
    ]
  })

  const url = new URL(config.baseUrl || 'https://api.openai.com/v1/chat/completions')

  yield* streamPost({
    hostname: url.hostname,
    path: url.pathname,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey || ''}`
    },
    body,
    parseChunk: (line) => {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') return null
      const data = JSON.parse(line.slice(6))
      return data.choices?.[0]?.delta?.content || null
    }
  })
}

// ── Gemini streaming ──────────────────────────────────────
async function* streamGemini(
  messages: Message[],
  config: AIConfig
): AsyncGenerator<string> {
  const model = config.model || 'gemini-2.5-flash'
  const geminiMessages = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }))

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: config.systemPrompt || DEFAULT_SYSTEM }] },
    contents: geminiMessages
  })

  yield* streamPost({
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${config.apiKey || ''}`,
    headers: { 'Content-Type': 'application/json' },
    body,
    parseChunk: (line) => {
      if (!line.startsWith('data: ')) return null
      const data = JSON.parse(line.slice(6))
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null
    }
  })
}

// ── Ollama streaming ───────────────────────────────────────
async function* streamOllama(
  messages: Message[],
  config: AIConfig
): AsyncGenerator<string> {
  const body = JSON.stringify({
    model: config.model || 'llama3.2',
    stream: true,
    messages: [
      { role: 'system', content: config.systemPrompt || DEFAULT_SYSTEM },
      ...messages
    ]
  })

  const url = new URL(`${config.baseUrl || 'http://localhost:11434'}/api/chat`)

  yield* streamPost({
    hostname: url.hostname,
    path: url.pathname,
    port: Number(url.port) || undefined,
    headers: { 'Content-Type': 'application/json' },
    body,
    parseChunk: (line) => {
      const data = JSON.parse(line)
      if (data.done) return null
      return data.message?.content || null
    }
  })
}

// ── Generic SSE/NDJSON stream helper ──────────────────────
interface StreamOptions {
  hostname: string
  path: string
  port?: number
  headers: Record<string, string>
  body: string
  parseChunk: (line: string) => string | null
}

async function* streamPost(opts: StreamOptions): AsyncGenerator<string> {
  const { hostname, path, port, headers, body, parseChunk } = opts
  yield* await new Promise<AsyncGenerator<string>>((resolve, reject) => {
    const gen = (async function* () {
      const chunks: Buffer[] = []
      let buffer = ''

      await new Promise<void>((res, rej) => {
        const req = https.request(
          { hostname, path, port, method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(body) } },
          (response) => {
            let errorBody = ''
            const statusOk = response.statusCode && response.statusCode >= 200 && response.statusCode < 300

            response.on('data', (chunk: Buffer) => {
              const str = chunk.toString()
              if (!statusOk) {
                errorBody += str
                return
              }
              buffer += str
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''
              for (const line of lines) {
                const trimmed = line.trim()
                if (!trimmed) continue
                try {
                  const text = parseChunk(trimmed)
                  if (text) chunks.push(Buffer.from(text))
                } catch { /* skip malformed */ }
              }
            })
            response.on('end', () => {
              if (!statusOk) {
                let msg = `API error ${response.statusCode}`
                try {
                  const parsed = JSON.parse(errorBody)
                  msg = parsed.error?.message || parsed.error?.status || msg
                } catch { /* use default msg */ }
                rej(new Error(msg))
              } else {
                res()
              }
            })
            response.on('error', rej)
          }
        )
        req.on('error', rej)
        req.write(body)
        req.end()
      })

      for (const chunk of chunks) yield chunk.toString()
    })()

    resolve(gen)
  })
}

// ── IPC registration ───────────────────────────────────────
export function setupAIHandlers(): void {
  ipcMain.on(
    'ai:chat',
    async (
      event,
      {
        messages,
        config
      }: { messages: Message[]; config: AIConfig }
    ) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return

      try {
        let gen: AsyncGenerator<string>
        if (config.provider === 'anthropic') {
          gen = streamAnthropic(messages, config)
        } else if (config.provider === 'openai') {
          gen = streamOpenAI(messages, config)
        } else if (config.provider === 'gemini') {
          gen = streamGemini(messages, config)
        } else {
          gen = streamOllama(messages, config)
        }

        for await (const chunk of gen) {
          event.sender.send('ai:chunk', chunk)
        }
        event.sender.send('ai:done')
      } catch (err) {
        event.sender.send('ai:error', String(err))
      }
    }
  )
}
