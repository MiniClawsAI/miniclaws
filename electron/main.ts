import { app, BrowserWindow, ipcMain, shell, screen, Tray, Menu, nativeImage, dialog, protocol, net, globalShortcut } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { is } from '@electron-toolkit/utils'
import { setupAIHandlers } from './ipc/ai'
import { initToolRegistry } from './ipc/tool-registry'
import { webSearchTool } from './ipc/tools/web-search.tool'
import { openAppTool } from './ipc/tools/open-app.tool'
import { seeScreenTool } from './ipc/tools/see-screen.tool'
import { mapsTool } from './ipc/tools/maps.tool'
import { browseTool } from './ipc/tools/browse.tool'
import { setMainWindow } from './ipc/system-api'

let mainWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let editorWindow: BrowserWindow | null = null
let tray: Tray | null = null

function createWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: 300,
    height: 460,
    x: width - 360,
    y: height - 500,

    // ── Floating character window ──────────────────────────
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,

    // macOS: float above fullscreen apps
    ...(process.platform === 'darwin' && { type: 'panel' }),

    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Stay on top across all virtual desktops / spaces
  mainWindow.setAlwaysOnTop(true, 'screen-saver')
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // macOS: hide from dock (it's a desktop widget, not a regular app)
  if (process.platform === 'darwin') {
    app.dock?.hide()
  }

  // Default: click-through transparent areas; renderer toggles on mouseenter/leave
  mainWindow.setIgnoreMouseEvents(true, { forward: true })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // IPC: toggle click-through for transparent areas
  ipcMain.on('set-ignore-mouse', (_e, ignore: boolean) => {
    mainWindow?.setIgnoreMouseEvents(ignore, { forward: true })
  })

  // IPC: smooth drag — recursive setTimeout + time-based exponential smoothing
  let dragging = false
  let dragOffset = { dx: 0, dy: 0 }
  let currentPos = { x: 0, y: 0 }
  let lastDragTime = 0
  let dragTimer: ReturnType<typeof setTimeout> | null = null

  const DRAG_SMOOTHING = 10 // higher = snappier, lower = more floaty

  function animateDrag() {
    if (!dragging || !mainWindow) return

    const now = Date.now()
    const dt = Math.min((now - lastDragTime) / 1000, 0.05) // cap at 50ms to prevent jumps
    lastDragTime = now

    const cursor = screen.getCursorScreenPoint()
    const targetX = cursor.x + dragOffset.dx
    const targetY = cursor.y + dragOffset.dy

    // Time-based exponential smoothing — consistent regardless of frame timing
    const t = 1 - Math.exp(-DRAG_SMOOTHING * dt)
    currentPos.x += (targetX - currentPos.x) * t
    currentPos.y += (targetY - currentPos.y) * t

    const rx = Math.round(currentPos.x)
    const ry = Math.round(currentPos.y)

    mainWindow.setPosition(rx, ry, false)

    // Schedule next frame only after this one completes (prevents pile-up)
    dragTimer = setTimeout(animateDrag, 16)
  }

  ipcMain.on('drag-start', (_e, { screenX, screenY }: { screenX: number; screenY: number }) => {
    if (!mainWindow || dragging) return
    const [wx, wy] = mainWindow.getPosition()
    dragOffset = { dx: wx - screenX, dy: wy - screenY }
    currentPos = { x: wx, y: wy }
    lastDragTime = Date.now()
    dragging = true
    animateDrag()
  })

  ipcMain.on('drag-stop', () => {
    dragging = false
    if (dragTimer) {
      clearTimeout(dragTimer)
      dragTimer = null
    }
    // Snap to final cursor position
    if (mainWindow) {
      const cursor = screen.getCursorScreenPoint()
      mainWindow.setPosition(
        Math.round(cursor.x + dragOffset.dx),
        Math.round(cursor.y + dragOffset.dy),
        false
      )
    }
  })

  // IPC: get screen size
  ipcMain.handle('get-screen-size', () => {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    return { width, height }
  })

  // IPC: open external URL in default browser
  ipcMain.on('open-external', (_e, url: string) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      shell.openExternal(url)
    }
  })

  // IPC: open 3D model file dialog
  ipcMain.handle('dialog:open-model', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import 3D Model',
      filters: [
        { name: '3D Models', extensions: ['vrm', 'fbx', 'glb', 'gltf'] }
      ],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // IPC: character right-click context menu
  ipcMain.handle('character:context-menu', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null

    return new Promise<'editor' | 'reset' | null>((resolve) => {
      let resolved = false
      const done = (val: 'editor' | 'reset' | null) => {
        if (resolved) return
        resolved = true
        resolve(val)
      }
      const menu = Menu.buildFromTemplate([
        {
          label: 'Character Editor…',
          click: () => {
            openEditorWindow()
            done(null)
          }
        },
        {
          label: 'Reset to Default Character',
          click: () => done('reset')
        }
      ])
      menu.popup({
        window: win,
        callback: () => {
          // Called after menu is closed — delay to let click fire first
          setTimeout(() => done(null), 200)
        }
      })
    })
  })

  // IPC: open settings in separate window
  ipcMain.on('open-settings', () => {
    openSettingsWindow()
  })

  // IPC: use character from editor — forward model path to main window
  ipcMain.on('character:use-model', (_e, path: string) => {
    mainWindow?.webContents.send('use-character', path)
  })

  // IPC: minimize — fade out then hide
  ipcMain.on('minimize-window', () => {
    if (!mainWindow) return
    fadeWindow(mainWindow, 1, 0, 250, () => {
      mainWindow?.hide()
      if (process.platform === 'darwin') app.dock?.show()
    })
  })
}

function restoreWindow(): void {
  if (!mainWindow) return
  mainWindow.setOpacity(0)
  mainWindow.webContents.send('suppress-hover', true)
  mainWindow.show()
  if (process.platform === 'darwin') app.dock?.hide()
  fadeWindow(mainWindow, 0, 1, 250, () => {
    mainWindow?.webContents.send('suppress-hover', false)
  })
}

// Smooth fade helper — steps opacity from→to over duration ms
function fadeWindow(
  win: BrowserWindow,
  from: number,
  to: number,
  duration: number,
  onDone?: () => void
): void {
  const steps = 15
  const stepTime = duration / steps
  const delta = (to - from) / steps
  let current = from
  let step = 0

  const interval = setInterval(() => {
    step++
    current += delta
    win.setOpacity(Math.max(0, Math.min(1, current)))
    if (step >= steps) {
      clearInterval(interval)
      win.setOpacity(to)
      onDone?.()
    }
  }, stepTime)
}

function openSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return
  }

  const settingsIcon = nativeImage.createFromPath(join(__dirname, '../../resources/icon.png'))
  settingsWindow = new BrowserWindow({
    width: 420,
    height: 580,
    resizable: false,
    frame: true,
    transparent: false,
    title: 'MiniClaws Settings',
    icon: settingsIcon,
    backgroundColor: '#16142a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Remove menu bar on Windows/Linux
  settingsWindow.setMenuBarVisibility(false)

  // Enable right-click context menu (copy/paste) for input fields
  settingsWindow.webContents.on('context-menu', (_e, params) => {
    Menu.buildFromTemplate([
      { role: 'cut', enabled: params.editFlags.canCut },
      { role: 'copy', enabled: params.editFlags.canCopy },
      { role: 'paste', enabled: params.editFlags.canPaste },
      { type: 'separator' },
      { role: 'selectAll', enabled: params.editFlags.canSelectAll }
    ]).popup({ window: settingsWindow! })
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    settingsWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?page=settings`)
  } else {
    settingsWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { page: 'settings' }
    })
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null
    // Notify main window that settings may have changed
    mainWindow?.webContents.send('settings-changed')
  })
}

function openEditorWindow(): void {
  if (editorWindow && !editorWindow.isDestroyed()) {
    editorWindow.focus()
    return
  }

  const editorIcon = nativeImage.createFromPath(join(__dirname, '../../resources/icon.png'))
  editorWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    resizable: true,
    frame: true,
    transparent: false,
    title: 'MiniClaws Character Editor',
    icon: editorIcon,
    backgroundColor: '#080b10',
    webPreferences: {
      preload: join(__dirname, '../preload/editor-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  editorWindow.setMenuBarVisibility(false)
  editorWindow.loadFile(join(__dirname, '../../resources/editor/vrm-viewer.html'))

  editorWindow.on('closed', () => {
    editorWindow = null
  })
}

function createTray(): void {
  // Use the lobster icon from resources
  const iconPath = join(__dirname, '../../resources/icon.png')
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })

  tray = new Tray(trayIcon)
  tray.setToolTip('MiniClaws')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show MiniClaws',
      click: () => restoreWindow()
    },
    {
      label: 'Character Editor',
      click: () => openEditorWindow()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])
  tray.setContextMenu(contextMenu)

  // Click tray icon to restore window
  tray.on('click', () => restoreWindow())
}

// Register custom protocol for loading local 3D model files
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-model', privileges: { bypassCSP: true, supportFetchAPI: true, stream: true } }
])

app.whenReady().then(() => {
  // Handle local-model:// protocol — serves local files safely
  protocol.handle('local-model', (request) => {
    // URL comes in as local-model:///absolute/path/to/file.fbx
    const filePath = decodeURIComponent(request.url.replace('local-model://', ''))
    return net.fetch(pathToFileURL(filePath).href)
  })

  // Initialize tool registry and register built-in tools
  const registry = initToolRegistry()
  registry.register(webSearchTool)
  registry.register(openAppTool)
  registry.register(seeScreenTool)
  registry.register(mapsTool)
  registry.register(browseTool)

  setupAIHandlers()
  createWindow()
  setMainWindow(mainWindow)
  createTray()

  // Global shortcut: Cmd+Shift+M (macOS) / Ctrl+Shift+M (Win/Linux)
  globalShortcut.register('CommandOrControl+Shift+M', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.show()
    mainWindow.focus()
    mainWindow.webContents.send('focus-chat-input')
  })

  app.on('activate', () => {
    if (mainWindow && !mainWindow.isVisible()) {
      restoreWindow()
    } else if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
