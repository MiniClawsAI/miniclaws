import { contextBridge, ipcRenderer, webUtils } from 'electron'

contextBridge.exposeInMainWorld('miniclaws', {
  getFilePath: (file: File) => {
    return webUtils.getPathForFile(file)
  },
  useCharacter: (path: string) => {
    ipcRenderer.send('character:use-model', path)
  }
})
