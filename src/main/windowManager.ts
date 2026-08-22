import { screen, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { settingsRepo } from './db'

const TAB_CENTER_Y_KEY = 'tab_center_y'

const TAB_WIDTH = 32
const PANEL_WIDTH = 360
const TAB_HEIGHT_DEFAULT = 68 // 탭 1개당 기본 높이 (접힘 상태 계산용)
const QUARTER_RATIO = 0.25 // 접힘 상한 & 펼침 고정 높이, 둘 다 화면의 1/4

export const MAX_CATEGORIES = 5
let currentTabCount = 1 // M3에서 카테고리 CRUD와 연동 예정 (지금은 임시 고정)
let isExpanded = false
let isPinned = false

function getCollapsedHeight(tabCount: number): number {
  const { workAreaSize } = screen.getPrimaryDisplay()
  const maxStack = workAreaSize.height * QUARTER_RATIO
  return Math.min(tabCount * TAB_HEIGHT_DEFAULT, maxStack)
}

function getExpandedHeight(): number {
  const { workAreaSize } = screen.getPrimaryDisplay()
  return workAreaSize.height * QUARTER_RATIO // 카테고리 개수와 무관하게 항상 1/4 고정
}

function getBounds(
  expanded: boolean,
  tabCount: number,
  keepCenterY?: number
): { x: number; y: number; width: number; height: number } {
  const { workAreaSize } = screen.getPrimaryDisplay()
  const width = expanded ? TAB_WIDTH + PANEL_WIDTH : TAB_WIDTH
  const height = expanded ? getExpandedHeight() : getCollapsedHeight(tabCount)
  let y =
    keepCenterY !== undefined
      ? Math.round(keepCenterY - height / 2)
      : Math.round((workAreaSize.height - height) / 2)
  y = Math.max(0, Math.min(y, workAreaSize.height - height))
  return { x: workAreaSize.width - width, y, width, height }
}

let dragInterval: NodeJS.Timeout | null = null

export function createTabWindow(): BrowserWindow {
  // 이전 세션에서 드래그로 옮겨둔 세로 위치가 있으면 복원, 없으면 기본값(화면 중앙)
  const savedCenterY = settingsRepo.get(TAB_CENTER_Y_KEY)
  const bounds = getBounds(
    false,
    currentTabCount,
    savedCenterY !== null ? Number(savedCenterY) : undefined
  )
  const win = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: false,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 패널 펼치기: 렌더러의 슬라이드-인 애니메이션 시작과 거의 동시에 창을 1/4 높이로 즉시 확장
  ipcMain.on('expand-window', () => {
    if (isExpanded) return // 이미 펼쳐진 상태에서 다른 탭 클릭 시엔 크기 안 바뀜 (내용만 전환)
    isExpanded = true
    const [, curY] = win.getPosition()
    const [, curHeight] = win.getSize()
    const centerY = curY + curHeight / 2
    win.setBounds(getBounds(true, currentTabCount, centerY))
  })

  // 패널 접기: 렌더러의 슬라이드-아웃 애니메이션이 끝난 뒤 호출됨
  ipcMain.on('collapse-window', () => {
    isExpanded = false
    const [, curY] = win.getPosition()
    const [, curHeight] = win.getSize()
    const centerY = curY + curHeight / 2
    win.setBounds(getBounds(false, currentTabCount, centerY))
  })

  // 카테고리 개수 변경 시 (M3에서 연결 예정). 펼쳐진 상태면 크기 불변, 접힌 상태면 즉시 반영
  ipcMain.on('update-tab-count', (_e, count: number) => {
    currentTabCount = Math.min(count, MAX_CATEGORIES)
    if (isExpanded) return
    const [, curY] = win.getPosition()
    const [, curHeight] = win.getSize()
    const centerY = curY + curHeight / 2
    win.setBounds(getBounds(false, currentTabCount, centerY))
  })

  ipcMain.on('start-tab-drag', () => {
    const startCursor = screen.getCursorScreenPoint()
    const [, startY] = win.getPosition()

    if (dragInterval) clearInterval(dragInterval)
    dragInterval = setInterval(() => {
      const cursor = screen.getCursorScreenPoint()
      const deltaY = cursor.y - startCursor.y
      const { workAreaSize } = screen.getPrimaryDisplay()
      const [width, height] = win.getSize()
      const dockedX = workAreaSize.width - width
      const clampedY = Math.max(0, Math.min(startY + deltaY, workAreaSize.height - height))
      win.setPosition(dockedX, clampedY)
    }, 8)
  })

  ipcMain.on('stop-tab-drag', () => {
    if (dragInterval) {
      clearInterval(dragInterval)
      dragInterval = null
    }
    // 드래그가 끝난 세로 위치를 저장해서 다음 실행 때도 같은 자리에 뜨게 함
    const [, curY] = win.getPosition()
    const [, curHeight] = win.getSize()
    settingsRepo.set(TAB_CENTER_Y_KEY, String(curY + curHeight / 2))
  })

  // Pin 모드: 켜져있으면 창 포커스가 빠져도(클릭 아웃) 자동으로 접히지 않음
  ipcMain.on('set-pinned', (_e, pinned: boolean) => {
    isPinned = pinned
  })

  win.on('blur', () => {
    if (dragInterval) {
      clearInterval(dragInterval)
      dragInterval = null
    }
    // 클릭 아웃 시 자동 접힘 (Pin 상태면 무시) — 렌더러에 접힘 애니메이션 시작을 요청
    if (isExpanded && !isPinned) {
      win.webContents.send('force-collapse')
    }
  })

  ipcMain.on('set-ignore-mouse-events', (e, ignore, options) => {
    BrowserWindow.fromWebContents(e.sender)?.setIgnoreMouseEvents(ignore, options)
  })

  return win
}
