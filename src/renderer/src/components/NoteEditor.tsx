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
  categoryId: string
}

function NoteEditor({ categoryId }: NoteEditorProps): React.JSX.Element {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeCategoryIdRef = useRef(categoryId)

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
      const categoryIdAtEdit = activeCategoryIdRef.current
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        window.dbAPI.saveCategoryNote(categoryIdAtEdit, updatedEditor.getHTML())
      }, AUTOSAVE_DEBOUNCE_MS)
    }
  })

  // 카테고리를 전환할 때마다 해당 카테고리의 저장된 메모를 불러와 채움
  useEffect(() => {
    activeCategoryIdRef.current = categoryId
    if (!editor || !categoryId) return

    let cancelled = false
    window.dbAPI.getCategoryNote(categoryId).then((content) => {
      if (cancelled) return
      editor.commands.setContent(content, { emitUpdate: false })
    })
    return () => {
      cancelled = true
    }
  }, [editor, categoryId])

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
