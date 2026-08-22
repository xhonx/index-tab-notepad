import { ipcMain } from 'electron'
import { categoriesRepo, settingsRepo, type Category } from './db'
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
}
