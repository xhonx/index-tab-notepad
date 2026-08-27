import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Category, CategoryNote } from '../../../shared/types'
import CategoryModal from './CategoryModal'
import NoteEditor from './NoteEditor'
import NoteListView from './NoteListView'
import CalendarView from './CalendarView'

const TAB_WIDTH_PX = 32
const PANEL_WIDTH_PX = 360
const TOTAL_WIDTH_PX = TAB_WIDTH_PX + PANEL_WIDTH_PX
const PANEL_PADDING_PX = 16
// 탭 스택이 패널 위(zIndex 2)에 얹혀서 오른쪽 TAB_WIDTH_PX만큼을 가리기 때문에,
// 패널 안쪽 콘텐츠가 그 밑으로 들어가 겹치지 않도록 오른쪽에 탭 폭만큼 여백을 더 준다.
const PANEL_CONTENT_PADDING = `${PANEL_PADDING_PX}px ${PANEL_PADDING_PX + TAB_WIDTH_PX}px ${PANEL_PADDING_PX}px ${PANEL_PADDING_PX}px`

// windowManager.ts의 MAX_CATEGORIES와 동일하게 유지할 것 (창 크기 상한 계산 기준)
const MAX_CATEGORIES = 5

// Today Todo는 categories 테이블이 아니라 날짜 기반 daily_notes에 저장되는 고정 특수 탭 (PRD 4.1)
const TODAY_TAB_ID = '__today__'

// IPC invoke 에러는 "Error invoking remote method '...': Error: <메시지>" 형태로 오므로 메시지만 추출
function extractErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  const marker = 'Error: '
  const idx = message.lastIndexOf(marker)
  return idx >= 0 ? message.slice(idx + marker.length) : message
}

// 오늘 날짜를 YYYY-MM-DD로 계산. 자정이 지나면 Today Todo가 새 문서로 넘어가야 하므로
// 저장하지 않고 호출할 때마다 다시 구함 (아래 자정 감지 useEffect 참고)
function getTodayKey(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function IndexTab(): React.JSX.Element {
  const isDraggingRef = useRef(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [activeCategoryId, setActiveCategoryId] = useState(TODAY_TAB_ID)
  const [todayKey, setTodayKey] = useState(getTodayKey)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [createError, setCreateError] = useState<string | undefined>(undefined)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // 카테고리 안에 메모 여러 개 (리스트뷰). 카테고리를 바꾸면 목록을 새로 불러오고, 열려있던 메모는 닫힘
  const [categoryNotes, setCategoryNotes] = useState<CategoryNote[]>([])
  const [openNoteId, setOpenNoteId] = useState<string | null>(null)
  const [noteTitleDraft, setNoteTitleDraft] = useState('')

  // Today Todo 전용 캘린더 뷰 (M6). 다른 탭으로 나갔다 오면 항상 편집 화면부터 다시 보여줌
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)

  // activeCategoryId가 바뀐 순간을 렌더 중에 감지해서 즉시 리셋 (React가 권장하는
  // "prop 변화에 따른 state 조정" 패턴 — effect 안에서 동기적으로 setState하는 것보다 한 렌더 빠름)
  const [prevActiveCategoryId, setPrevActiveCategoryId] = useState(activeCategoryId)
  if (activeCategoryId !== prevActiveCategoryId) {
    setPrevActiveCategoryId(activeCategoryId)
    setOpenNoteId(null)
    setCategoryNotes([])
    setIsCalendarOpen(false)
  }

  // SQLite에 저장된 카테고리 목록을 최초 1회 로드
  useEffect(() => {
    window.dbAPI.listCategories().then(setCategories)
  }, [])

  // 탭 개수(Today Todo 고정 탭 1개 + 카테고리)가 바뀔 때마다 메인 프로세스에 알림 (접힘 상태 창 크기 계산용)
  useEffect(() => {
    window.tabAPI.updateTabCount(categories.length + 1)
  }, [categories.length])

  // 클릭 아웃(창 포커스 아웃) 시 메인 프로세스가 접힘을 요청하면 반영 (Pin 상태면 메인에서 아예 안 보냄)
  useEffect(() => {
    return window.tabAPI.onForceCollapse(() => setIsExpanded(false))
  }, [])

  // 자정 전환 감지 (PRD 10장): 30초마다 오늘 날짜를 다시 계산해서 바뀌었으면 Today Todo를 새 문서로 갱신.
  // todayKey가 바뀌면 아래 NoteEditor가 key로 리마운트되어 자동으로 새 날짜 문서를 로드함
  useEffect(() => {
    const interval = setInterval(() => setTodayKey(getTodayKey()), 30_000)
    return () => clearInterval(interval)
  }, [])

  // 카테고리 탭이 활성화되면 그 카테고리의 메모 목록을 로드 (열림/닫힘 리셋은 위 렌더 중 조정에서 처리)
  useEffect(() => {
    if (activeCategoryId === TODAY_TAB_ID) return
    window.dbAPI.listCategoryNotes(activeCategoryId).then(setCategoryNotes)
  }, [activeCategoryId])

  const handleMouseDown = (e: React.MouseEvent): void => {
    if (e.button !== 0) return
    isDraggingRef.current = true
    window.tabAPI.setIgnoreMouseEvents(false)
    window.tabAPI.startDrag()

    const handleMouseUp = (): void => {
      isDraggingRef.current = false
      window.tabAPI.stopDrag()
      window.removeEventListener('mouseup', handleMouseUp)
    }
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleTabClick = (tabId: string): void => {
    if (isDraggingRef.current) return

    if (!isExpanded) {
      setActiveCategoryId(tabId)
      setIsExpanded(true)
      window.tabAPI.expandWindow()
    } else if (tabId === activeCategoryId) {
      setIsExpanded(false) // 같은 탭 다시 클릭 → 접힘 (collapseWindow는 애니메이션 종료 후 호출됨)
    } else {
      setActiveCategoryId(tabId) // 다른 탭 클릭 → 창 크기 그대로, 내용만 전환
    }
  }

  const togglePin = (): void => {
    setIsPinned((prev) => {
      const next = !prev
      window.tabAPI.setPinned(next)
      return next
    })
  }

  const handleCreateCategory = async (name: string, color: string): Promise<void> => {
    try {
      const created = await window.dbAPI.createCategory(name, color)
      setCategories((prev) => [...prev, created])
      setActiveCategoryId(created.id)
      setCreateError(undefined)
      setIsModalOpen(false)
    } catch (err) {
      setCreateError(extractErrorMessage(err))
    }
  }

  const startRename = (category: Category): void => {
    setRenamingId(category.id)
    setRenameValue(category.name)
  }

  const commitRename = async (id: string): Promise<void> => {
    const trimmed = renameValue.trim()
    setRenamingId(null)
    if (!trimmed) return
    await window.dbAPI.updateCategory(id, { name: trimmed })
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name: trimmed } : c)))
  }

  const handleDeleteCategory = async (id: string): Promise<void> => {
    await window.dbAPI.deleteCategory(id)
    setConfirmDeleteId(null)
    setCategories((prev) => prev.filter((c) => c.id !== id))
    if (activeCategoryId === id) {
      setActiveCategoryId(TODAY_TAB_ID) // 삭제된 탭이 열려있던 중이면 고정 탭인 Today Todo로 이동
    }
  }

  const handleOpenNote = (noteId: string): void => {
    const note = categoryNotes.find((n) => n.id === noteId)
    setNoteTitleDraft(note?.title ?? '')
    setOpenNoteId(noteId)
  }

  const handleCreateNote = async (): Promise<void> => {
    const created = await window.dbAPI.createCategoryNote(activeCategoryId, '')
    setCategoryNotes((prev) => [...prev, created])
    setNoteTitleDraft('')
    setOpenNoteId(created.id) // 만들자마자 바로 편집 화면으로 진입
  }

  const handleDeleteNote = async (noteId: string): Promise<void> => {
    await window.dbAPI.deleteCategoryNote(noteId)
    setCategoryNotes((prev) => prev.filter((n) => n.id !== noteId))
    if (openNoteId === noteId) setOpenNoteId(null)
  }

  const commitNoteTitle = async (noteId: string): Promise<void> => {
    const trimmed = noteTitleDraft.trim()
    await window.dbAPI.updateCategoryNoteTitle(noteId, trimmed)
    setCategoryNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, title: trimmed } : n)))
  }

  const isTodayActive = activeCategoryId === TODAY_TAB_ID
  const activeCategory = categories.find((c) => c.id === activeCategoryId)
  const openNote = openNoteId ? categoryNotes.find((n) => n.id === openNoteId) : undefined

  return (
    <div
      style={{ display: 'flex', width: '100%', height: '100%', justifyContent: 'flex-end' }}
      onMouseEnter={() => window.tabAPI.setIgnoreMouseEvents(false)}
      onMouseLeave={() => {
        if (isDraggingRef.current) return
        window.tabAPI.setIgnoreMouseEvents(true, { forward: true })
      }}
    >
      {/* 메모 패널 */}
      <AnimatePresence onExitComplete={() => window.tabAPI.collapseWindow()}>
        {isExpanded && (isTodayActive || activeCategory) && (
          <motion.div
            initial={{ x: PANEL_WIDTH_PX, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: PANEL_WIDTH_PX, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: TOTAL_WIDTH_PX, // 탭 폭까지 포함한 전체 너비
              height: '100%',
              background: 'white',
              borderRadius: '8px 0 0 8px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
              zIndex: 1, // 탭보다 아래
              padding: PANEL_CONTENT_PADDING, // 탭 밑에 콘텐츠가 안 깔리게 오른쪽에 탭 폭만큼 여백
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {isTodayActive ? (
                isCalendarOpen ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={() => setIsCalendarOpen(false)}
                      title="Today Todo로"
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontSize: 14,
                        padding: 0
                      }}
                    >
                      ←
                    </button>
                    <h3 style={{ margin: 0, color: '#333', fontSize: 14 }}>📅 캘린더</h3>
                  </div>
                ) : (
                  <h3 style={{ margin: 0, color: '#333' }}>✅ Today Todo</h3>
                )
              ) : openNote ? (
                // 메모를 펼친 상태: 뒤로가기 + 메모 제목(직접 편집 가능)
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <button
                    onClick={() => setOpenNoteId(null)}
                    title="목록으로"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontSize: 14,
                      padding: 0,
                      flexShrink: 0
                    }}
                  >
                    ←
                  </button>
                  <input
                    value={noteTitleDraft}
                    placeholder="제목 없음"
                    onChange={(e) => setNoteTitleDraft(e.target.value)}
                    onBlur={() => commitNoteTitle(openNote.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    }}
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      border: 'none',
                      outline: 'none',
                      minWidth: 0,
                      flex: 1,
                      color: activeCategory?.color
                    }}
                  />
                </div>
              ) : renamingId === activeCategory!.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(activeCategory!.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(activeCategory!.id)
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    border: '1px solid #ddd',
                    borderRadius: 4,
                    padding: '2px 4px',
                    color: activeCategory!.color,
                    outline: 'none'
                  }}
                />
              ) : (
                <h3
                  onDoubleClick={() => startRename(activeCategory!)}
                  title="더블클릭하면 이름을 바꿀 수 있어요"
                  style={{ margin: 0, color: activeCategory!.color, cursor: 'text' }}
                >
                  {activeCategory!.name}
                </h3>
              )}

              <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                {isTodayActive && !isCalendarOpen && (
                  <button
                    onClick={() => setIsCalendarOpen(true)}
                    title="캘린더 보기"
                    style={{
                      fontSize: 12,
                      padding: '3px 6px',
                      borderRadius: 6,
                      border: '1px solid #ddd',
                      background: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    📅
                  </button>
                )}
                <button
                  onClick={togglePin}
                  title={isPinned ? 'Pin 해제' : 'Pin 고정 (클릭 아웃해도 안 접힘)'}
                  style={{
                    fontSize: 12,
                    padding: '3px 6px',
                    borderRadius: 6,
                    border: '1px solid #ddd',
                    background: isPinned ? '#333' : 'white',
                    color: isPinned ? 'white' : '#333',
                    cursor: 'pointer'
                  }}
                >
                  📌
                </button>

                {/* 카테고리 삭제는 리스트뷰(메모 안 열려있을 때)에서만. Today Todo는 카테고리가 아니라서 대상 아님 */}
                {!isTodayActive &&
                  !openNote &&
                  (confirmDeleteId === activeCategory!.id ? (
                    <>
                      <button
                        onClick={() => handleDeleteCategory(activeCategory!.id)}
                        title="정말 삭제"
                        style={{
                          fontSize: 11,
                          padding: '3px 6px',
                          borderRadius: 6,
                          border: '1px solid #e11d48',
                          background: '#e11d48',
                          color: 'white',
                          cursor: 'pointer'
                        }}
                      >
                        삭제확인
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        style={{
                          fontSize: 11,
                          padding: '3px 6px',
                          borderRadius: 6,
                          border: '1px solid #ddd',
                          background: 'white',
                          cursor: 'pointer'
                        }}
                      >
                        취소
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(activeCategory!.id)}
                      title="카테고리 삭제"
                      style={{
                        fontSize: 12,
                        padding: '3px 6px',
                        borderRadius: 6,
                        border: '1px solid #ddd',
                        background: 'white',
                        color: '#999',
                        cursor: 'pointer'
                      }}
                    >
                      🗑
                    </button>
                  ))}
              </div>
            </div>

            {/* key로 강제 리마운트: 탭/메모/날짜 전환 시 에디터 내부 상태(히스토리 등)를 깔끔하게 초기화 */}
            {isTodayActive ? (
              isCalendarOpen ? (
                <CalendarView />
              ) : (
                <NoteEditor
                  key={todayKey}
                  storageKey={todayKey}
                  loadContent={() => window.dbAPI.getDailyNote(todayKey)}
                  saveContent={(content) => window.dbAPI.saveDailyNote(todayKey, content)}
                />
              )
            ) : openNote ? (
              <NoteEditor
                key={openNote.id}
                storageKey={openNote.id}
                loadContent={() => window.dbAPI.getCategoryNoteContent(openNote.id)}
                saveContent={(content) =>
                  window.dbAPI.saveCategoryNoteContent(openNote.id, content)
                }
              />
            ) : (
              <NoteListView
                notes={categoryNotes}
                onOpenNote={handleOpenNote}
                onCreateNote={handleCreateNote}
                onDeleteNote={handleDeleteNote}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 탭 스택 - 펼침 여부와 무관하게 항상 보임 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: TAB_WIDTH_PX,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 2
        }}
      >
        {/* Today Todo 고정 탭 — 항상 맨 위, 카테고리와 다른 색으로 구분 (PRD 9장 목업 참고) */}
        <div
          onMouseDown={handleMouseDown}
          onClick={() => handleTabClick(TODAY_TAB_ID)}
          title="Today Todo"
          style={{
            flex: 1,
            background: '#333',
            opacity: isExpanded && !isTodayActive ? 0.6 : 1,
            borderRadius: '8px 0 0 8px',
            borderBottom: '1px solid rgba(255,255,255,0.25)',
            cursor: 'grab',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14
          }}
        >
          ✅
        </div>

        {/* 카테고리 탭 — 헷갈리지 않도록 이름을 세로쓰기로 표시 */}
        {categories.map((cat) => (
          <div
            key={cat.id}
            onMouseDown={handleMouseDown}
            onClick={() => handleTabClick(cat.id)}
            title={cat.name}
            style={{
              flex: 1,
              background: cat.color,
              opacity: isExpanded && cat.id !== activeCategoryId ? 0.6 : 1,
              borderRadius: '8px 0 0 8px',
              borderBottom: '1px solid rgba(255,255,255,0.4)',
              cursor: 'grab',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}
          >
            <span
              style={{
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                fontSize: 11,
                fontWeight: 600,
                color: '#333',
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap'
              }}
            >
              {cat.name}
            </span>
          </div>
        ))}

        {/* "+ 카테고리 추가" — 메모장이 펼쳐졌을 때만 작게 노출 (PRD 3.2) */}
        {isExpanded && (
          <button
            onClick={() => categories.length < MAX_CATEGORIES && setIsModalOpen(true)}
            disabled={categories.length >= MAX_CATEGORIES}
            title={
              categories.length >= MAX_CATEGORIES
                ? `카테고리는 최대 ${MAX_CATEGORIES}개까지 만들 수 있어요`
                : '카테고리 추가'
            }
            style={{
              height: 28,
              border: 'none',
              borderRadius: '0 0 0 8px',
              background: categories.length >= MAX_CATEGORIES ? '#eee' : '#f4f4f4',
              color: categories.length >= MAX_CATEGORIES ? '#bbb' : '#666',
              cursor: categories.length >= MAX_CATEGORIES ? 'not-allowed' : 'pointer',
              fontSize: 14
            }}
          >
            ➕
          </button>
        )}
      </div>

      {isModalOpen && (
        <CategoryModal
          onCancel={() => {
            setIsModalOpen(false)
            setCreateError(undefined)
          }}
          onSubmit={handleCreateCategory}
          errorMessage={createError}
        />
      )}
    </div>
  )
}

export default IndexTab
