import { useEffect, useState } from 'react'
import type { DailyNoteSummary } from '../../../shared/types'

// 월요일 시작 (사용자 요청). Date.getDay()는 0=일~6=토라서 그대로 못 쓰고 아래 toMondayFirst로 변환해서 씀
const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']

// Date.getDay()의 0=일~6=토 인덱스를 0=월~6=일로 바꿔줌
function toMondayFirst(getDayResult: number): number {
  return (getDayResult + 6) % 7
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function toYearMonth(year: number, month0: number): string {
  return `${year}-${pad2(month0 + 1)}`
}

function toDateKey(year: number, month0: number, day: number): string {
  return `${year}-${pad2(month0 + 1)}-${pad2(day)}`
}

// Today Todo 전용 캘린더 뷰 (M6). PRD 13장 오픈이슈 결론에 따라 별도 창이 아니라 패널 안에서
// 화면 전환으로 보여주고, 과거 날짜는 읽기 전용으로만 조회한다. 카테고리별 캘린더는 별도 논의 후 진행 예정.
function CalendarView(): React.JSX.Element {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month0, setMonth0] = useState(today.getMonth()) // 0-based
  const [summaries, setSummaries] = useState<Record<string, DailyNoteSummary>>({})
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedContent, setSelectedContent] = useState('')

  useEffect(() => {
    let cancelled = false
    window.dbAPI.listDailyNotesMonth(toYearMonth(year, month0)).then((rows) => {
      if (cancelled) return
      const map: Record<string, DailyNoteSummary> = {}
      rows.forEach((row) => {
        map[row.date] = row
      })
      setSummaries(map)
    })
    return () => {
      cancelled = true
    }
  }, [year, month0])

  useEffect(() => {
    if (!selectedDate) return
    let cancelled = false
    window.dbAPI.getDailyNote(selectedDate).then((content) => {
      if (!cancelled) setSelectedContent(content)
    })
    return () => {
      cancelled = true
    }
  }, [selectedDate])

  const goToPrevMonth = (): void => {
    if (month0 === 0) {
      setYear((y) => y - 1)
      setMonth0(11)
    } else {
      setMonth0((m) => m - 1)
    }
  }

  const goToNextMonth = (): void => {
    if (month0 === 11) {
      setYear((y) => y + 1)
      setMonth0(0)
    } else {
      setMonth0((m) => m + 1)
    }
  }

  // 날짜 상세(읽기 전용) 뷰
  if (selectedDate) {
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setSelectedDate(null)}
            title="캘린더로"
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
          <strong style={{ fontSize: 13 }}>{selectedDate}</strong>
          <span style={{ fontSize: 11, color: '#999' }}>읽기 전용</span>
        </div>
        <div
          className="note-editor"
          style={{ pointerEvents: 'none' }}
          // 저장된 TipTap HTML을 그대로 보여줌 — 체크박스 등 폼 요소가 실제로 토글되지 않도록
          // pointer-events: none으로 막아둠 (클릭해도 저장 안 되는데 눌리는 것처럼 보이면 혼란스러우므로)
          dangerouslySetInnerHTML={{
            __html: selectedContent || '<p style="color:#bbb">이 날은 기록이 없어요.</p>'
          }}
        />
      </div>
    )
  }

  const daysInMonth = new Date(year, month0 + 1, 0).getDate()
  const startWeekday = toMondayFirst(new Date(year, month0, 1).getDay())
  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
  ]
  const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate())

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={goToPrevMonth}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14 }}
        >
          ◀
        </button>
        <strong style={{ fontSize: 13 }}>
          {year}년 {month0 + 1}월
        </strong>
        <button
          onClick={goToNextMonth}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14 }}
        >
          ▶
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          fontSize: 10,
          color: '#999',
          textAlign: 'center'
        }}
      >
        {WEEKDAY_LABELS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />
          const dateKey = toDateKey(year, month0, day)
          const summary = summaries[dateKey]
          const rate =
            summary && summary.total > 0
              ? Math.round((summary.checked / summary.total) * 100)
              : null
          const isToday = dateKey === todayKey

          return (
            <button
              key={dateKey}
              onClick={() => setSelectedDate(dateKey)}
              title={
                summary
                  ? `${summary.checked}/${summary.total} 완료${rate !== null ? ` (${rate}%)` : ''}`
                  : '기록 없음'
              }
              style={{
                aspectRatio: '1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                border: isToday ? '1px solid #333' : '1px solid transparent',
                borderRadius: 4,
                background:
                  rate === null ? '#f7f7f7' : `rgba(74, 222, 128, ${0.15 + (rate / 100) * 0.5})`,
                cursor: 'pointer',
                fontSize: 11,
                padding: 0,
                color: '#333'
              }}
            >
              <span>{day}</span>
              {rate !== null && <span style={{ fontSize: 8, color: '#16a34a' }}>{rate}%</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default CalendarView
