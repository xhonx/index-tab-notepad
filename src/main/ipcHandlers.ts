import { ipcMain } from 'electron'
import {
  categoriesRepo,
  categoryNotesRepo,
  dailyNotesRepo,
  settingsRepo,
  type Category
} from './db'
import { MAX_CATEGORIES } from './windowManager'

// 카테고리 CRUD + 설정 저장/조회 IPC. 창 위치/드래그 관련 IPC는 windowManager.ts에서 관리.
export function registerIpcHandlers(): void {
  ipcMain.handle('categories:list', () => categoriesRepo.list())

  ipcMain.handle('categories:create', (_e, name: string, color: string) => {
    if (categoriesRepo.list().length >= MAX_CATEGORIES) {
      throw new Error(`카테고리는 최대 ${MAX_CATEGORIES}개까지 만들 수 있습니다.`)
    }
    return categoriesRepo.create(name, color)
  })

  ipcMain.handle(
    'categories:update',
    (_e, id: string, patch: Partial<Pick<Category, 'name' | 'color'>>) => {
      categoriesRepo.update(id, patch)
    }
  )

  ipcMain.handle('categories:delete', (_e, id: string) => {
    categoriesRepo.remove(id)
  })

  ipcMain.handle('categories:reorder', (_e, orderedIds: string[]) => {
    categoriesRepo.reorder(orderedIds)
  })

  ipcMain.handle('settings:get', (_e, key: string) => settingsRepo.get(key))
  ipcMain.handle('settings:set', (_e, key: string, value: string) => settingsRepo.set(key, value))

  // 카테고리별 메모 리스트 (사용자 요청: 카테고리 하나에 메모 여러 개, 리스트뷰에서 클릭해서 열기)
  ipcMain.handle('category-notes:list', (_e, categoryId: string) =>
    categoryNotesRepo.listByCategory(categoryId)
  )
  ipcMain.handle('category-notes:create', (_e, categoryId: string, title: string) =>
    categoryNotesRepo.create(categoryId, title)
  )
  ipcMain.handle('category-notes:get-content', (_e, noteId: string) =>
    categoryNotesRepo.getContent(noteId)
  )
  ipcMain.handle('category-notes:save-content', (_e, noteId: string, content: string) =>
    categoryNotesRepo.saveContent(noteId, content)
  )
  ipcMain.handle('category-notes:update-title', (_e, noteId: string, title: string) =>
    categoryNotesRepo.updateTitle(noteId, title)
  )
  ipcMain.handle('category-notes:delete', (_e, noteId: string) => categoryNotesRepo.remove(noteId))

  // Today Todo (PRD 4.1) — 날짜(YYYY-MM-DD)를 키로 쌓이는 별도 문서
  ipcMain.handle('daily-notes:get', (_e, date: string) => dailyNotesRepo.get(date))
  ipcMain.handle('daily-notes:save', (_e, date: string, content: string) =>
    dailyNotesRepo.save(date, content)
  )
}
