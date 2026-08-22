import { useState } from 'react'

// PRD 9장 모달 목업의 프리셋 팔레트(🔴🟠🟡🟢🔵🟣)에 대응하는 hex 값
const PRESET_COLORS = ['#f87171', '#fb923c', '#fde047', '#4ade80', '#60a5fa', '#c084fc']

interface CategoryModalProps {
  onCancel: () => void
  onSubmit: (name: string, color: string) => void
  errorMessage?: string
}

function CategoryModal({
  onCancel,
  onSubmit,
  errorMessage
}: CategoryModalProps): React.JSX.Element {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onSubmit(trimmed, color)
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        borderRadius: '8px 0 0 8px'
      }}
      onMouseDown={onCancel} // 모달 바깥(오버레이) 클릭 시 취소
    >
      <form
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          background: 'white',
          borderRadius: 10,
          padding: 16,
          width: 220,
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}
      >
        <h4 style={{ margin: 0, fontSize: 14 }}>새 카테고리 추가</h4>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="카테고리 이름"
          style={{
            padding: '6px 8px',
            border: '1px solid #ddd',
            borderRadius: 6,
            fontSize: 13,
            outline: 'none'
          }}
        />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {PRESET_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setColor(c)}
              title={c}
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: c,
                border: color === c ? '2px solid #333' : '2px solid transparent',
                cursor: 'pointer',
                padding: 0
              }}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            title="커스텀 색상"
            style={{ width: 20, height: 20, padding: 0, border: 'none', cursor: 'pointer' }}
          />
        </div>
        {errorMessage && (
          <p style={{ color: '#e11d48', fontSize: 11, margin: 0 }}>{errorMessage}</p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              fontSize: 12,
              padding: '5px 10px',
              border: '1px solid #ddd',
              borderRadius: 6,
              background: 'white',
              cursor: 'pointer'
            }}
          >
            취소
          </button>
          <button
            type="submit"
            style={{
              fontSize: 12,
              padding: '5px 10px',
              border: 'none',
              borderRadius: 6,
              background: '#333',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            추가
          </button>
        </div>
      </form>
    </div>
  )
}

export default CategoryModal
