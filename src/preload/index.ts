import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Category, CategoryNote, DailyNoteSummary } from '../shared/types'

// 창 도킹/드래그/확장-축소 제어용 IPC 래퍼
const tabAPI = {
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) =>
    ipcRenderer.send('set-ignore-mouse-events', ignore, options),
  startDrag: () => ipcRenderer.send('start-tab-drag'),
  stopDrag: () => ipcRenderer.send('stop-tab-drag'),
  expandWindow: () => ipcRenderer.send('expand-window'),
  collapseWindow: () => ipcRenderer.send('collapse-window'),
  updateTabCount: (count: number) => ipcRenderer.send('update-tab-count', count),
  setPinned: (pinned: boolean) => ipcRenderer.send('set-pinned', pinned),
  // 클릭 아웃(창 포커스 아웃) 시 메인 프로세스가 접힘을 요청할 때 호출됨. 구독 해제 함수를 반환.
  onForceCollapse: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('force-collapse', listener)
    return () => ipcRenderer.removeListener('force-collapse', listener)
  },
  // 트레이 아이콘 좌클릭/컨텍스트 메뉴에서 펼침·접힘 토글을 요청할 때 호출됨. 구독 해제 함수를 반환.
  onTrayToggle: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('tray-toggle', listener)
    return () => ipcRenderer.removeListener('tray-toggle', listener)
  }
}

// 카테고리 CRUD + 설정 저장/조회용 IPC 래퍼 (SQLite, 메인 프로세스 경유)
const dbAPI = {
  listCategories: (): Promise<Category[]> => ipcRenderer.invoke('categories:list'),
  createCategory: (name: string, color: string): Promise<Category> =>
    ipcRenderer.invoke('categories:create', name, color),
  updateCategory: (id: string, patch: Partial<Pick<Category, 'name' | 'color'>>): Promise<void> =>
    ipcRenderer.invoke('categories:update', id, patch),
  deleteCategory: (id: string): Promise<void> => ipcRenderer.invoke('categories:delete', id),
  reorderCategories: (orderedIds: string[]): Promise<void> =>
    ipcRenderer.invoke('categories:reorder', orderedIds),
  getSetting: (key: string): Promise<string | null> => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: string): Promise<void> =>
    ipcRenderer.invoke('settings:set', key, value),
  listCategoryNotes: (categoryId: string): Promise<CategoryNote[]> =>
    ipcRenderer.invoke('category-notes:list', categoryId),
  createCategoryNote: (categoryId: string, title: string): Promise<CategoryNote> =>
    ipcRenderer.invoke('category-notes:create', categoryId, title),
  getCategoryNoteContent: (noteId: string): Promise<string> =>
    ipcRenderer.invoke('category-notes:get-content', noteId),
  saveCategoryNoteContent: (noteId: string, content: string): Promise<void> =>
    ipcRenderer.invoke('category-notes:save-content', noteId, content),
  updateCategoryNoteTitle: (noteId: string, title: string): Promise<void> =>
    ipcRenderer.invoke('category-notes:update-title', noteId, title),
  deleteCategoryNote: (noteId: string): Promise<void> =>
    ipcRenderer.invoke('category-notes:delete', noteId),
  getDailyNote: (date: string): Promise<string> => ipcRenderer.invoke('daily-notes:get', date),
  saveDailyNote: (date: string, content: string): Promise<void> =>
    ipcRenderer.invoke('daily-notes:save', date, content),
  listDailyNotesMonth: (yearMonth: string): Promise<DailyNoteSummary[]> =>
    ipcRenderer.invoke('daily-notes:list-month', yearMonth)
}

// Custom APIs for renderer
const api = {}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('tabAPI', tabAPI)
    contextBridge.exposeInMainWorld('dbAPI', dbAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore (define in dts)
  window.tabAPI = tabAPI
  // @ts-ignore (define in dts)
  window.dbAPI = dbAPI
}
