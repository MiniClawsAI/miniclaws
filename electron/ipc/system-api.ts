/**
 * MiniClaws System API — core OS capabilities for tool creators.
 *
 * Built-in and third-party tools import these functions instead of
 * accessing Electron / Node APIs directly.  Each function is
 * permission-gated via the tool's declared permissions.
 *
 * Currently implemented:
 *   - captureScreen()   (system.screen)
 *
 * Future:
 *   - clipboard.read / clipboard.write  (system.clipboard)
 *   - notify                            (system.notifications)
 *   - filePicker                        (system.filePicker)
 *   - shell.exec                        (process.shell)
 */

import { desktopCapturer, BrowserWindow, shell } from 'electron'
import { exec } from 'child_process'

// ── Types ──────────────────────────────────────────────────

export interface CaptureResult {
  base64: string
  mimeType: 'image/jpeg' | 'image/png'
  width: number
  height: number
}

export interface CaptureOptions {
  /** Max width in pixels (default 1280). Image is scaled proportionally. */
  maxWidth?: number
  /** JPEG quality 1-100 (default 80). Ignored for PNG. */
  quality?: number
}

// ── Window reference ───────────────────────────────────────
// Set once from main.ts so the API can hide the companion
// window during screen capture.

let _mainWindow: BrowserWindow | null = null

export function setMainWindow(win: BrowserWindow | null): void {
  _mainWindow = win
}

export function getMainWindow(): BrowserWindow | null {
  return _mainWindow
}

// ── Privacy settings opener ────────────────────────────────

/**
 * Open the OS-specific screen recording / privacy settings pane.
 * - macOS: System Settings → Privacy & Security → Screen Recording
 * - Windows: Settings → Privacy → App permissions (no direct deep-link for screen capture)
 * - Linux: best-effort — no standard location
 */
export function openScreenPermissionSettings(): void {
  const platform = process.platform

  if (platform === 'darwin') {
    // Deep-link directly into Screen Recording pane
    shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
    )
  } else if (platform === 'win32') {
    // Windows 10/11 — open Privacy settings; no screen-capture-specific deep link
    exec('start ms-settings:privacy-graphicscaptureprogrammatic', { shell: true })
  } else {
    // Linux — no universal settings pane; open a helpful URL instead
    shell.openExternal(
      'https://github.com/nickmomrik/miniclaws#screen-capture-permissions'
    )
  }
}

// ── Screen capture ─────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function captureScreen(
  options?: CaptureOptions
): Promise<CaptureResult> {
  const maxWidth = options?.maxWidth ?? 1280
  const quality = options?.quality ?? 80

  const win = _mainWindow
  const wasVisible = win && !win.isDestroyed() && win.isVisible()

  try {
    // Hide MiniClaws so it doesn't appear in its own screenshot.
    // Use setOpacity(0) instead of hide() to avoid triggering
    // macOS dock show/hide behaviour.
    if (wasVisible && win) {
      win.setOpacity(0)
      await sleep(120) // let the compositor remove the window
    }

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: maxWidth, height: Math.round(maxWidth * 0.75) }
    })

    if (!sources || sources.length === 0) {
      openScreenPermissionSettings()
      throw new Error('PERMISSION_DENIED')
    }

    // Capture the primary display (first source)
    const source = sources[0]
    const thumbnail = source.thumbnail

    if (thumbnail.isEmpty()) {
      openScreenPermissionSettings()
      throw new Error('PERMISSION_DENIED')
    }

    const jpeg = thumbnail.toJPEG(quality)
    const size = thumbnail.getSize()

    return {
      base64: jpeg.toString('base64'),
      mimeType: 'image/jpeg',
      width: size.width,
      height: size.height
    }
  } finally {
    // Always restore the window, even if capture failed
    if (wasVisible && win && !win.isDestroyed()) {
      win.setOpacity(1)
    }
  }
}
