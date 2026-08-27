import { app, BrowserWindow, ipcMain } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createTabWindow } from './windowManager'
import { initDatabase } from './db'
import { registerIpcHandlers } from './ipcHandlers'
import { createTray } from './trayManager'

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
    // 템플릿 기본값('com.electron')을 그대로 두면 Windows가 taskbar 아이콘/이름을 다른
    // electron-vite 프로젝트들과 같은 걸로 캐싱해버려서, 앱을 껐다 켤 때 우리가 바꾼
    // 아이콘/이름 대신 기본 Electron 아이콘으로 되돌아가 보이는 원인이 됨 (사용자 리포트)
    electronApp.setAppUserModelId('com.xhonx.indextabnotepad')

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    ipcMain.on('ping', () => console.log('pong'))

    initDatabase()
    registerIpcHandlers()
    createTabWindow()

    // 트레이 좌클릭/컨텍스트 메뉴의 "열기 / 접기" → 렌더러에 토글 요청만 보냄. 실제 펼침/접힘은
    // IndexTab.tsx가 탭 클릭 때와 동일한 경로로 처리 (애니메이션·activeCategoryId 유지 위함)
    createTray(() => {
      const [win] = BrowserWindow.getAllWindows()
      win?.webContents.send('tray-toggle')
    })

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
