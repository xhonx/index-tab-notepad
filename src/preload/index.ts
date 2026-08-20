import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

console.log('🟢🟢🟢 preload 스크립트 실행됨')

// Custom APIs for renderer
const api = {}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('tabAPI', {
      setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) =>
        ipcRenderer.send('set-ignore-mouse-events', ignore, options),
      startDrag: () => ipcRenderer.send('start-tab-drag'),
      stopDrag: () => ipcRenderer.send('stop-tab-drag'),
      expandWindow: () => ipcRenderer.send('expand-window'),
      collapseWindow: () => ipcRenderer.send('collapse-window'),
      updateTabCount: (count: number) => ipcRenderer.send('update-tab-count', count)
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

// 클릭 통과 제어 API 노출 -> os에서 받아오는 마우스 좌표값 y값만 따오게
contextBridge.exposeInMainWorld('tabAPI', {
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) =>
    ipcRenderer.send('set-ignore-mouse-events', ignore, options),
  startDrag: () => ipcRenderer.send('start-tab-drag'),
  stopDrag: () => ipcRenderer.send('stop-tab-drag'),
  expandWindow: () => ipcRenderer.send('expand-window'),
  collapseWindow: () => ipcRenderer.send('collapse-window'),
  updateTabCount: (count: number) => ipcRenderer.send('update-tab-count', count)
})
console.log('🟢🟢🟢 tabAPI 노출됨')
