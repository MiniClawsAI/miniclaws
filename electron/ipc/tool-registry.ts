import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import type { ToolDefinition } from './tools'

// ── Types ────────────────────────────────────────────────────

export interface ToolPermissions {
  filesystem?: string[]
  network?: string[]
  process?: { shell: boolean; spawn?: string[]; env?: string[] }
  system?: {
    clipboard?: boolean
    screen?: boolean
    notifications?: boolean
    keychain?: boolean
  }
  secrets?: { env_vars?: string[]; description?: string }
}

export interface ToolContext {
  allowedPaths: string[]
  allowedDomains: string[]
  spawnAllowlist: string[]
  config: Record<string, unknown>
}

export interface RegisteredTool {
  name: string
  version: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, { type: string; description: string; [k: string]: unknown }>
    required: string[]
  }
  permissions: ToolPermissions
  destructive: boolean
  statusMessage?: string
  handler: (
    args: Record<string, unknown>,
    context: ToolContext
  ) => Promise<ToolResult>
}

// ── Tool result (string or image) ────────────────────────────

export interface ToolImageResult {
  type: 'image'
  mimeType: 'image/png' | 'image/jpeg'
  base64: string
  /** Optional text description accompanying the image. */
  text?: string
}

/** A tool handler can return plain text or an image result. */
export type ToolResult = string | ToolImageResult

export type RiskLevel = 'safe' | 'caution' | 'sensitive' | 'dangerous'

interface AuditEntry {
  tool: string
  args: Record<string, unknown>
  timestamp: string
  status: 'pending' | 'success' | 'error'
  durationMs?: number
  error?: string
}

// ── Registry ─────────────────────────────────────────────────

class ToolRegistry {
  #tools = new Map<string, RegisteredTool>()
  #userPermissions: Record<string, Partial<ToolContext>> = {}
  #logPath: string

  constructor() {
    const home = app?.getPath?.('home') || process.env.HOME || ''
    const dir = path.join(home, '.miniclaws')
    fs.mkdirSync(dir, { recursive: true })
    this.#logPath = path.join(dir, 'audit.log')
  }

  /** Register a tool (built-in or loaded from disk). */
  register(tool: RegisteredTool): void {
    this.#validate(tool)
    this.#tools.set(tool.name, tool)
    console.log(`[registry] registered: ${tool.name} v${tool.version}`)
  }

  /** Unregister a tool by name. */
  unregister(name: string): void {
    this.#tools.delete(name)
    console.log(`[registry] unregistered: ${name}`)
  }

  /** Check if a tool is registered. */
  has(name: string): boolean {
    return this.#tools.has(name)
  }

  /** Get a registered tool. */
  get(name: string): RegisteredTool | undefined {
    return this.#tools.get(name)
  }

  /** Get all registered tools. */
  getAll(): RegisteredTool[] {
    return [...this.#tools.values()]
  }

  /** Get tool names. */
  getToolNames(): string[] {
    return [...this.#tools.keys()]
  }

  /**
   * Produce ToolDefinition[] compatible with the existing
   * formatToolsForProvider() — no changes needed downstream.
   */
  getToolDefinitions(): ToolDefinition[] {
    return [...this.#tools.values()].map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.inputSchema
    }))
  }

  /** Permission summary for install UI. */
  getPermissionSummary(toolName: string) {
    const tool = this.#tools.get(toolName)
    if (!tool) throw new Error(`Unknown tool: ${toolName}`)
    return {
      name: tool.name,
      permissions: tool.permissions,
      destructive: tool.destructive,
      riskLevel: this.getRiskLevel(toolName)
    }
  }

  /** Compute risk level from permissions. */
  getRiskLevel(toolName: string): RiskLevel {
    const tool = this.#tools.get(toolName)
    if (!tool) return 'safe'
    const p = tool.permissions
    if (p.process?.shell) return 'dangerous'
    if (p.system?.keychain) return 'sensitive'
    if (p.network && p.network.length > 0) return 'caution'
    if (p.filesystem?.some((f) => f.startsWith('write'))) return 'caution'
    return 'safe'
  }

  /** Execute a tool call — dispatches to handler with context + audit logging. */
  async call(
    name: string,
    args: Record<string, unknown>,
    extraContext?: Partial<ToolContext>
  ): Promise<ToolResult> {
    const tool = this.#tools.get(name)
    if (!tool) throw new Error(`Unknown tool: ${name}`)

    const context = this.#buildContext(tool, extraContext)
    const entry: AuditEntry = {
      tool: name,
      args: this.#redactSecrets(args, tool),
      timestamp: new Date().toISOString(),
      status: 'pending'
    }

    const start = Date.now()

    try {
      const result = await tool.handler(args, context)
      entry.status = 'success'
      entry.durationMs = Date.now() - start
      this.#writeAuditLog(entry)
      return result
    } catch (err) {
      entry.status = 'error'
      entry.durationMs = Date.now() - start
      entry.error = err instanceof Error ? err.message : String(err)
      this.#writeAuditLog(entry)
      throw err
    }
  }

  /** Set user-approved permissions for a tool (loaded from permissions.json). */
  setUserPermissions(
    toolName: string,
    perms: Partial<ToolContext>
  ): void {
    this.#userPermissions[toolName] = perms
  }

  // ── Private ──────────────────────────────────────────────

  #validate(tool: RegisteredTool): void {
    const required: (keyof RegisteredTool)[] = [
      'name',
      'version',
      'description',
      'inputSchema',
      'permissions',
      'handler'
    ]
    for (const field of required) {
      if (!tool[field]) {
        throw new Error(`Tool "${tool.name || '?'}" missing required field: ${field}`)
      }
    }
  }

  #buildContext(
    tool: RegisteredTool,
    extra?: Partial<ToolContext>
  ): ToolContext {
    const approved = this.#userPermissions[tool.name] || {}
    return {
      allowedPaths: approved.allowedPaths || [],
      allowedDomains: approved.allowedDomains || tool.permissions.network || [],
      spawnAllowlist: approved.spawnAllowlist || tool.permissions.process?.spawn || [],
      config: extra?.config || {},
      ...extra
    }
  }

  #redactSecrets(
    args: Record<string, unknown>,
    tool: RegisteredTool
  ): Record<string, unknown> {
    const secretFields = tool.permissions.secrets?.env_vars || []
    if (secretFields.length === 0) return args
    const redacted = { ...args }
    for (const field of secretFields) delete redacted[field]
    return redacted
  }

  #writeAuditLog(entry: AuditEntry): void {
    try {
      fs.appendFileSync(this.#logPath, JSON.stringify(entry) + '\n')
    } catch {
      console.error('[registry] Failed to write audit log')
    }
  }
}

// ── Singleton ────────────────────────────────────────────────

let registry: ToolRegistry | null = null

export function initToolRegistry(): ToolRegistry {
  registry = new ToolRegistry()
  return registry
}

export function getToolRegistry(): ToolRegistry {
  if (!registry) throw new Error('ToolRegistry not initialized — call initToolRegistry() first')
  return registry
}
