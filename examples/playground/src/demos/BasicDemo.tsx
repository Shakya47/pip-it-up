import { PipWrapper, PipTrigger } from '@pip-it-up/react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

export default function BasicDemo() {
  const editor = useEditor({
    extensions: [StarterKit],
    content: '<p>Hello World! 🌎️</p>',
  })

  return (
    <section className="border rounded-lg p-6 flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">1. Basic modal + editor</h2>
      <p className="text-gray-500 mb-4">co-located &lt;PipTrigger&gt;, default mode="move"</p>
      
      <PipWrapper mode="move">
        <div className="border p-4 rounded-md shadow-sm bg-white dark:bg-gray-800">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Rich Text Editor</h3>
            <PipTrigger className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
              Toggle PiP
            </PipTrigger>
          </div>
          <div className="border rounded-md p-2 min-h-[100px] bg-white dark:bg-gray-900">
            <EditorContent editor={editor} />
          </div>
        </div>
      </PipWrapper>
    </section>
  )
}
