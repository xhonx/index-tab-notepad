import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { randomUUID } from 'crypto'

// PRD 8장 데이터 모델 참고. userData 경로에 저장 (프로젝트 루트의 database.db와는 별개)
const dbPath = join(app.getPath('userData'), 'index-tab-notepad.db')
export const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON') // category_notes/daily_notes 등의 ON DELETE CASCADE가 실제로 동작하려면 필요

export interface Category {
  id: string
  name: string
  color: string
  order_index: number
  created_at: number
}

export interface CategoryNote {
  id: string
  category_id: string
  title: string
  order_index: number
  created_at: number
  updated_at: number
}

// 카테고리 하나 = 문서 하나였던 구 스키마(category_id가 PK)를 카테고리 하나 = 메모 여러 개
// 구조(리스트뷰, 사용자 요청)로 바꾸면서 필요해진 마이그레이션. 이미 새 스키마면 아무것도 안 함.
function migrateCategoryNotesTable(): void {
  const columns = db.prepare('PRAGMA table_info(category_notes)').all() as { name: string }[]
  if (columns.length === 0) return // 테이블이 아직 없음(최초 실행) — 아래서 새 스키마로 바로 생성됨
  if (columns.some((c) => c.name === 'id')) return // 이미 새 스키마

  const oldRows = db
    .prepare('SELECT category_id, content, updated_at FROM category_notes')
    .all() as {
    category_id: string
    content: string
    updated_at: number
  }[]

  db.exec('ALTER TABLE category_notes RENAME TO category_notes_old_v1')
  db.exec(`
    CREATE TABLE category_notes (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      order_index INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
  const insert = db.prepare(
    `INSERT INTO category_notes (id, category_id, title, content, order_index, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`
  )
  oldRows.forEach((row) => {
    if (!row.content) return // 빈 문서였던 카테고리는 옮길 내용이 없으므로 건너뜀
    insert.run(
      randomUUID(),
      row.category_id,
      '이전 메모',
      row.content,
      row.updated_at,
      row.updated_at
    )
  })
  db.exec('DROP TABLE category_notes_old_v1')
}

export function initDatabase(): void {
  migrateCategoryNotesTable()

  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- 카테고리 하나에 메모 여러 개(리스트뷰): 목록은 제목만, 본문(content)은 열었을 때만 조회
    CREATE TABLE IF NOT EXISTS category_notes (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      order_index INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Today Todo (PRD 4.1) — 카테고리와 별개로 날짜(YYYY-MM-DD)를 키로 쌓이는 구조.
    -- 자정이 지나면 새 날짜로 넘어가고 이전 날짜 문서는 그대로 남아 캘린더 뷰(M6)에서 조회할 예정
    CREATE TABLE IF NOT EXISTS daily_notes (
      date TEXT PRIMARY KEY,
      content TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `)

  // 최초 실행 시에만 PRD 9장 예시와 동일한 기본 카테고리를 시드
  const { count } = db.prepare('SELECT COUNT(*) as count FROM categories').get() as {
    count: number
  }
  if (count === 0) {
    const seed = [
      { name: 'LAB', color: '#bad2f0' },
      { name: '쉴더스', color: '#ebdfab' },
      { name: '개인공부', color: '#c1ecd1' }
    ]
    const insert = db.prepare(
      'INSERT INTO categories (id, name, color, order_index, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    seed.forEach((c, i) => insert.run(randomUUID(), c.name, c.color, i, Date.now()))
  }
}

export const categoriesRepo = {
  list(): Category[] {
    return db.prepare('SELECT * FROM categories ORDER BY order_index ASC').all() as Category[]
  },
  create(name: string, color: string): Category {
    const { maxOrder } = db
      .prepare('SELECT COALESCE(MAX(order_index), -1) as maxOrder FROM categories')
      .get() as { maxOrder: number }
    const category: Category = {
      id: randomUUID(),
      name,
      color,
      order_index: maxOrder + 1,
      created_at: Date.now()
    }
    db.prepare(
      'INSERT INTO categories (id, name, color, order_index, created_at) VALUES (@id, @name, @color, @order_index, @created_at)'
    ).run(category)
    return category
  },
  update(id: string, patch: { name?: string; color?: string }): void {
    if (patch.name !== undefined) {
      db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(patch.name, id)
    }
    if (patch.color !== undefined) {
      db.prepare('UPDATE categories SET color = ? WHERE id = ?').run(patch.color, id)
    }
  },
  remove(id: string): void {
    db.prepare('DELETE FROM categories WHERE id = ?').run(id)
  },
  reorder(orderedIds: string[]): void {
    const update = db.prepare('UPDATE categories SET order_index = ? WHERE id = ?')
    const tx = db.transaction((ids: string[]) => {
      ids.forEach((id, i) => update.run(i, id))
    })
    tx(orderedIds)
  }
}

export const categoryNotesRepo = {
  // 목록용 — content는 빼고 제목/시각만 (패널이 좁아서 미리보기는 아직 안 보여줌)
  listByCategory(categoryId: string): CategoryNote[] {
    return db
      .prepare(
        `SELECT id, category_id, title, order_index, created_at, updated_at
         FROM category_notes WHERE category_id = ? ORDER BY order_index ASC`
      )
      .all(categoryId) as CategoryNote[]
  },
  getContent(noteId: string): string {
    const row = db.prepare('SELECT content FROM category_notes WHERE id = ?').get(noteId) as
      { content: string } | undefined
    return row?.content ?? ''
  },
  create(categoryId: string, title: string): CategoryNote {
    const { maxOrder } = db
      .prepare(
        'SELECT COALESCE(MAX(order_index), -1) as maxOrder FROM category_notes WHERE category_id = ?'
      )
      .get(categoryId) as { maxOrder: number }
    const now = Date.now()
    const note: CategoryNote = {
      id: randomUUID(),
      category_id: categoryId,
      title,
      order_index: maxOrder + 1,
      created_at: now,
      updated_at: now
    }
    db.prepare(
      `INSERT INTO category_notes (id, category_id, title, content, order_index, created_at, updated_at)
       VALUES (@id, @category_id, @title, '', @order_index, @created_at, @updated_at)`
    ).run(note)
    return note
  },
  updateTitle(noteId: string, title: string): void {
    db.prepare('UPDATE category_notes SET title = ?, updated_at = ? WHERE id = ?').run(
      title,
      Date.now(),
      noteId
    )
  },
  saveContent(noteId: string, content: string): void {
    db.prepare('UPDATE category_notes SET content = ?, updated_at = ? WHERE id = ?').run(
      content,
      Date.now(),
      noteId
    )
  },
  remove(noteId: string): void {
    db.prepare('DELETE FROM category_notes WHERE id = ?').run(noteId)
  }
}

export interface DailyNoteSummary {
  date: string
  total: number
  checked: number
}

export const dailyNotesRepo = {
  get(date: string): string {
    const row = db.prepare('SELECT content FROM daily_notes WHERE date = ?').get(date) as
      { content: string } | undefined
    return row?.content ?? ''
  },
  save(date: string, content: string): void {
    db.prepare(
      `INSERT INTO daily_notes (date, content, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`
    ).run(date, content, Date.now())
  },
  // 캘린더 뷰(M6)의 월간 완료율 표시용. TipTap TaskItem이 렌더링하는 data-checked="..." 속성
  // 개수를 세는 방식이라 daily_sections/daily_todo_items 같은 별도 구조화 테이블 없이도 계산 가능
  listMonth(yearMonth: string): DailyNoteSummary[] {
    const rows = db
      .prepare('SELECT date, content FROM daily_notes WHERE date LIKE ?')
      .all(`${yearMonth}-%`) as { date: string; content: string }[]
    return rows.map((row) => {
      const total = (row.content.match(/data-checked="/g) ?? []).length
      const checked = (row.content.match(/data-checked="true"/g) ?? []).length
      return { date: row.date, total, checked }
    })
  }
}

export const settingsRepo = {
  get(key: string): string | null {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      { value: string } | undefined
    return row?.value ?? null
  },
  set(key: string, value: string): void {
    db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(key, value)
  }
}
