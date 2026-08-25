import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { randomUUID } from 'crypto'

// PRD 8장 데이터 모델 참고. userData 경로에 저장 (프로젝트 루트의 database.db와는 별개)
const dbPath = join(app.getPath('userData'), 'index-tab-notepad.db')
export const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

export interface Category {
  id: string
  name: string
  color: string
  order_index: number
  created_at: number
}

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- 카테고리당 문서 1개(계속 덮어쓰는 구조, PRD 4.1)이므로 category_id를 PK로 사용
    CREATE TABLE IF NOT EXISTS category_notes (
      category_id TEXT PRIMARY KEY REFERENCES categories(id) ON DELETE CASCADE,
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
  get(categoryId: string): string {
    const row = db
      .prepare('SELECT content FROM category_notes WHERE category_id = ?')
      .get(categoryId) as { content: string } | undefined
    return row?.content ?? ''
  },
  save(categoryId: string, content: string): void {
    db.prepare(
      `INSERT INTO category_notes (category_id, content, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(category_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`
    ).run(categoryId, content, Date.now())
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
