/**
 * MiniClaws System API — core OS capabilities for tool creators.
 *
 * Built-in and third-party tools import these functions instead of
 * accessing Electron / Node APIs directly.  Each function is
 * permission-gated via the tool's declared permissions.
 *
 * Currently implemented:
 *   - captureScreen()       (system.screen)
 *   - getLocation()         (network — IP-based, no permissions)
 *   - fetchPageContent()    (network — headless page reader)
 *   - screenshotPage()      (network — headless page screenshot)
 *
 * Future:
 *   - clipboard.read / clipboard.write  (system.clipboard)
 *   - notify                            (system.notifications)
 *   - filePicker                        (system.filePicker)
 *   - shell.exec                        (process.shell)
 */

import { desktopCapturer, BrowserWindow, shell, net } from 'electron'
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

// ── Geolocation (IP-based) ────────────────────────────────

export interface LocationResult {
  lat: number
  lon: number
  city: string
  region: string
  country: string
  /** Human-readable label, e.g. "San Francisco, CA, US" */
  label: string
}

/** Cached location — refreshed at most once per hour. */
let _cachedLocation: { result: LocationResult; timestamp: number } | null = null
const LOCATION_CACHE_MS = 60 * 60 * 1000 // 1 hour

/**
 * Get the user's approximate location via IP geolocation.
 * No permissions required — uses free ip-api.com service.
 * Returns city-level accuracy (good enough for "near me" queries).
 * Results are cached for 1 hour.
 */
export async function getLocation(): Promise<LocationResult> {
  // Return cached result if fresh
  if (_cachedLocation && Date.now() - _cachedLocation.timestamp < LOCATION_CACHE_MS) {
    return _cachedLocation.result
  }

  const result = await fetchLocation()
  _cachedLocation = { result, timestamp: Date.now() }
  return result
}

async function fetchLocation(): Promise<LocationResult> {
  // Try ip-api.com first (free, no key, 45 req/min)
  try {
    const data = await httpGetJson('http://ip-api.com/json/?fields=status,city,regionName,country,countryCode,lat,lon')
    if (data.status === 'success') {
      return {
        lat: data.lat,
        lon: data.lon,
        city: data.city || '',
        region: data.regionName || '',
        country: data.countryCode || data.country || '',
        label: [data.city, data.regionName, data.countryCode].filter(Boolean).join(', ')
      }
    }
  } catch {
    // fall through to backup
  }

  // Fallback: ipinfo.io (free, no key, 50k/month)
  try {
    const data = await httpGetJson('https://ipinfo.io/json')
    const [lat, lon] = (data.loc || '0,0').split(',').map(Number)
    return {
      lat,
      lon,
      city: data.city || '',
      region: data.region || '',
      country: data.country || '',
      label: [data.city, data.region, data.country].filter(Boolean).join(', ')
    }
  } catch {
    throw new Error('LOCATION_UNAVAILABLE')
  }
}

// ── Web page reading & screenshot ─────────────────────────

export interface PageContentResult {
  url: string
  title: string
  text: string
  /** Whether the text was truncated to fit context limits. */
  truncated: boolean
}

export interface PageScreenshotResult extends CaptureResult {
  url: string
  title: string
}

export interface FetchPageOptions {
  /** Max characters to return (default 4000). */
  maxChars?: number
  /** Timeout in ms (default 12000). */
  timeout?: number
}

/**
 * Load a URL in a hidden BrowserWindow, wait for it to render,
 * and extract the readable text content.
 */
export async function fetchPageContent(
  url: string,
  options?: FetchPageOptions
): Promise<PageContentResult> {
  const maxChars = options?.maxChars ?? 4000
  const timeout = options?.timeout ?? 12000

  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    show: false,
    webPreferences: {
      offscreen: true,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  try {
    await Promise.race([
      win.loadURL(url),
      sleep(timeout).then(() => { throw new Error('PAGE_TIMEOUT') })
    ])

    // Give JS-rendered pages a moment to hydrate
    await sleep(1500)

    const title: string = await win.webContents.executeJavaScript('document.title') || ''

    // Extract readable text — strip nav, footer, script, style, etc.
    const rawText: string = await win.webContents.executeJavaScript(`
      (function() {
        // Remove noisy elements
        const remove = ['script', 'style', 'nav', 'footer', 'header',
          'iframe', 'noscript', 'svg', '[role="navigation"]',
          '[role="banner"]', '[role="contentinfo"]', '.cookie-banner',
          '.cookie-consent', '#cookie-banner', '.nav', '.footer',
          '.sidebar', '.ad', '.advertisement'];
        remove.forEach(sel => {
          document.querySelectorAll(sel).forEach(el => el.remove());
        });

        // Try to find main content area
        const main = document.querySelector('main, article, [role="main"], .content, .post, .entry')
          || document.body;
        return main.innerText || '';
      })()
    `)

    // Clean up whitespace: collapse multiple newlines, trim lines
    const cleaned = rawText
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0)
      .join('\n')

    const truncated = cleaned.length > maxChars
    const text = truncated ? cleaned.slice(0, maxChars) + '\n\n[...content truncated]' : cleaned

    return { url, title, text, truncated }
  } finally {
    win.destroy()
  }
}

/**
 * Load a URL in a hidden BrowserWindow and take a screenshot of the page.
 * Returns JPEG base64 at the specified quality.
 */
export async function screenshotPage(
  url: string,
  options?: CaptureOptions & { timeout?: number }
): Promise<PageScreenshotResult> {
  const maxWidth = options?.maxWidth ?? 1280
  const quality = options?.quality ?? 75
  const timeout = options?.timeout ?? 15000

  const win = new BrowserWindow({
    width: maxWidth,
    height: 900,
    show: false,
    webPreferences: {
      offscreen: true,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  try {
    await Promise.race([
      win.loadURL(url),
      sleep(timeout).then(() => { throw new Error('PAGE_TIMEOUT') })
    ])

    // Wait for page to render fully
    await sleep(2000)

    const title: string = await win.webContents.executeJavaScript('document.title') || ''
    const image = await win.webContents.capturePage()
    const jpeg = image.toJPEG(quality)
    const size = image.getSize()

    return {
      url,
      title,
      base64: jpeg.toString('base64'),
      mimeType: 'image/jpeg',
      width: size.width,
      height: size.height
    }
  } finally {
    win.destroy()
  }
}

/** Simple HTTP GET → JSON helper using Electron's net module. */
function httpGetJson(url: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const request = net.request(url)
    let body = ''

    request.on('response', (response) => {
      response.on('data', (chunk) => { body += chunk.toString() })
      response.on('end', () => {
        try {
          resolve(JSON.parse(body))
        } catch {
          reject(new Error('Invalid JSON response'))
        }
      })
    })

    request.on('error', reject)
    request.end()
  })
}
