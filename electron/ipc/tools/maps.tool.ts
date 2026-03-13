import { exec } from 'child_process'
import { promisify } from 'util'
import { platform } from 'os'
import { shell } from 'electron'
import type { RegisteredTool } from '../tool-registry'
import { getLocation } from '../system-api'

const execAsync = promisify(exec)

// ── Maps provider URL templates ─────────────────────────────
// {query} is replaced with the encoded search query

const BROWSER_PROVIDERS: Record<string, string> = {
  google: 'https://www.google.com/maps/search/{query}',
  waze: 'https://www.waze.com/ul?q={query}&navigate=yes',
  openstreetmap: 'https://www.openstreetmap.org/search?query={query}',
  bing: 'https://www.bing.com/maps?q={query}'
}

// ── Native app detection per platform ───────────────────────

interface NativeMapApp {
  name: string
  /** Check if the app exists. */
  detect: () => Promise<boolean>
  /** Open the app with a search query. */
  open: (query: string) => Promise<void>
}

function getNativeApps(): NativeMapApp[] {
  const plat = platform()

  if (plat === 'darwin') {
    return [
      {
        name: 'Apple Maps',
        detect: async () => {
          try {
            await execAsync('test -d "/System/Applications/Maps.app"')
            return true
          } catch {
            return false
          }
        },
        open: async (query: string) => {
          // maps:// scheme is handled natively by Apple Maps
          await shell.openExternal(`maps://?q=${encodeURIComponent(query)}`)
        }
      },
      {
        name: 'Google Maps (app)',
        detect: async () => {
          try {
            const { stdout } = await execAsync(
              'mdfind "kMDItemKind == \'Application\'" -name "Google Maps" 2>/dev/null'
            )
            return stdout.trim().length > 0
          } catch {
            return false
          }
        },
        open: async (query: string) => {
          await execAsync(`open -a "Google Maps" "comgooglemaps://?q=${encodeURIComponent(query)}"`)
        }
      },
      {
        name: 'Waze',
        detect: async () => {
          try {
            const { stdout } = await execAsync(
              'mdfind "kMDItemKind == \'Application\'" -name "Waze" 2>/dev/null'
            )
            return stdout.trim().length > 0
          } catch {
            return false
          }
        },
        open: async (query: string) => {
          await execAsync(`open -a "Waze" "waze://?q=${encodeURIComponent(query)}"`)
        }
      }
    ]
  }

  if (plat === 'win32') {
    return [
      {
        name: 'Windows Maps',
        detect: async () => {
          try {
            // Check if the Maps UWP app is installed
            await execAsync(
              'powershell -Command "Get-AppxPackage -Name *WindowsMaps*"',
              { shell: 'cmd.exe' }
            )
            return true
          } catch {
            return false
          }
        },
        open: async (query: string) => {
          // bingmaps: URI scheme opens Windows Maps
          await shell.openExternal(`bingmaps:?q=${encodeURIComponent(query)}`)
        }
      }
    ]
  }

  // Linux: GNOME Maps
  if (plat === 'linux') {
    return [
      {
        name: 'GNOME Maps',
        detect: async () => {
          try {
            await execAsync('which gnome-maps 2>/dev/null')
            return true
          } catch {
            return false
          }
        },
        open: async (query: string) => {
          exec(`gnome-maps "geo:0,0?q=${encodeURIComponent(query)}" &`)
        }
      }
    ]
  }

  return []
}

// ── Detect available native apps (cached per session) ───────

let cachedNativeApps: { name: string; app: NativeMapApp }[] | null = null

async function getAvailableNativeApps(): Promise<{ name: string; app: NativeMapApp }[]> {
  if (cachedNativeApps) return cachedNativeApps

  const apps = getNativeApps()
  const results: { name: string; app: NativeMapApp }[] = []

  for (const app of apps) {
    try {
      if (await app.detect()) {
        results.push({ name: app.name, app })
      }
    } catch {
      // skip
    }
  }

  cachedNativeApps = results
  return results
}

// ── The tool ────────────────────────────────────────────────

export const mapsTool: RegisteredTool = {
  name: 'maps',
  version: '1.0.0',
  description:
    'Search for a location, address, or place on a map. ' +
    'Opens the user\'s preferred maps app (native app if available, otherwise browser). ' +
    'Use for directions, finding places, restaurants, addresses, etc.',

  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'The search query — a place name, address, or search like "coffee shops near Central Park"'
      }
    },
    required: ['query']
  },

  permissions: {
    process: { shell: false, spawn: ['open', 'mdfind', 'which', 'gnome-maps', 'powershell'] },
    network: ['maps.google.com', 'maps.apple.com', 'waze.com', 'openstreetmap.org', 'ip-api.com', 'ipinfo.io'],
    system: {}
  },

  destructive: false,
  statusMessage: 'Opening maps...',

  async handler(args, context): Promise<string> {
    const rawQuery = (args.query as string || '').trim()
    if (!rawQuery) return 'No location or search query provided.'

    // Read user preference from context (set by ai.ts from AIConfig)
    const preference = (context.config?.mapsProvider as string) || 'auto'

    // Auto-enrich vague "near me" queries with the user's location
    let query = rawQuery
    let locationNote = ''
    const isLocalQuery = /\bnear\s*(me|by|here)\b|\bnearby\b|\baround\s*(me|here)\b|\bclose\s*by\b/i.test(rawQuery)

    if (isLocalQuery) {
      try {
        const loc = await getLocation()
        // Append city to the query so maps providers can resolve it
        if (!rawQuery.toLowerCase().includes(loc.city.toLowerCase())) {
          query = `${rawQuery} near ${loc.city}, ${loc.region}`
        }
        locationNote = ` (detected location: ${loc.label})`
      } catch {
        // Location unavailable — use query as-is, maps providers will handle it
        console.warn('[maps] Could not get location for "near me" query')
      }
    }

    console.log(`[maps] query="${query}" preference="${preference}"${locationNote}`)

    // ── "auto" mode: try native apps first, then fall back to Google in browser
    if (preference === 'auto') {
      const nativeApps = await getAvailableNativeApps()
      if (nativeApps.length > 0) {
        const best = nativeApps[0]
        try {
          await best.app.open(query)
          return `Opened "${rawQuery}" in ${best.name}.${locationNote}`
        } catch (err) {
          console.warn(`[maps] Native app ${best.name} failed, falling back to browser`, err)
        }
      }
      // Fallback to Google Maps in browser
      const url = BROWSER_PROVIDERS.google.replace('{query}', encodeURIComponent(query))
      await shell.openExternal(url)
      return `Opened "${rawQuery}" in Google Maps (browser).${locationNote}`
    }

    // ── Explicit native app preference
    if (preference === 'apple_maps' || preference === 'windows_maps' || preference === 'gnome_maps') {
      const nativeApps = await getAvailableNativeApps()
      const targetName =
        preference === 'apple_maps' ? 'Apple Maps'
        : preference === 'windows_maps' ? 'Windows Maps'
        : 'GNOME Maps'

      const found = nativeApps.find((a) => a.name === targetName)
      if (found) {
        try {
          await found.app.open(query)
          return `Opened "${rawQuery}" in ${found.name}.${locationNote}`
        } catch {
          // Fall through to browser
        }
      }
      // Native app not available — fall back to browser
      const url = BROWSER_PROVIDERS.google.replace('{query}', encodeURIComponent(query))
      await shell.openExternal(url)
      return `${targetName} is not available — opened "${rawQuery}" in Google Maps (browser) instead.${locationNote}`
    }

    // ── Browser-based provider
    const template = BROWSER_PROVIDERS[preference] || BROWSER_PROVIDERS.google
    const url = template.replace('{query}', encodeURIComponent(query))
    await shell.openExternal(url)

    const providerLabel =
      preference === 'google' ? 'Google Maps'
      : preference === 'waze' ? 'Waze'
      : preference === 'openstreetmap' ? 'OpenStreetMap'
      : preference === 'bing' ? 'Bing Maps'
      : 'Google Maps'

    return `Opened "${rawQuery}" in ${providerLabel}.${locationNote}`
  }
}
