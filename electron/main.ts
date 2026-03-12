import { app, BrowserWindow, ipcMain, shell, screen, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { setupAIHandlers } from './ipc/ai'

let mainWindow: BrowserWindow | null = null
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

function createTray(): void {
  // Create a small 16x16 tray icon (circle)
  const icon = nativeImage.createEmpty()
  const size = 16
  const canvas = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - size / 2
      const dy = y - size / 2
      const dist = Math.sqrt(dx * dx + dy * dy)
      const idx = (y * size + x) * 4
      if (dist <= size / 2 - 1) {
        canvas[idx] = 167     // R
        canvas[idx + 1] = 139 // G
        canvas[idx + 2] = 250 // B
        canvas[idx + 3] = 255 // A
      }
    }
  }
  const trayIcon = nativeImage.createFromBuffer(canvas, { width: size, height: size })

  tray = new Tray(trayIcon)
  tray.setToolTip('Companion')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Companion',
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
  setupAIHandlers()
  createWindow()
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
