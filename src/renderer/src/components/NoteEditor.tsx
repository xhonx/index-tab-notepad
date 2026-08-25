import { useEffect, useRef } from 'react'
import { useEditor, EditorContent, Node, nodeInputRule } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'

const AUTOSAVE_DEBOUNCE_MS = 500 // PRD 10장 비기능 요구사항

// PRD 7.3① — "---섹션명---" (또는 라벨 없는 "---"만) 입력 시 Notion 스타일 구분선으로 자동 변환.
// StarterKit 기본 HorizontalRule은 대시 3개만 typing해도 즉시 <hr>로 바꿔버려서
// "---LAB---"처럼 뒤에 라벨을 더 입력할 기회 자체가 없어짐 -> 아래에서 horizontalRule을 꺼두고
// 이 노드가 라벨 있는/없는 경우를 모두 처리한다.
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
  addInputRules() {
    return [
      // 대시 3개 이상 + 라벨 + 대시 3개 이상 ("---LAB---" 형태)
      nodeInputRule({
        find: /^-{3,}\s*([^-\n]+?)\s*-{3,}\s$/,
        type: this.type,
        getAttributes: (match) => ({ label: (match[1] ?? '').trim() })
      }),
      // 라벨 없이 대시만 3개 이상 ("---"만 입력)
      nodeInputRule({
        find: /^-{3,}\s$/,
        type: this.type,
        getAttributes: () => ({ label: '' })
      })
    ]
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

  // 언마운트 시 대기 중인 디바운스 저장을 즉시 반영 (탭 삭제/앱 종료 직전 유실 방지)
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  return (
    <div className="note-editor">
      <EditorContent editor={editor} />
    </div>
  )
}

export default NoteEditor
