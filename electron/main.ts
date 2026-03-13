import { app, BrowserWindow, ipcMain, shell, screen, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { setupAIHandlers } from './ipc/ai'
import { initToolRegistry } from './ipc/tool-registry'
import { webSearchTool } from './ipc/tools/web-search.tool'
import { openAppTool } from './ipc/tools/open-app.tool'
import { seeScreenTool } from './ipc/tools/see-screen.tool'
import { setMainWindow } from './ipc/system-api'

let mainWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
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

  // Allow clicking through transparent areas
  mainWindow.setIgnoreMouseEvents(false)

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

  // IPC: drag the frameless window
  ipcMain.on('window-drag-start', () => {
    // handled via CSS -webkit-app-region: drag on the character
  })

  // IPC: move window to a position
  ipcMain.on('move-window', (_e, { x, y }: { x: number; y: number }) => {
    mainWindow?.setPosition(Math.round(x), Math.round(y), true)
  })

  // IPC: get window position
  ipcMain.handle('get-window-pos', () => mainWindow?.getPosition())

  // IPC: get screen size
  ipcMain.handle('get-screen-size', () => {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    return { width, height }
  })

  // IPC: open settings in separate window
  ipcMain.on('open-settings', () => {
    openSettingsWindow()
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

app.whenReady().then(() => {
  // Initialize tool registry and register built-in tools
  const registry = initToolRegistry()
  registry.register(webSearchTool)
  registry.register(openAppTool)
  registry.register(seeScreenTool)

  setupAIHandlers()
  createWindow()
  setMainWindow(mainWindow)
  createTray()

  app.on('activate', () => {
    if (mainWindow && !mainWindow.isVisible()) {
      restoreWindow()
    } else if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
