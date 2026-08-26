import type { ElectronAPI } from '@electron-toolkit/preload'
import type { Category, CategoryNote, DailyNoteSummary } from '../main/db'

export interface TabAPI {
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void
  startDrag: () => void
  stopDrag: () => void
  expandWindow: () => void
  collapseWindow: () => void
  updateTabCount: (count: number) => void
  setPinned: (pinned: boolean) => void
  onForceCollapse: (callback: () => void) => () => void
}

export interface DbAPI {
  listCategories: () => Promise<Category[]>
  createCategory: (name: string, color: string) => Promise<Category>
  updateCategory: (id: string, patch: Partial<Pick<Category, 'name' | 'color'>>) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  reorderCategories: (orderedIds: string[]) => Promise<void>
  getSetting: (key: string) => Promise<string | null>
  setSetting: (key: string, value: string) => Promise<void>
  listCategoryNotes: (categoryId: string) => Promise<CategoryNote[]>
  createCategoryNote: (categoryId: string, title: string) => Promise<CategoryNote>
  getCategoryNoteContent: (noteId: string) => Promise<string>
  saveCategoryNoteContent: (noteId: string, content: string) => Promise<void>
  updateCategoryNoteTitle: (noteId: string, title: string) => Promise<void>
  deleteCategoryNote: (noteId: string) => Promise<void>
  getDailyNote: (date: string) => Promise<string>
  saveDailyNote: (date: string, content: string) => Promise<void>
  listDailyNotesMonth: (yearMonth: string) => Promise<DailyNoteSummary[]>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    tabAPI: TabAPI
    dbAPI: DbAPI
  }
}
