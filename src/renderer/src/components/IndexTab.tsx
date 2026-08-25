import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Category } from '../../../main/db'
import CategoryModal from './CategoryModal'
import NoteEditor from './NoteEditor'

const TAB_WIDTH_PX = 32
const PANEL_WIDTH_PX = 360
const TOTAL_WIDTH_PX = TAB_WIDTH_PX + PANEL_WIDTH_PX
const PANEL_PADDING_PX = 16
// 탭 스택이 패널 위(zIndex 2)에 얹혀서 오른쪽 TAB_WIDTH_PX만큼을 가리기 때문에,
// 패널 안쪽 콘텐츠가 그 밑으로 들어가 겹치지 않도록 오른쪽에 탭 폭만큼 여백을 더 준다.
const PANEL_CONTENT_PADDING = `${PANEL_PADDING_PX}px ${PANEL_PADDING_PX + TAB_WIDTH_PX}px ${PANEL_PADDING_PX}px ${PANEL_PADDING_PX}px`

// windowManager.ts의 MAX_CATEGORIES와 동일하게 유지할 것 (창 크기 상한 계산 기준)
const MAX_CATEGORIES = 5

// IPC invoke 에러는 "Error invoking remote method '...': Error: <메시지>" 형태로 오므로 메시지만 추출
function extractErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  const marker = 'Error: '
  const idx = message.lastIndexOf(marker)
  return idx >= 0 ? message.slice(idx + marker.length) : message
}

function IndexTab(): React.JSX.Element {
  const isDraggingRef = useRef(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [activeCategoryId, setActiveCategoryId] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [createError, setCreateError] = useState<string | undefined>(undefined)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // SQLite에 저장된 카테고리 목록을 최초 1회 로드
  useEffect(() => {
    window.dbAPI.listCategories().then((cats) => {
      setCategories(cats)
      setActiveCategoryId((prev) => prev || cats[0]?.id || '')
    })
  }, [])

  // 카테고리 개수가 바뀔 때마다 메인 프로세스에 알림 (접힘 상태 창 크기 계산용)
  useEffect(() => {
    window.tabAPI.updateTabCount(categories.length)
  }, [categories.length])

  // 클릭 아웃(창 포커스 아웃) 시 메인 프로세스가 접힘을 요청하면 반영 (Pin 상태면 메인에서 아예 안 보냄)
  useEffect(() => {
    return window.tabAPI.onForceCollapse(() => setIsExpanded(false))
  }, [])

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

  const handleTabClick = (categoryId: string): void => {
    if (isDraggingRef.current) return

    if (!isExpanded) {
      setActiveCategoryId(categoryId)
      setIsExpanded(true)
      window.tabAPI.expandWindow()
    } else if (categoryId === activeCategoryId) {
      setIsExpanded(false) // 같은 탭 다시 클릭 → 접힘 (collapseWindow는 애니메이션 종료 후 호출됨)
    } else {
      setActiveCategoryId(categoryId) // 다른 탭 클릭 → 창 크기 그대로, 내용만 전환
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
    setCategories((prev) => {
      const next = prev.filter((c) => c.id !== id)
      if (activeCategoryId === id) {
        setActiveCategoryId(next[0]?.id ?? '')
      }
      return next
    })
  }

  const activeCategory = categories.find((c) => c.id === activeCategoryId)

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
        {isExpanded && activeCategory && (
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
              {renamingId === activeCategory.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(activeCategory.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(activeCategory.id)
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    border: '1px solid #ddd',
                    borderRadius: 4,
                    padding: '2px 4px',
                    color: activeCategory.color,
                    outline: 'none'
                  }}
                />
              ) : (
                <h3
                  onDoubleClick={() => startRename(activeCategory)}
                  title="더블클릭하면 이름을 바꿀 수 있어요"
                  style={{ margin: 0, color: activeCategory.color, cursor: 'text' }}
                >
                  {activeCategory.name}
                </h3>
              )}

              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
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

                {confirmDeleteId === activeCategory.id ? (
                  <>
                    <button
                      onClick={() => handleDeleteCategory(activeCategory.id)}
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
                    onClick={() => setConfirmDeleteId(activeCategory.id)}
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
                )}
              </div>
            </div>

            {/* key로 강제 리마운트: 카테고리 전환 시 에디터 내부 상태(히스토리 등)를 깔끔하게 초기화 */}
            <NoteEditor key={activeCategory.id} categoryId={activeCategory.id} />
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
        {categories.map((cat) => (
          <div
            key={cat.id}
            onMouseDown={handleMouseDown}
            onClick={() => handleTabClick(cat.id)}
            style={{
              flex: 1,
              background: cat.color,
              opacity: isExpanded && cat.id !== activeCategoryId ? 0.6 : 1,
              borderRadius: '8px 0 0 8px',
              borderBottom: '1px solid rgba(255,255,255,0.4)',
              cursor: 'grab',
              userSelect: 'none'
            }}
          />
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
