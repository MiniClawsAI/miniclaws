import { exec } from 'child_process'
import { promisify } from 'util'
import { platform } from 'os'
import { shell } from 'electron'
import type { RegisteredTool } from '../tool-registry'

const execAsync = promisify(exec)

// ── Common aliases so the LLM doesn't have to guess exact names ──

const APP_ALIASES: Record<string, Record<string, string>> = {
  darwin: {
    chrome: 'Google Chrome',
    firefox: 'Firefox',
    safari: 'Safari',
    code: 'Visual Studio Code',
    vscode: 'Visual Studio Code',
    terminal: 'Terminal',
    iterm: 'iTerm',
    iterm2: 'iTerm',
    slack: 'Slack',
    discord: 'Discord',
    spotify: 'Spotify',
    finder: 'Finder',
    mail: 'Mail',
    notes: 'Notes',
    calendar: 'Calendar',
    photos: 'Photos',
    music: 'Music',
    maps: 'Maps',
    messages: 'Messages',
    facetime: 'FaceTime',
    preview: 'Preview',
    textedit: 'TextEdit',
    calculator: 'Calculator',
    'activity monitor': 'Activity Monitor',
    'system preferences': 'System Preferences',
    'system settings': 'System Settings',
    settings: 'System Settings',
    xcode: 'Xcode',
    figma: 'Figma',
    sketch: 'Sketch',
    notion: 'Notion',
    obsidian: 'Obsidian',
    zoom: 'zoom.us',
    teams: 'Microsoft Teams',
    word: 'Microsoft Word',
    excel: 'Microsoft Excel',
    powerpoint: 'Microsoft PowerPoint',
    outlook: 'Microsoft Outlook',
    telegram: 'Telegram',
    whatsapp: 'WhatsApp',
    brave: 'Brave Browser',
    arc: 'Arc',
    warp: 'Warp',
    cursor: 'Cursor',
    webstorm: 'WebStorm',
    intellij: 'IntelliJ IDEA',
    pycharm: 'PyCharm',
    docker: 'Docker',
    postman: 'Postman',
    insomnia: 'Insomnia',
    tableplus: 'TablePlus',
    gimp: 'GIMP',
    vlc: 'VLC',
    handbrake: 'HandBrake',
    audacity: 'Audacity',
    blender: 'Blender',
    unity: 'Unity Hub',
    steam: 'Steam'
  },
  win32: {
    chrome: 'chrome',
    firefox: 'firefox',
    code: 'code',
    vscode: 'code',
    notepad: 'notepad',
    calculator: 'calc',
    explorer: 'explorer',
    cmd: 'cmd',
    powershell: 'powershell',
    terminal: 'wt',
    slack: 'slack',
    discord: 'discord',
    spotify: 'spotify',
    word: 'winword',
    excel: 'excel',
    powerpoint: 'powerpnt',
    outlook: 'outlook',
    teams: 'teams'
  },
  linux: {
    chrome: 'google-chrome',
    firefox: 'firefox',
    code: 'code',
    vscode: 'code',
    terminal: 'gnome-terminal',
    files: 'nautilus',
    slack: 'slack',
    discord: 'discord',
    spotify: 'spotify',
    gimp: 'gimp',
    vlc: 'vlc',
    blender: 'blender',
    steam: 'steam'
  }
}

// ── macOS: App Store URL patterns ──

const MAC_APP_STORE: Record<string, string> = {
  xcode: 'macappstore://apps.apple.com/app/xcode/id497799835',
  slack: 'macappstore://apps.apple.com/app/slack/id803453959',
  telegram: 'macappstore://apps.apple.com/app/telegram/id747648890',
  whatsapp: 'macappstore://apps.apple.com/app/whatsapp-messenger/id310633997',
  notion: 'macappstore://apps.apple.com/app/notion/id1559269364'
}

// ── Platform-specific search & launch ──

async function findAppMac(appName: string): Promise<string | null> {
  try {
    // mdfind is the fastest way to find apps via Spotlight index
    const { stdout } = await execAsync(
      `mdfind "kMDItemKind == 'Application'" -name "${appName.replace(/"/g, '\\"')}" 2>/dev/null`
    )
    const matches = stdout.trim().split('\n').filter(Boolean)
    if (matches.length > 0) return matches[0]

    // Fallback: direct path check for common locations
    const paths = [
      `/Applications/${appName}.app`,
      `/System/Applications/${appName}.app`,
      `${process.env.HOME}/Applications/${appName}.app`
    ]
    for (const p of paths) {
      try {
        await execAsync(`test -d "${p}"`)
        return p
      } catch {
        /* not found */
      }
    }
    return null
  } catch {
    return null
  }
}

async function openAppMac(appName: string): Promise<string> {
  // Try `open -a` first — macOS resolves app names intelligently
  try {
    await execAsync(`open -a "${appName.replace(/"/g, '\\"')}"`)
    return `Opened "${appName}" successfully.`
  } catch {
    // open -a failed, try finding the full path
    const appPath = await findAppMac(appName)
    if (appPath) {
      await execAsync(`open "${appPath.replace(/"/g, '\\"')}"`)
      return `Opened "${appName}" successfully.`
    }
    throw new Error(`not_found`)
  }
}

async function findAppWindows(appName: string): Promise<boolean> {
  try {
    await execAsync(`where ${appName} 2>nul`)
    return true
  } catch {
    return false
  }
}

async function openAppWindows(appName: string): Promise<string> {
  const found = await findAppWindows(appName)
  if (!found) {
    // Try start command which searches Start Menu
    try {
      await execAsync(`start "" "${appName}"`, { shell: 'cmd.exe' })
      return `Opened "${appName}" successfully.`
    } catch {
      throw new Error('not_found')
    }
  }
  await execAsync(`start "" "${appName}"`, { shell: 'cmd.exe' })
  return `Opened "${appName}" successfully.`
}

async function findAppLinux(appName: string): Promise<boolean> {
  try {
    await execAsync(`which ${appName} 2>/dev/null`)
    return true
  } catch {
    return false
  }
}

async function openAppLinux(appName: string): Promise<string> {
  const found = await findAppLinux(appName)
  if (!found) throw new Error('not_found')

  // Launch detached so it doesn't block
  exec(`nohup ${appName} &>/dev/null &`)
  return `Opened "${appName}" successfully.`
}

// ── Resolve alias to real app name ──

function resolveAlias(input: string, plat: string): string {
  const key = input.toLowerCase().trim()
  const aliases = APP_ALIASES[plat] || {}
  return aliases[key] || input
}

// ── Search for apps matching a query (for discovery) ──

async function searchAppsMac(query: string): Promise<string[]> {
  try {
    const { stdout } = await execAsync(
      `mdfind "kMDItemKind == 'Application'" -name "${query.replace(/"/g, '\\"')}" 2>/dev/null`
    )
    return stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .slice(0, 10)
      .map((p) => {
        const match = p.match(/([^/]+)\.app$/)
        return match ? match[1] : p
      })
  } catch {
    return []
  }
}

async function getInstallSuggestion(appName: string, plat: string): Promise<string> {
  const lower = appName.toLowerCase()

  if (plat === 'darwin') {
    // Check if we have an App Store link
    const storeUrl = MAC_APP_STORE[lower]
    if (storeUrl) {
      return `You can install "${appName}" from the Mac App Store. Would you like me to open the App Store page?`
    }

    return (
      `"${appName}" is not installed on this Mac. Common ways to install it:\n` +
      `• Search the Mac App Store\n` +
      `• Download from the app's official website\n` +
      `• Use Homebrew: \`brew install --cask ${lower}\`\n\n` +
      `Would you like me to search the web for how to install "${appName}"?`
    )
  }

  if (plat === 'win32') {
    return (
      `"${appName}" is not installed on this PC. Common ways to install it:\n` +
      `• Search the Microsoft Store\n` +
      `• Download from the app's official website\n` +
      `• Use winget: \`winget install ${lower}\`\n\n` +
      `Would you like me to search the web for how to install "${appName}"?`
    )
  }

  // Linux
  return (
    `"${appName}" is not installed. Common ways to install it:\n` +
    `• apt: \`sudo apt install ${lower}\`\n` +
    `• snap: \`sudo snap install ${lower}\`\n` +
    `• flatpak: \`flatpak install ${lower}\`\n\n` +
    `Would you like me to search the web for how to install "${appName}"?`
  )
}

// ── The tool ─────────────────────────────────────────────────

export const openAppTool: RegisteredTool = {
  name: 'open_app',
  version: '1.0.0',
  description:
    'Open an application on the user\'s computer by name. Can also search for installed apps. ' +
    'Use action "open" to launch an app, or "search" to list matching installed apps. ' +
    'If the app is not found, returns install suggestions the user can follow.',

  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Action to perform: "open" to launch an app, "search" to find matching apps'
      },
      app_name: {
        type: 'string',
        description:
          'The application name (e.g., "Chrome", "Visual Studio Code", "Slack"). ' +
          'Common abbreviations like "code", "vscode", "chrome" are supported.'
      }
    },
    required: ['action', 'app_name']
  },

  permissions: {
    process: { shell: false, spawn: ['open', 'mdfind', 'which', 'xdg-open', 'where', 'start'] },
    system: {}
  },

  destructive: false,
  statusMessage: 'Opening application...',

  async handler(args): Promise<string> {
    const action = (args.action as string) || 'open'
    const rawName = args.app_name as string
    const plat = platform()
    const resolvedName = resolveAlias(rawName, plat)

    console.log(`[open_app] action=${action} raw="${rawName}" resolved="${resolvedName}" platform=${plat}`)

    // ── Search action ──
    if (action === 'search') {
      if (plat === 'darwin') {
        const results = await searchAppsMac(resolvedName)
        if (results.length === 0) {
          return `No installed apps found matching "${rawName}".`
        }
        return `Found ${results.length} installed app(s) matching "${rawName}":\n${results.map((a) => `• ${a}`).join('\n')}`
      }

      // Windows/Linux: basic check
      if (plat === 'win32') {
        const found = await findAppWindows(resolvedName)
        return found
          ? `"${resolvedName}" is available on this system.`
          : `"${resolvedName}" was not found on this system.`
      }

      const found = await findAppLinux(resolvedName)
      return found
        ? `"${resolvedName}" is available on this system.`
        : `"${resolvedName}" was not found on this system.`
    }

    // ── Open action ──
    try {
      if (plat === 'darwin') {
        return await openAppMac(resolvedName)
      } else if (plat === 'win32') {
        return await openAppWindows(resolvedName)
      } else {
        return await openAppLinux(resolvedName)
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'not_found') {
        // App not found — return install suggestions for the LLM to relay
        const suggestion = await getInstallSuggestion(rawName, plat)

        // Also check if there are similar apps installed (macOS only)
        if (plat === 'darwin') {
          const similar = await searchAppsMac(rawName)
          if (similar.length > 0) {
            return (
              `"${rawName}" was not found, but these similar apps are installed:\n` +
              similar.map((a) => `• ${a}`).join('\n') +
              `\n\nDid you mean one of these?\n\n` +
              `If not: ${suggestion}`
            )
          }
        }

        return suggestion
      }
      return `Failed to open "${rawName}": ${err instanceof Error ? err.message : String(err)}`
    }
  }
}
