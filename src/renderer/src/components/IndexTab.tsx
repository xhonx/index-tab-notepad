import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

// TODO(M3): SQLite categories 테이블 데이터로 교체
const DUMMY_CATEGORIES = [
  { id: 'lab', name: 'LAB', color: '#bad2f0' },
  { id: 'shielders', name: '쉴더스', color: '#ebdfab' },
  { id: 'personal', name: '개인공부', color: '#c1ecd1' }
]

const TAB_WIDTH_PX = 32
const PANEL_WIDTH_PX = 360
const TOTAL_WIDTH_PX = TAB_WIDTH_PX + PANEL_WIDTH_PX

function IndexTab() {
  const isDraggingRef = useRef(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeCategoryId, setActiveCategoryId] = useState(DUMMY_CATEGORIES[0].id)

  // 카테고리 개수가 바뀔 때마다 메인 프로세스에 알림 (접힘 상태 창 크기 계산용)
  useEffect(() => {
    window.tabAPI.updateTabCount(DUMMY_CATEGORIES.length)
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    isDraggingRef.current = true
    window.tabAPI.setIgnoreMouseEvents(false)
    window.tabAPI.startDrag()

    const handleMouseUp = () => {
      isDraggingRef.current = false
      window.tabAPI.stopDrag()
      window.removeEventListener('mouseup', handleMouseUp)
    }
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleTabClick = (categoryId: string) => {
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

  const activeCategory = DUMMY_CATEGORIES.find((c) => c.id === activeCategoryId)!
  const indexTapCnt = DUMMY_CATEGORIES.find((c) => c.id === activeCategoryId)?.color!

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
        {isExpanded && (
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
              borderRadius: '8px 0 0 8px', // 이제 패널 자체도 둥글게 줄 수 있음 (선택)
              boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
              zIndex: 1, // 탭보다 아래
              paddingRight: TAB_WIDTH_PX, // 탭 밑에 콘텐츠가 안 깔리게 여백
              padding: '16px 16px 16px 16px' // 탭 밑에 콘텐츠가 안 깔리게 여백
            }}
          >
            <h3 style={{ margin: 0, color: activeCategory.color }}>{activeCategory.name}</h3>
            <p style={{ color: '#999', fontSize: 13 }}>
              여기에 {activeCategory.name} 메모 에디터가 들어갈 예정 (TipTap, 다음 단계)
            </p>
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
        {DUMMY_CATEGORIES.map((cat) => (
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
      </div>
    </div>
  )
}

// const PANEL_WIDTH_PX = 360

export default IndexTab
