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
  dragStart: (screenX: number, screenY: number) => {
    ipcRenderer.send('drag-start', { screenX, screenY })
  },
  dragStop: () => {
    ipcRenderer.send('drag-stop')
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
  },

  // ── External links ─────────────────────────────────────
  openExternal: (url: string) => {
    ipcRenderer.send('open-external', url)
  },

  // ── 3D model import ───────────────────────────────────
  openModelDialog: (): Promise<string | null> => {
    return ipcRenderer.invoke('dialog:open-model')
  },
  showCharacterMenu: (): Promise<'editor' | 'reset' | null> => {
    return ipcRenderer.invoke('character:context-menu')
  },

  // ── Character editor ──────────────────────────────────
  useCharacter: (path: string) => {
    ipcRenderer.send('character:use-model', path)
  },
  onUseCharacter: (cb: (path: string) => void) => {
    const handler = (_: unknown, path: string) => cb(path)
    ipcRenderer.on('use-character', handler)
    return () => ipcRenderer.removeListener('use-character', handler)
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
      dragStart: (screenX: number, screenY: number) => void
      dragStop: () => void
      getScreenSize: () => Promise<{ width: number; height: number }>
      minimizeWindow: () => void
      openSettings: () => void
      onSuppressHover: (cb: (suppress: boolean) => void) => () => void
      onToolStatus: (cb: (status: string) => void) => () => void
      onSettingsChanged: (cb: () => void) => () => void
      openExternal: (url: string) => void
      openModelDialog: () => Promise<string | null>
      showCharacterMenu: () => Promise<'editor' | 'reset' | null>
      useCharacter: (path: string) => void
      onUseCharacter: (cb: (path: string) => void) => () => void
    }
  }
}
