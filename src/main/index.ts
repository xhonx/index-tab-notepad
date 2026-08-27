import { app, BrowserWindow, ipcMain } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createTabWindow } from './windowManager'
import { initDatabase } from './db'
import { registerIpcHandlers } from './ipcHandlers'

// 인스턴스가 여러 개 동시에 뜨면 같은 SQLite 파일에 각자 initDatabase()(=마이그레이션 포함)를
// 돌리면서 서로 스키마를 덮어쓰는 경쟁 상태가 생길 수 있음 (실제로 이 문제로 category_notes
// 테이블이 title/order_index가 빠진 애매한 상태로 깨진 적 있음, DevLog 12장 참고) → 두 번째
// 인스턴스는 아예 못 뜨게 막음
const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.electron')

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    ipcMain.on('ping', () => console.log('pong'))

    initDatabase()
    registerIpcHandlers()
    createTabWindow()

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createTabWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
