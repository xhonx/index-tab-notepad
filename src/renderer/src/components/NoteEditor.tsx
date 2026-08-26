import { useEffect, useRef } from 'react'
import { useEditor, EditorContent, Node } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'

const AUTOSAVE_DEBOUNCE_MS = 500 // PRD 10장 비기능 요구사항

// "---텍스트---" (또는 라벨 없이 "---"만) 전체가 한 줄을 이룰 때만 매치.
// 줄 앞뒤 공백은 트리밍 후 비교하므로 "---LAB--- " 처럼 끝에 스페이스가 남아있어도 인식된다.
const LABELED_DIVIDER_RE = /^-{3,}\s*([^-\n]+?)\s*-{3,}$/
const BARE_DIVIDER_RE = /^-{3,}$/

// PRD 7.3① — "---섹션명---" 입력 후 Enter 시 Notion 스타일 구분선으로 자동 변환.
// 처음엔 nodeInputRule(스페이스바가 입력될 때 매치)로 구현했었는데, PRD가 말하는 트리거는
// "입력 후 Enter"라 스페이스 없이 바로 Enter를 치면 규칙이 아예 안 맞아서 대시가 그대로 남는
// 버그가 있었음(사용자 리포트) -> Enter 키를 직접 가로채서 "현재 줄 전체 텍스트"가 패턴과
// 일치하는지 검사하는 방식으로 교체. 이러면 스페이스 유무와 무관하게 항상 동작한다.
//
// StarterKit 기본 HorizontalRule도 이유는 다르지만 같은 부류 문제(대시 3개만 쳐도 즉시 <hr>로
// 바뀌어 라벨을 더 입력할 기회가 없음)라서 꺼두고(horizontalRule: false) 이 노드로 통일한다.
const SectionDivider = Node.create({
  name: 'sectionDivider',
  group: 'block',
  atom: true,
  addAttributes() {
    return { label: { default: '' } }
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-section-divider]',
        getAttrs: (el) => ({ label: (el as HTMLElement).getAttribute('data-label') ?? '' })
      }
    ]
  },
  renderHTML({ node }) {
    return [
      'div',
      { 'data-section-divider': '', class: 'section-divider', 'data-label': node.attrs.label }
    ]
  },
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        // IME(한글 등) 조합 중에 Enter가 조합 확정 용도로 쓰이는 경우까지 가로채지 않도록 방어
        if (editor.view.composing) return false

        const { selection } = editor.state
        const { $from, empty } = selection
        if (!empty || $from.parent.type.name !== 'paragraph') return false

        const text = $from.parent.textContent.trim()
        const labeled = text.match(LABELED_DIVIDER_RE)
        const isBare = !labeled && BARE_DIVIDER_RE.test(text)
        if (!labeled && !isBare) return false

        const label = labeled ? labeled[1].trim() : ''
        const from = $from.before()
        const to = $from.after()

        // 현재 줄(문단) 전체를 구분선 노드로 교체하고, 그 뒤에 이어서 쓸 수 있게 빈 문단을 하나 붙임
        editor
          .chain()
          .focus()
          .deleteRange({ from, to })
          .insertContentAt(from, [{ type: this.name, attrs: { label } }, { type: 'paragraph' }])
          .run()

        return true
      }
    }
  }
})

interface NoteEditorProps {
  // 카테고리 메모(category_notes)든 Today Todo(daily_notes)든 이 컴포넌트는 신경 안 쓰고,
  // 호출부(IndexTab.tsx)가 어디서 읽고/어디에 쓸지만 넘겨준다.
  storageKey: string
  loadContent: () => Promise<string>
  saveContent: (content: string) => Promise<void>
}

function NoteEditor({ storageKey, loadContent, saveContent }: NoteEditorProps): React.JSX.Element {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveContentRef = useRef(saveContent)
  // 렌더 중에 ref를 직접 mutate하지 않고, 커밋 이후(effect)에 최신 콜백으로 동기화
  useEffect(() => {
    saveContentRef.current = saveContent
  })

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ horizontalRule: false }),
      TaskList,
      // 기본 입력 규칙(/^\s*(\[([( |x])?\])\s$/)이 이미 사용자가 쓰던 "[] 할일" 패턴을 인식함
      TaskItem.configure({ nested: false }),
      SectionDivider
    ],
    content: '',
    onUpdate: ({ editor: updatedEditor }) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        saveContentRef.current(updatedEditor.getHTML())
      }, AUTOSAVE_DEBOUNCE_MS)
    }
  })

  // storageKey(카테고리 id 또는 날짜)가 바뀔 때마다 해당 문서를 불러와 채움
  useEffect(() => {
    if (!editor) return

    let cancelled = false
    loadContent().then((content) => {
      if (cancelled) return
      editor.commands.setContent(content, { emitUpdate: false })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- storageKey가 사실상의 identity, load/saveContent는 호출부에서 매 렌더 새로 만들어지는 클로저라 deps에 넣으면 무한 재로드됨
  }, [editor, storageKey])

  // 언마운트 시 대기 중인 디바운스 저장을 즉시 반영 (탭/메모 전환·리스트뷰 복귀 시 최대 500ms 유실 방지).
  // 기존엔 clearTimeout만 하고 끝내서 "즉시 반영"이라는 주석과 달리 실제로는 저장을 취소해버리는 버그였음
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
        if (editor && !editor.isDestroyed) saveContentRef.current(editor.getHTML())
      }
    }
  }, [editor])

  return (
    <div className="note-editor">
      <EditorContent editor={editor} />
    </div>
  )
}

export default NoteEditor
