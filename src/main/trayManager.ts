import { app, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

// PRD 6장 P1 — "트레이 아이콘 | 시스템 트레이에서 제어". 왼쪽 클릭으로 펼침/접힘 토글,
// 오른쪽 클릭(컨텍스트 메뉴)으로 토글/종료. resources/**는 electron-builder.yml에서
// asarUnpack 대상이라 패키징 후에도 이 경로 그대로 읽힘 (electron-vite 기본 관례)
function getIconPath(): string {
  return is.dev
    ? join(__dirname, '../../resources/icon.png')
    : join(process.resourcesPath, 'resources', 'icon.png')
}

// Tray 인스턴스를 지역 변수로만 들고 있으면 참조가 사라지는 순간 GC돼서 트레이 아이콘이
// 조용히 없어짐(Electron 공식 문서 경고 사항) → 모듈 스코프에 붙잡아둠
let trayInstance: Tray | null = null

export function createTray(onToggle: () => void, onCheckForUpdates: () => void): Tray {
  const icon = nativeImage.createFromPath(getIconPath()).resize({ width: 16, height: 16 })
  const tray = new Tray(icon)
  trayInstance = tray
  tray.setToolTip('인덱스탭 메모장')

  const contextMenu = Menu.buildFromTemplate([
    { label: '열기 / 접기', click: onToggle },
    { type: 'separator' },
    { label: '업데이트 확인', click: onCheckForUpdates },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() }
  ])
  tray.setContextMenu(contextMenu)

  // Windows에서는 트레이 아이콘 좌클릭이 곧바로 'click' 이벤트로 옴 (컨텍스트 메뉴는 우클릭 전용)
  tray.on('click', onToggle)

  return tray
}

// 모듈 스코프에 붙잡아둔 인스턴스를 실제로 참조하는 곳 — 없으면 위 trayInstance 대입이
// "쓰기만 하고 안 읽는 변수"로 잡혀서(TS6133) 그냥 GC 방지 목적이라는 게 드러나지 않음
export function getTray(): Tray | null {
  return trayInstance
}
