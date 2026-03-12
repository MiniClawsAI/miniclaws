import type { AIProvider } from './ai'

// ── Tool definition (provider-agnostic) ──────────────────────
export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required: string[]
  }
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export const WEB_SEARCH_TOOL: ToolDefinition = {
  name: 'web_search',
  description:
    'Search the web for current information. Use when asked about recent events, current news, facts you are unsure about, or anything requiring up-to-date information.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query' }
    },
    required: ['query']
  }
}

// ── Format tool for each provider's API ──────────────────────
export function formatToolsForProvider(
  tools: ToolDefinition[],
  provider: AIProvider
): unknown {
  switch (provider) {
    case 'anthropic':
      return tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters
      }))

    case 'openai':
      return tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }
      }))

    case 'gemini':
      return [
        {
          functionDeclarations: tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters
          }))
        }
      ]

    case 'ollama':
      // Ollama uses OpenAI-compatible tool format
      return tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }
      }))

    default:
      return []
  }
}

// ── Format tool result message for each provider ─────────────
export function formatToolResultMessage(
  provider: AIProvider,
  toolCallId: string,
  toolName: string,
  result: string
): Record<string, unknown> {
  switch (provider) {
    case 'anthropic':
      return {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolCallId,
            content: result
          }
        ]
      }

    case 'openai':
      return {
        role: 'tool',
        tool_call_id: toolCallId,
        content: result
      }

    case 'gemini':
      return {
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: toolName,
              response: { result }
            }
          }
        ]
      }

    case 'ollama':
      return {
        role: 'tool',
        content: result
      }

    default:
      return { role: 'tool', content: result }
  }
}

// ── Format assistant tool-call message for conversation history ──
export function formatAssistantToolCallMessage(
  provider: AIProvider,
  toolCall: ToolCall
): Record<string, unknown> {
  switch (provider) {
    case 'anthropic':
      return {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.name,
            input: toolCall.arguments
          }
        ]
      }

    case 'openai':
      return {
        role: 'assistant',
        tool_calls: [
          {
            id: toolCall.id,
            type: 'function',
            function: {
              name: toolCall.name,
              arguments: JSON.stringify(toolCall.arguments)
            }
          }
        ]
      }

    case 'gemini':
      return {
        role: 'model',
        parts: [
          {
            functionCall: {
              name: toolCall.name,
              args: toolCall.arguments
            }
          }
        ]
      }

    case 'ollama':
      return {
        role: 'assistant',
        tool_calls: [
          {
            id: toolCall.id,
            type: 'function',
            function: {
              name: toolCall.name,
              arguments: JSON.stringify(toolCall.arguments)
            }
          }
        ]
      }

    default:
      return { role: 'assistant', content: '' }
  }
}
