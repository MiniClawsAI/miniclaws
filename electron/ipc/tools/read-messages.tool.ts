import { platform } from 'os'
import { existsSync } from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'
import type { RegisteredTool, ToolResult, ToolImageResult } from '../tool-registry'
import { captureScreen } from '../system-api'

const execAsync = promisify(exec)

// Core Data epoch offset: seconds between Unix epoch (1970) and Apple epoch (2001)
const CORE_DATA_EPOCH = 978307200

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface MessageRow {
  chat_identifier: string
  display_name: string | null
  contact_id: string | null
  text: string
  is_from_me: number
  message_date: string
}

interface ConversationRow extends MessageRow {
  chat_id: number
  last_message: string
}

function getDbPath(): string {
  return `${process.env.HOME}/Library/Messages/chat.db`
}

function truncate(text: string, max: number): string {
  if (!text || text.length <= max) return text
  return text.slice(0, max) + '…'
}

function formatSender(row: { is_from_me: number; contact_id: string | null }): string {
  return row.is_from_me ? 'Me' : (row.contact_id || 'Unknown')
}

function groupByConversation(rows: MessageRow[]): Map<string, MessageRow[]> {
  const groups = new Map<string, MessageRow[]>()
  for (const row of rows) {
    const key = row.chat_identifier || 'unknown'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(row)
  }
  return groups
}

function formatGroupedMessages(groups: Map<string, MessageRow[]>): string {
  const parts: string[] = []

  for (const [chatId, messages] of groups) {
    const displayName = messages[0]?.display_name
    const header = displayName
      ? `## ${displayName} (${chatId})`
      : `## ${chatId}`

    const lines = messages
      .reverse() // chronological order
      .map((m) => `[${m.message_date}] ${formatSender(m)}: ${truncate(m.text, 200)}`)

    parts.push(`${header}\n${lines.join('\n')}`)
  }

  return parts.join('\n\n')
}

// ── Screenshot-based approach ────────────────────────────────

async function openAndScreenshotMessages(): Promise<ToolImageResult> {
  // Bring Messages app to front (or open it)
  try {
    await execAsync(`open -a "Messages"`)
  } catch {
    throw new Error('Could not open Messages app.')
  }

  // Wait for Messages to come to foreground and render
  await sleep(1500)

  // Capture the screen with Messages in front
  const capture = await captureScreen({ maxWidth: 1920, quality: 85 })

  return {
    type: 'image',
    mimeType: capture.mimeType,
    base64: capture.base64,
    text: 'Screenshot of Messages app. Analyze the visible conversations and messages to answer the user\'s question.'
  }
}

// ── SQLite-based approach (requires Full Disk Access) ─────────

function tryReadDatabase(action: string, query: string | undefined, limit: number, hours: number): string | null {
  const dbPath = getDbPath()
  if (!existsSync(dbPath)) return null

  let Database: typeof import('better-sqlite3')
  try {
    Database = require('better-sqlite3')
  } catch {
    return null
  }

  let db: import('better-sqlite3').Database
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true })
  } catch {
    return null // Permission denied — fall back to screenshot
  }

  try {
    db.pragma('journal_mode = WAL')

    if (action === 'conversations') {
      return getConversations(db, limit)
    } else if (action === 'search') {
      if (!query) return 'Please provide a "query" parameter for the search action.'
      return searchMessages(db, query, limit)
    } else {
      return getRecentMessages(db, hours, limit)
    }
  } catch {
    return null
  } finally {
    db.close()
  }
}

// ── The tool ─────────────────────────────────────────────────

export const readMessagesTool: RegisteredTool = {
  name: 'read_messages',
  version: '1.1.0',
  description:
    'Read iMessage conversations on macOS. Can fetch recent messages, search by keyword, or list conversations. ' +
    'If database access is available (Full Disk Access), returns structured text. ' +
    'Otherwise, opens Messages app and takes a screenshot for visual analysis. macOS only.',

  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description:
          'Action: "recent" for recent messages, "search" to search by keyword, "conversations" to list recent conversations'
      },
      query: {
        type: 'string',
        description: 'Search keyword (required for "search" action)'
      },
      limit: {
        type: 'number',
        description: 'Max messages to return (default 20, max 30). For "conversations" this is number of conversations.'
      },
      hours: {
        type: 'number',
        description: 'For "recent" action: how many hours back to look (default 24, max 168)'
      }
    },
    required: ['action']
  },

  permissions: {
    filesystem: [`read:${process.env.HOME}/Library/Messages/chat.db`],
    process: { shell: false, spawn: ['open'] },
    system: { screen: true }
  },

  destructive: false,
  statusMessage: 'Reading messages...',

  async handler(args): Promise<ToolResult> {
    // Platform guard
    if (platform() !== 'darwin') {
      return 'The read_messages tool is only available on macOS.'
    }

    const action = (args.action as string) || 'recent'
    const query = args.query as string | undefined
    const limit = Math.min(Math.max((args.limit as number) || 20, 1), 30)
    const hours = Math.min(Math.max((args.hours as number) || 24, 1), 168)

    // Try SQLite first (if Full Disk Access is granted) — gives structured data
    const dbResult = tryReadDatabase(action, query, limit, hours)
    if (dbResult) return dbResult

    // Fallback: open Messages app and take a screenshot
    try {
      return await openAndScreenshotMessages()
    } catch (err) {
      return `Failed to read messages: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}

// ── SQLite query functions ───────────────────────────────────

function getConversations(db: import('better-sqlite3').Database, limit: number): string {
  const rows = db.prepare(`
    SELECT
      c.ROWID as chat_id,
      c.chat_identifier,
      c.display_name,
      h.id as contact_id,
      m.text as last_message,
      m.is_from_me,
      datetime(m.date / 1000000000 + ${CORE_DATA_EPOCH}, 'unixepoch', 'localtime') as message_date
    FROM chat c
    LEFT JOIN chat_message_join cmj ON cmj.chat_id = c.ROWID
    LEFT JOIN message m ON m.ROWID = cmj.message_id
    LEFT JOIN chat_handle_join chj ON chj.chat_id = c.ROWID
    LEFT JOIN handle h ON h.ROWID = chj.handle_id
    WHERE m.ROWID = (
      SELECT MAX(cmj2.message_id)
      FROM chat_message_join cmj2
      WHERE cmj2.chat_id = c.ROWID
    )
    AND m.text IS NOT NULL AND m.text != ''
    ORDER BY m.date DESC
    LIMIT ?
  `).all(limit) as ConversationRow[]

  if (rows.length === 0) return 'No conversations found.'

  const lines = rows.map((r) => {
    const name = r.display_name || r.contact_id || r.chat_identifier
    const sender = r.is_from_me ? 'Me' : (r.contact_id || 'Them')
    return `• ${name} [${r.message_date}]\n  ${sender}: ${truncate(r.last_message, 100)}`
  })

  return `Recent conversations (${rows.length}):\n\n${lines.join('\n\n')}`
}

function getRecentMessages(db: import('better-sqlite3').Database, hours: number, limit: number): string {
  const hoursInSeconds = hours * 3600
  const rows = db.prepare(`
    SELECT
      c.chat_identifier,
      c.display_name,
      h.id as contact_id,
      m.text,
      m.is_from_me,
      datetime(m.date / 1000000000 + ${CORE_DATA_EPOCH}, 'unixepoch', 'localtime') as message_date
    FROM message m
    JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
    JOIN chat c ON c.ROWID = cmj.chat_id
    LEFT JOIN handle h ON h.ROWID = m.handle_id
    WHERE m.date > (strftime('%s', 'now') - ${CORE_DATA_EPOCH} - ?) * 1000000000
      AND m.text IS NOT NULL
      AND m.text != ''
    ORDER BY m.date DESC
    LIMIT ?
  `).all(hoursInSeconds, limit) as MessageRow[]

  if (rows.length === 0) return `No messages found in the last ${hours} hour(s).`

  const groups = groupByConversation(rows)
  return `Messages from the last ${hours} hour(s) (${rows.length} total):\n\n${formatGroupedMessages(groups)}`
}

function searchMessages(db: import('better-sqlite3').Database, query: string, limit: number): string {
  const rows = db.prepare(`
    SELECT
      c.chat_identifier,
      c.display_name,
      h.id as contact_id,
      m.text,
      m.is_from_me,
      datetime(m.date / 1000000000 + ${CORE_DATA_EPOCH}, 'unixepoch', 'localtime') as message_date
    FROM message m
    JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
    JOIN chat c ON c.ROWID = cmj.chat_id
    LEFT JOIN handle h ON h.ROWID = m.handle_id
    WHERE m.text LIKE '%' || ? || '%'
      AND m.text IS NOT NULL
    ORDER BY m.date DESC
    LIMIT ?
  `).all(query, limit) as MessageRow[]

  if (rows.length === 0) return `No messages found matching "${query}".`

  const groups = groupByConversation(rows)
  return `Messages matching "${query}" (${rows.length} results):\n\n${formatGroupedMessages(groups)}`
}
