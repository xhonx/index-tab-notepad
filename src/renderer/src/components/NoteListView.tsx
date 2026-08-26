import { useState } from 'react'
import type { CategoryNote } from '../../../main/db'

interface NoteListViewProps {
  notes: CategoryNote[]
  onOpenNote: (noteId: string) => void
  onCreateNote: () => void
  onDeleteNote: (noteId: string) => void
}

// 카테고리 안에 메모를 여러 개 두고 목록에서 골라 여는 뷰 (사용자 요청 — "카테고리별 메모장 리스트뷰")
function NoteListView({
  notes,
  onOpenNote,
  onCreateNote,
  onDeleteNote
}: NoteListViewProps): React.JSX.Element {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  return (
    <div
      style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
    >
      {notes.length === 0 && (
        <p style={{ color: '#999', fontSize: 13, margin: '8px 0' }}>
          아직 메모가 없어요. 아래 버튼으로 새 메모를 만들어보세요.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {notes.map((note) => (
          <div
            key={note.id}
            onClick={() => onOpenNote(note.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid #eee',
              cursor: 'pointer'
            }}
          >
            <span
              style={{
                fontSize: 13,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              📄 {note.title || '제목 없음'}
            </span>

            {confirmDeleteId === note.id ? (
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteNote(note.id)
                    setConfirmDeleteId(null)
                  }}
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
                  onClick={(e) => {
                    e.stopPropagation()
                    setConfirmDeleteId(null)
                  }}
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
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setConfirmDeleteId(note.id)
                }}
                title="메모 삭제"
                style={{
                  fontSize: 12,
                  padding: '3px 6px',
                  borderRadius: 6,
                  border: '1px solid #ddd',
                  background: 'white',
                  color: '#999',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                🗑
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={onCreateNote}
        style={{
          marginTop: 10,
          padding: '8px 10px',
          borderRadius: 6,
          border: '1px dashed #ccc',
          background: '#fafafa',
          color: '#666',
          cursor: 'pointer',
          fontSize: 13
        }}
      >
        ➕ 새 메모
      </button>
    </div>
  )
}

export default NoteListView
