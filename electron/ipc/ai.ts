import { ipcMain, BrowserWindow } from 'electron'
import https from 'https'
import http from 'http'
import { getToolRegistry } from './tool-registry'
import {
  formatToolsForProvider,
  formatToolResultMessage,
  formatAssistantToolCallMessage,
  type ToolCall
} from './tools'

export type AIProvider = 'anthropic' | 'openai' | 'gemini' | 'ollama'

export interface AIConfig {
  provider: AIProvider
  apiKey?: string
  model?: string
  baseUrl?: string
  systemPrompt?: string
  webSearchEnabled?: boolean
  openAppEnabled?: boolean
  tavilyApiKey?: string
}

export interface Message {
  role: 'user' | 'assistant' | 'tool'
  content: string
}

const DEFAULT_SYSTEM = `You are MiniClaws, a friendly 3D desktop companion character.
You're helpful, witty, and concise. You live on the user's desktop and assist them.
Keep responses short and conversational - 1-3 sentences unless asked for more.`

// Tool-specific system prompt hints (only appended when tool is enabled)
const TOOL_HINTS: Record<string, string> = {
  web_search: `
web_search — Search the web. You MUST use it whenever:
- The user asks about current events, news, weather, or real-time information
- The user asks about something you're not confident about
- The user asks for recent data, prices, scores, or status updates
Do NOT make up or guess at current information — always search first.`,

  open_app: `
open_app — Open applications on the user's computer. Use it when:
- The user asks you to open, launch, or start an app (e.g., "open Chrome", "launch Slack")
- The user asks if an app is installed (use action "search")
- If the app is not found, share the install suggestions from the tool result
- If the user wants to install a missing app, use web_search to find installation instructions
- Common abbreviations are supported: "code" = VS Code, "chrome" = Google Chrome, etc.`
}

/** Get the list of enabled tool names based on config flags. */
function getEnabledToolNames(config: AIConfig): string[] {
  const enabled: string[] = []
  if (config.webSearchEnabled !== false) enabled.push('web_search')
  if (config.openAppEnabled !== false) enabled.push('open_app')
  return enabled
}

/** Build tools addendum for only the enabled tools. */
function buildToolsAddendum(config: AIConfig): string {
  const enabled = getEnabledToolNames(config)
  if (enabled.length === 0) return ''
  const hints = enabled
    .map((name) => TOOL_HINTS[name])
    .filter(Boolean)
    .join('\n')
  return `\nIMPORTANT: You have tools available:\n${hints}`
}

// ── Stream result types ──────────────────────────────────────
interface StreamResult {
  type: 'text' | 'tool_call'
  text?: string
  toolCall?: ToolCall
}

// ── Anthropic streaming ────────────────────────────────────
async function* streamAnthropic(
  messages: Record<string, unknown>[],
  config: AIConfig
): AsyncGenerator<StreamResult> {
  const enabledNames = getEnabledToolNames(config)
  const systemPrompt = (config.systemPrompt || DEFAULT_SYSTEM) + buildToolsAddendum(config)

  const reqBody: Record<string, unknown> = {
    model: config.model || 'claude-sonnet-4-5-20251001',
    max_tokens: 1024,
    system: systemPrompt,
    stream: true,
    messages
  }

  if (enabledNames.length > 0) {
    const registry = getToolRegistry()
    const tools = registry.getToolDefinitions().filter((t) => enabledNames.includes(t.name))
    reqBody.tools = formatToolsForProvider(tools, 'anthropic')
    console.log('[AI:Anthropic] Tools included:', enabledNames)
  }

  const body = JSON.stringify(reqBody)

  // Track tool use blocks during streaming
  let currentToolUse: { id: string; name: string; jsonBuf: string } | null = null

  yield* streamPostResults({
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

      // Text delta
      if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
        return { type: 'text' as const, text: data.delta.text }
      }

      // Tool use block start
      if (data.type === 'content_block_start' && data.content_block?.type === 'tool_use') {
        currentToolUse = {
          id: data.content_block.id,
          name: data.content_block.name,
          jsonBuf: ''
        }
        return null
      }

      // Tool use input delta
      if (data.type === 'content_block_delta' && data.delta?.type === 'input_json_delta') {
        if (currentToolUse) {
          currentToolUse.jsonBuf += data.delta.partial_json
        }
        return null
      }

      // Tool use block stop — emit the complete tool call
      if (data.type === 'content_block_stop' && currentToolUse) {
        const tc = currentToolUse
        currentToolUse = null
        try {
          const args = tc.jsonBuf ? JSON.parse(tc.jsonBuf) : {}
          return {
            type: 'tool_call' as const,
            toolCall: { id: tc.id, name: tc.name, arguments: args }
          }
        } catch {
          return null
        }
      }

      return null
    }
  })
}

// ── OpenAI streaming ───────────────────────────────────────
async function* streamOpenAI(
  messages: Record<string, unknown>[],
  config: AIConfig
): AsyncGenerator<StreamResult> {
  const enabledNames = getEnabledToolNames(config)
  const systemPrompt = (config.systemPrompt || DEFAULT_SYSTEM) + buildToolsAddendum(config)

  const reqBody: Record<string, unknown> = {
    model: config.model || 'gpt-4o-mini',
    max_tokens: 1024,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ]
  }

  if (enabledNames.length > 0) {
    const registry = getToolRegistry()
    const tools = registry.getToolDefinitions().filter((t) => enabledNames.includes(t.name))
    reqBody.tools = formatToolsForProvider(tools, 'openai')
  }

  const body = JSON.stringify(reqBody)
  const url = new URL(config.baseUrl || 'https://api.openai.com/v1/chat/completions')

  // Accumulate tool call data across chunks
  let toolCallId = ''
  let toolCallName = ''
  let toolCallArgs = ''

  yield* streamPostResults({
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
      const choice = data.choices?.[0]

      // Text delta
      if (choice?.delta?.content) {
        return { type: 'text' as const, text: choice.delta.content }
      }

      // Tool call delta
      if (choice?.delta?.tool_calls?.[0]) {
        const tc = choice.delta.tool_calls[0]
        if (tc.id) toolCallId = tc.id
        if (tc.function?.name) toolCallName = tc.function.name
        if (tc.function?.arguments) toolCallArgs += tc.function.arguments
        return null
      }

      // Finish with tool_calls — emit
      if (choice?.finish_reason === 'tool_calls' && toolCallName) {
        try {
          const args = toolCallArgs ? JSON.parse(toolCallArgs) : {}
          return {
            type: 'tool_call' as const,
            toolCall: { id: toolCallId, name: toolCallName, arguments: args }
          }
        } catch {
          return null
        }
      }

      return null
    }
  })
}

// ── Gemini streaming ──────────────────────────────────────
async function* streamGemini(
  messages: Record<string, unknown>[],
  config: AIConfig
): AsyncGenerator<StreamResult> {
  const model = config.model || 'gemini-2.5-flash'

  // Gemini needs its own message format — filter user/assistant only
  const geminiMessages = (messages as { role: string; parts?: unknown[] }[]).map((m) => {
    if (m.parts) return m // already in Gemini format (tool result)
    return {
      role: (m as unknown as Message).role === 'assistant' ? 'model' : 'user',
      parts: [{ text: (m as unknown as Message).content }]
    }
  })

  const enabledNames = getEnabledToolNames(config)
  const systemPrompt = (config.systemPrompt || DEFAULT_SYSTEM) + buildToolsAddendum(config)

  const reqBody: Record<string, unknown> = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: geminiMessages
  }

  if (enabledNames.length > 0) {
    const registry = getToolRegistry()
    const tools = registry.getToolDefinitions().filter((t) => enabledNames.includes(t.name))
    reqBody.tools = formatToolsForProvider(tools, 'gemini')
    console.log('[AI:Gemini] Tools included:', enabledNames)
  }

  const body = JSON.stringify(reqBody)
  console.log('[AI:Gemini] Request body keys:', Object.keys(reqBody))

  yield* streamPostResults({
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${config.apiKey || ''}`,
    headers: { 'Content-Type': 'application/json' },
    body,
    parseChunk: (line) => {
      if (!line.startsWith('data: ')) return null
      const data = JSON.parse(line.slice(6))
      const parts = data.candidates?.[0]?.content?.parts

      if (!parts?.length) return null

      // Check all parts for function calls (may appear alongside text)
      for (const part of parts) {
        if (part.functionCall) {
          console.log('[AI:Gemini] functionCall detected:', JSON.stringify(part.functionCall))
          return {
            type: 'tool_call' as const,
            toolCall: {
              id: `gemini-${Date.now()}`,
              name: part.functionCall.name,
              arguments: part.functionCall.args || {}
            }
          }
        }
      }

      // Otherwise return text from first part
      const text = parts[0]?.text
      if (text) {
        return { type: 'text' as const, text }
      }

      return null
    }
  })
}

// ── Ollama streaming ───────────────────────────────────────
async function* streamOllama(
  messages: Record<string, unknown>[],
  config: AIConfig
): AsyncGenerator<StreamResult> {
  const enabledNames = getEnabledToolNames(config)
  const systemPrompt = (config.systemPrompt || DEFAULT_SYSTEM) + buildToolsAddendum(config)

  const reqBody: Record<string, unknown> = {
    model: config.model || 'llama3.2',
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ]
  }

  if (enabledNames.length > 0) {
    const registry = getToolRegistry()
    const tools = registry.getToolDefinitions().filter((t) => enabledNames.includes(t.name))
    reqBody.tools = formatToolsForProvider(tools, 'ollama')
  }

  const body = JSON.stringify(reqBody)
  const url = new URL(`${config.baseUrl || 'http://localhost:11434'}/api/chat`)

  yield* streamPostResults({
    hostname: url.hostname,
    path: url.pathname,
    port: Number(url.port) || undefined,
    useHttp: url.protocol === 'http:',
    headers: { 'Content-Type': 'application/json' },
    body,
    parseChunk: (line) => {
      const data = JSON.parse(line)

      // Tool calls in Ollama
      if (data.message?.tool_calls?.length) {
        const tc = data.message.tool_calls[0]
        return {
          type: 'tool_call' as const,
          toolCall: {
            id: `ollama-${Date.now()}`,
            name: tc.function?.name || '',
            arguments: tc.function?.arguments || {}
          }
        }
      }

      if (data.done) return null
      if (data.message?.content) {
        return { type: 'text' as const, text: data.message.content }
      }
      return null
    }
  })
}

// ── Generic SSE/NDJSON stream helper (returns StreamResult) ──
interface StreamResultOptions {
  hostname: string
  path: string
  port?: number
  useHttp?: boolean
  headers: Record<string, string>
  body: string
  parseChunk: (line: string) => StreamResult | null
}

async function* streamPostResults(opts: StreamResultOptions): AsyncGenerator<StreamResult> {
  const { hostname, path, port, useHttp, headers, body, parseChunk } = opts
  const transport = useHttp ? http : https

  yield* await new Promise<AsyncGenerator<StreamResult>>((resolve, reject) => {
    const gen = (async function* () {
      const chunks: StreamResult[] = []

      await new Promise<void>((res, rej) => {
        const req = transport.request(
          {
            hostname,
            path,
            port,
            method: 'POST',
            headers: { ...headers, 'Content-Length': Buffer.byteLength(body) }
          },
          (response) => {
            let errorBody = ''
            let buffer = ''
            const statusOk =
              response.statusCode && response.statusCode >= 200 && response.statusCode < 300

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
                  const result = parseChunk(trimmed)
                  if (result) chunks.push(result)
                } catch {
                  /* skip malformed */
                }
              }
            })
            response.on('end', () => {
              if (!statusOk) {
                let msg = `API error ${response.statusCode}`
                try {
                  const parsed = JSON.parse(errorBody)
                  msg = parsed.error?.message || parsed.error?.status || msg
                } catch {
                  /* use default msg */
                }
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

      for (const chunk of chunks) yield chunk
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
        messages: userMessages,
        config
      }: { messages: Message[]; config: AIConfig }
    ) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return

      try {
        // Build conversation as generic objects (providers need different shapes)
        let conversation: Record<string, unknown>[] = userMessages.map((m) => ({
          role: m.role,
          content: m.content
        }))

        // Tool-call loop — max 3 iterations to prevent infinite loops
        for (let turn = 0; turn < 3; turn++) {
          const gen = getProviderStream(conversation, config)

          let collectedToolCall: ToolCall | null = null

          for await (const result of gen) {
            if (result.type === 'text' && result.text) {
              event.sender.send('ai:chunk', result.text)
            } else if (result.type === 'tool_call' && result.toolCall) {
              collectedToolCall = result.toolCall
              console.log('[AI] Tool call detected:', JSON.stringify(result.toolCall))
            }
          }

          // No tool call — we're done
          if (!collectedToolCall) {
            console.log('[AI] No tool call on turn', turn, '— done.')
            break
          }

          // Execute the tool call via registry
          console.log('[AI] Executing tool:', collectedToolCall.name, collectedToolCall.arguments)

          const registry = getToolRegistry()
          const tool = registry.get(collectedToolCall.name)
          event.sender.send('ai:tool_status', tool?.statusMessage || `Using ${collectedToolCall.name}...`)

          let toolResult: string
          try {
            if (registry.has(collectedToolCall.name)) {
              toolResult = await registry.call(
                collectedToolCall.name,
                collectedToolCall.arguments,
                { config: { tavilyApiKey: config.tavilyApiKey } }
              )
            } else {
              toolResult = `Unknown tool: ${collectedToolCall.name}`
            }
          } catch (err) {
            toolResult = `Tool failed: ${err instanceof Error ? err.message : String(err)}`
          }

          console.log('[AI] Tool result (first 500 chars):', toolResult.slice(0, 500))

          // Append assistant tool-call + tool result to conversation
          conversation = [
            ...conversation,
            formatAssistantToolCallMessage(config.provider, collectedToolCall),
            formatToolResultMessage(
              config.provider,
              collectedToolCall.id,
              collectedToolCall.name,
              toolResult
            )
          ]

          // Loop back — the LLM will now respond with the search results
        }

        event.sender.send('ai:done')
      } catch (err) {
        event.sender.send('ai:error', String(err))
      }
    }
  )
}

function getProviderStream(
  messages: Record<string, unknown>[],
  config: AIConfig
): AsyncGenerator<StreamResult> {
  switch (config.provider) {
    case 'anthropic':
      return streamAnthropic(messages, config)
    case 'openai':
      return streamOpenAI(messages, config)
    case 'gemini':
      return streamGemini(messages, config)
    case 'ollama':
      return streamOllama(messages, config)
    default:
      return streamOllama(messages, config)
  }
}
