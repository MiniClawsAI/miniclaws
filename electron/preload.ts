import { contextBridge, ipcRenderer } from 'electron'
import type { AIConfig, Message } from '../ipc/ai'

contextBridge.exposeInMainWorld('electron', {
  // ── AI streaming ─────────────────────────────────────────
  chat: (messages: Message[], config: AIConfig) => {
    ipcRenderer.send('ai:chat', { messages, config })
  },
  onChunk: (cb: (chunk: string) => void) => {
    const handler = (_: unknown, chunk: string) => cb(chunk)
    ipcRenderer.on('ai:chunk', handler)
    return () => ipcRenderer.removeListener('ai:chunk', handler)
  },
  onDone: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.once('ai:done', handler)
    return () => ipcRenderer.removeListener('ai:done', handler)
  },
  onError: (cb: (err: string) => void) => {
    const handler = (_: unknown, err: string) => cb(err)
    ipcRenderer.once('ai:error', handler)
    return () => ipcRenderer.removeListener('ai:error', handler)
  },

  // ── Window control ───────────────────────────────────────
  setIgnoreMouse: (ignore: boolean) => {
    ipcRenderer.send('set-ignore-mouse', ignore)
  },
  moveWindow: (x: number, y: number) => {
    ipcRenderer.send('move-window', { x, y })
  },
  getWindowPos: (): Promise<[number, number]> => {
    return ipcRenderer.invoke('get-window-pos')
  },
  getScreenSize: (): Promise<{ width: number; height: number }> => {
    return ipcRenderer.invoke('get-screen-size')
  },
  minimizeWindow: () => {
    ipcRenderer.send('minimize-window')
  },
  openSettings: () => {
    ipcRenderer.send('open-settings')
  },
  onSuppressHover: (cb: (suppress: boolean) => void) => {
    const handler = (_: unknown, suppress: boolean) => cb(suppress)
    ipcRenderer.on('suppress-hover', handler)
    return () => ipcRenderer.removeListener('suppress-hover', handler)
  },
  onToolStatus: (cb: (status: string) => void) => {
    const handler = (_: unknown, status: string) => cb(status)
    ipcRenderer.on('ai:tool_status', handler)
    return () => ipcRenderer.removeListener('ai:tool_status', handler)
  },
  onSettingsChanged: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('settings-changed', handler)
    return () => ipcRenderer.removeListener('settings-changed', handler)
  }
})

// Expose types for renderer
declare global {
  interface Window {
    electron: {
      chat: (messages: Message[], config: AIConfig) => void
      onChunk: (cb: (chunk: string) => void) => () => void
      onDone: (cb: () => void) => () => void
      onError: (cb: (err: string) => void) => () => void
      setIgnoreMouse: (ignore: boolean) => void
      moveWindow: (x: number, y: number) => void
      getWindowPos: () => Promise<[number, number]>
      getScreenSize: () => Promise<{ width: number; height: number }>
      minimizeWindow: () => void
      openSettings: () => void
      onSuppressHover: (cb: (suppress: boolean) => void) => () => void
      onToolStatus: (cb: (status: string) => void) => () => void
      onSettingsChanged: (cb: () => void) => () => void
    }
  }
}
