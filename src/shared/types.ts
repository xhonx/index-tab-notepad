// 메인 프로세스(SQLite)와 렌더러가 공통으로 쓰는 순수 데이터 타입만 모아둠.
// main/db.ts에서 타입을 그대로 가져다 쓰면 renderer 쪽 tsconfig(tsconfig.web.json)가
// composite 프로젝트라서 "파일이 프로젝트 파일 목록에 없다"(TS6307)는 에러가 나기 때문에,
// electron/better-sqlite3 등 런타임 코드가 전혀 없는 이 파일로 타입만 분리해둠.

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

export interface DailyNoteSummary {
  date: string
  total: number
  checked: number
}
