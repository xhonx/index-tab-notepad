import { app, BrowserWindow, ipcMain } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createTabWindow } from './windowManager'
import { initDatabase } from './db'
import { registerIpcHandlers } from './ipcHandlers'

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
