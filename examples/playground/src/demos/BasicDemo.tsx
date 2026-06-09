import { useState } from 'react'
import { PipWrapper, PipTrigger, usePipContext } from '@pip-it-up/react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

function RichEditor({ content, onUpdate }: { content: string, onUpdate: (html: string) => void }) {
  const { isInsidePip } = usePipContext()
  
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    onUpdate: ({ editor }) => onUpdate(editor.getHTML()),
  }, [isInsidePip])

  return (
    <div className="border rounded-md p-2 min-h-[100px] bg-white dark:bg-gray-900 text-left">
      <EditorContent editor={editor} />
    </div>
  )
}

export default function BasicDemo() {
  const [html, setHtml] = useState('<p>Hello World! 🌎️</p>')

  return (
    <PipWrapper>
      <div className="border p-4 rounded-md shadow-sm bg-white dark:bg-gray-800 text-center">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium">Rich Text Editor</h3>
          <PipTrigger className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors" />
        </div>
        <RichEditor content={html} onUpdate={setHtml} />
      </div>
    </PipWrapper>
  )
}
