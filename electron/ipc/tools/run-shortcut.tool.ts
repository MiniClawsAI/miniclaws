import { platform, tmpdir } from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import type { RegisteredTool, ToolResult, ToolImageResult } from '../tool-registry'
import { captureScreen } from '../system-api'

const execAsync = promisify(exec)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const SHORTCUTS_BIN = '/usr/bin/shortcuts'

// ── List / Search / Run ─────────────────────────────────────

async function listShortcuts(): Promise<string> {
  try {
    const { stdout } = await execAsync(`${SHORTCUTS_BIN} list`)
    const names = stdout.trim().split('\n').filter(Boolean)
    if (names.length === 0) return 'No shortcuts found on this Mac.'
    return `Available shortcuts (${names.length}):\n${names.map((n) => `• ${n}`).join('\n')}`
  } catch (err) {
    return `Failed to list shortcuts: ${err instanceof Error ? err.message : String(err)}`
  }
}

async function runShortcut(name: string, input?: string): Promise<ToolResult> {
  // First, verify the shortcut exists
  try {
    const { stdout } = await execAsync(`${SHORTCUTS_BIN} list`)
    const names = stdout.trim().split('\n').filter(Boolean)
    const exactMatch = names.find((n) => n.toLowerCase() === name.toLowerCase())
    if (!exactMatch) {
      const fuzzy = names.filter((n) => n.toLowerCase().includes(name.toLowerCase()))
      if (fuzzy.length > 0) {
        return `Shortcut "${name}" not found. Did you mean: ${fuzzy.join(', ')}?`
      }
      return `Shortcut "${name}" not found. Use action "list" to see available shortcuts.`
    }
    // Use the exact name from the list
    name = exactMatch
  } catch { /* continue with provided name */ }

  // Run via URL scheme — this opens the Shortcuts app and runs visibly (no hang)
  const encoded = encodeURIComponent(name)
  let url = `shortcuts://run-shortcut?name=${encoded}`
  if (input) url += `&input=text&text=${encodeURIComponent(input)}`

  try {
    await execAsync(`open "${url}"`)
    // Wait for the shortcut to run and show its result
    await sleep(2000)

    // Screenshot the result so the AI can see what happened
    try {
      const capture = await captureScreen({ maxWidth: 1920, quality: 85 })
      return {
        type: 'image',
        mimeType: capture.mimeType,
        base64: capture.base64,
        text: `Shortcut "${name}" has been launched via Shortcuts app. Screenshot shows the current result.`
      } as ToolImageResult
    } catch {
      return `Shortcut "${name}" has been launched in the Shortcuts app.`
    }
  } catch (err) {
    return `Failed to run shortcut "${name}": ${err instanceof Error ? err.message : String(err)}`
  }
}

async function searchShortcuts(query: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`${SHORTCUTS_BIN} list`)
    const names = stdout.trim().split('\n').filter(Boolean)
    const lower = query.toLowerCase()
    const matches = names.filter((n) => n.toLowerCase().includes(lower))
    if (matches.length === 0) return `No shortcuts matching "${query}" found.`
    return `Shortcuts matching "${query}" (${matches.length}):\n${matches.map((n) => `• ${n}`).join('\n')}`
  } catch (err) {
    return `Failed to search shortcuts: ${err instanceof Error ? err.message : String(err)}`
  }
}

// ── Create shortcut from action descriptors ─────────────────

interface ShortcutAction {
  id: string                           // e.g. "is.workflow.actions.openurl"
  params?: Record<string, unknown>     // action-specific parameters
}

/**
 * Well-known action templates the AI can use by friendly name.
 * Each maps to an action identifier + default params.
 */
const ACTION_TEMPLATES: Record<string, (p: Record<string, string>) => ShortcutAction> = {
  open_url: (p) => ({
    id: 'is.workflow.actions.openurl',
    params: { WFInput: wfString(p.url || 'https://apple.com') }
  }),
  open_app: (p) => ({
    id: 'is.workflow.actions.openapp',
    params: { WFAppIdentifier: p.bundle_id || '', WFSelectedApp: p.app_name || p.name || '' }
  }),
  show_notification: (p) => ({
    id: 'is.workflow.actions.notification',
    params: {
      WFNotificationActionBody: wfString(p.body || p.text || 'Hello!'),
      WFNotificationActionTitle: wfString(p.title || 'MiniClaws')
    }
  }),
  show_alert: (p) => ({
    id: 'is.workflow.actions.alert',
    params: { WFAlertActionMessage: wfString(p.message || p.text || 'Alert'), WFAlertActionTitle: wfString(p.title || 'Alert') }
  }),
  speak_text: (p) => ({
    id: 'is.workflow.actions.speaktext',
    params: { WFTextActionText: wfString(p.text || 'Hello') }
  }),
  get_clipboard: () => ({
    id: 'is.workflow.actions.getclipboard',
    params: {}
  }),
  show_result: (p) => ({
    id: 'is.workflow.actions.showresult',
    params: { Text: wfString(p.text || 'Done!') }
  }),
  wait: (p) => ({
    id: 'is.workflow.actions.delay',
    params: { WFDelayTime: Number(p.seconds) || 1 }
  }),
  open_url_in_safari: (p) => ({
    id: 'is.workflow.actions.url',
    params: { WFURLActionURL: p.url || 'https://apple.com' }
  }),
  vibrate: () => ({
    id: 'is.workflow.actions.vibrate',
    params: {}
  }),
  run_shell_script: (p) => ({
    id: 'is.workflow.actions.runsshscript',
    params: { WFShellScript: p.script || 'echo "hello"' }
  }),
  get_text: (p) => ({
    id: 'is.workflow.actions.gettext',
    params: { WFTextActionText: wfString(p.text || '') }
  }),
  search_web: (p) => ({
    id: 'is.workflow.actions.searchmaps',
    params: { WFSearchQuery: wfString(p.query || '') }
  }),
  comment: (p) => ({
    id: 'is.workflow.actions.comment',
    params: { WFCommentActionText: p.text || '' }
  })
}

/** Wrap a string as a WFTextTokenString for plist parameters that expect it. */
function wfString(text: string): Record<string, unknown> {
  return {
    Value: {
      attachmentsByRange: {},
      string: text
    },
    WFSerializationType: 'WFTextTokenString'
  }
}

function actionToPlistDict(action: ShortcutAction): string {
  const paramsXml = action.params
    ? Object.entries(action.params).map(([k, v]) => `\t\t\t<key>${escXml(k)}</key>\n\t\t\t${valueToPlist(v)}`).join('\n')
    : ''

  return `\t\t<dict>
\t\t\t<key>WFWorkflowActionIdentifier</key>
\t\t\t<string>${escXml(action.id)}</string>
\t\t\t<key>WFWorkflowActionParameters</key>
\t\t\t<dict>
${paramsXml}
\t\t\t</dict>
\t\t</dict>`
}

function valueToPlist(v: unknown): string {
  if (typeof v === 'string') return `<string>${escXml(v)}</string>`
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return `<integer>${v}</integer>`
    return `<real>${v}</real>`
  }
  if (typeof v === 'boolean') return v ? '<true/>' : '<false/>'
  if (Array.isArray(v)) {
    return `<array>\n${v.map((item) => `\t${valueToPlist(item)}`).join('\n')}\n</array>`
  }
  if (v && typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `\t<key>${escXml(k)}</key>\n\t${valueToPlist(val)}`)
      .join('\n')
    return `<dict>\n${entries}\n</dict>`
  }
  return `<string>${escXml(String(v))}</string>`
}

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildShortcutPlist(name: string, actions: ShortcutAction[]): string {
  const actionsXml = actions.map(actionToPlistDict).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>WFWorkflowActions</key>
\t<array>
${actionsXml}
\t</array>
\t<key>WFWorkflowClientVersion</key>
\t<string>2302.0.4</string>
\t<key>WFWorkflowIcon</key>
\t<dict>
\t\t<key>WFWorkflowIconGlyphNumber</key>
\t\t<integer>61440</integer>
\t\t<key>WFWorkflowIconStartColor</key>
\t\t<integer>4282601983</integer>
\t</dict>
\t<key>WFWorkflowImportQuestions</key>
\t<array/>
\t<key>WFWorkflowMinimumClientVersion</key>
\t<integer>900</integer>
\t<key>WFWorkflowMinimumClientVersionString</key>
\t<string>900</string>
\t<key>WFWorkflowTypes</key>
\t<array>
\t\t<string>MenuBar</string>
\t\t<string>QuickActions</string>
\t</array>
</dict>
</plist>`
}

async function createShortcut(name: string, actions: unknown[]): Promise<string> {
  // Resolve action descriptors — either template names or raw action dicts
  const resolved: ShortcutAction[] = []
  for (const a of actions) {
    if (typeof a === 'string') {
      // Friendly name with no params
      const template = ACTION_TEMPLATES[a]
      if (!template) return `Unknown action template "${a}". Available: ${Object.keys(ACTION_TEMPLATES).join(', ')}`
      resolved.push(template({}))
    } else if (a && typeof a === 'object') {
      const obj = a as Record<string, unknown>
      // If it has a 'template' key, use template system
      if (obj.template && typeof obj.template === 'string') {
        const template = ACTION_TEMPLATES[obj.template]
        if (!template) return `Unknown action template "${obj.template}". Available: ${Object.keys(ACTION_TEMPLATES).join(', ')}`
        const params: Record<string, string> = {}
        for (const [k, v] of Object.entries(obj)) {
          if (k !== 'template') params[k] = String(v)
        }
        resolved.push(template(params))
      }
      // Raw action with id + params
      else if (obj.id && typeof obj.id === 'string') {
        resolved.push({ id: obj.id, params: (obj.params as Record<string, unknown>) || {} })
      } else {
        return `Invalid action descriptor: ${JSON.stringify(a)}. Each action needs either a "template" or "id" field.`
      }
    }
  }

  if (resolved.length === 0) return 'No valid actions provided for the shortcut.'

  // Generate plist XML
  const plistXml = buildShortcutPlist(name, resolved)

  // Write unsigned shortcut to temp
  const ts = Date.now()
  const unsignedPath = join(tmpdir(), `miniclaws-shortcut-${ts}.shortcut`)
  const signedPath = join(tmpdir(), `miniclaws-shortcut-${ts}-signed.shortcut`)

  try {
    writeFileSync(unsignedPath, plistXml, 'utf-8')

    // Sign the shortcut
    await execAsync(`${SHORTCUTS_BIN} sign --mode anyone --input "${unsignedPath}" --output "${signedPath}"`, { timeout: 10000 })

    // Import by opening — user will see a confirmation dialog
    await execAsync(`open "${signedPath}"`)

    return `Shortcut "${name}" has been created and opened for import. The user should see a dialog to add it to their Shortcuts library. It contains ${resolved.length} action(s).`
  } catch (err) {
    return `Failed to create shortcut: ${err instanceof Error ? err.message : String(err)}`
  } finally {
    // Cleanup unsigned file (signed file stays until macOS processes it)
    try { unlinkSync(unsignedPath) } catch { /* ignore */ }
    // Cleanup signed file after a delay to let macOS read it
    setTimeout(() => { try { unlinkSync(signedPath) } catch { /* ignore */ } }, 10000)
  }
}

// ── The tool ────────────────────────────────────────────────

export const runShortcutTool: RegisteredTool = {
  name: 'run_shortcut',
  version: '1.1.0',
  description:
    'Run, list, search, or create macOS Shortcuts. Can execute existing shortcuts, list available ones, search by keyword, or create new shortcuts from action templates. macOS only.',

  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description:
          'Action: "run" to execute a shortcut, "list" to list all shortcuts, "search" to find by keyword, "create" to build a new shortcut'
      },
      name: {
        type: 'string',
        description: 'Name of the shortcut (required for "run" and "create" actions)'
      },
      input: {
        type: 'string',
        description: 'Optional text input to pass to the shortcut (for "run" action)'
      },
      query: {
        type: 'string',
        description: 'Search keyword (for "search" action)'
      },
      actions: {
        type: 'string',
        description: 'For "create": JSON string of action array. Each object needs "template" + params (e.g. [{"template":"show_notification","title":"Hi","body":"Hello"}]) or raw "id" + "params". Templates: open_url, open_app, show_notification, show_alert, speak_text, get_clipboard, show_result, wait, vibrate, run_shell_script, get_text, comment'
      }
    },
    required: ['action']
  },

  permissions: {
    process: { shell: false, spawn: ['shortcuts', 'open'] },
    filesystem: [`write:${tmpdir()}`]
  },

  destructive: false,
  statusMessage: 'Running shortcut...',

  async handler(args): Promise<ToolResult> {
    if (platform() !== 'darwin') {
      return 'The run_shortcut tool is only available on macOS.'
    }

    const action = (args.action as string) || 'list'
    console.log('[run_shortcut] action:', action, 'args:', JSON.stringify(args))

    if (action === 'list') {
      return await listShortcuts()
    } else if (action === 'search') {
      const query = args.query as string
      if (!query) return 'Please provide a "query" parameter for the search action.'
      return await searchShortcuts(query)
    } else if (action === 'run') {
      const name = args.name as string
      if (!name) return 'Please provide a "name" parameter for the run action.'
      const input = args.input as string | undefined
      return await runShortcut(name, input)
    } else if (action === 'create') {
      const name = args.name as string
      if (!name) return 'Please provide a "name" parameter for the create action.'
      let actions: unknown[]
      const raw = args.actions
      if (typeof raw === 'string') {
        try { actions = JSON.parse(raw) } catch { return 'Invalid "actions" JSON string. Provide a valid JSON array.' }
      } else if (Array.isArray(raw)) {
        actions = raw
      } else {
        return 'Please provide an "actions" parameter (JSON array string) for the create action. Available templates: ' +
          Object.keys(ACTION_TEMPLATES).join(', ')
      }
      if (!Array.isArray(actions) || actions.length === 0) {
        return 'Please provide a non-empty actions array. Available templates: ' +
          Object.keys(ACTION_TEMPLATES).join(', ')
      }
      return await createShortcut(name, actions)
    }

    return `Unknown action "${action}". Use "run", "list", "search", or "create".`
  }
}
