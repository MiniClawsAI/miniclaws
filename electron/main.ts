import { app, BrowserWindow, ipcMain, shell, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { setupAIHandlers } from './ipc/ai'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: 420,
    height: 600,
    x: width - 460,
    y: height - 640,

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
}

app.whenReady().then(() => {
  setupAIHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
