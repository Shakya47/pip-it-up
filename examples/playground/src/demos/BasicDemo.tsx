import { useEffect, useState } from 'react'
import { PipWrapper, PipTrigger, usePipContext, useAutoPip } from '@pip-it-up/react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { DocsLink } from '../components/DocsLink'

function RichEditor({ content, onUpdate }: { content: string; onUpdate: (html: string) => void }) {
  const { instance, state } = usePipContext()
  const [autoPip, setAutoPip] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  // Drop `enabled` to make this always on, as this demo did before the checkbox.
  useAutoPip(instance.open, {
    enabled: autoPip,
    when: () => !state.isOpen,
    onResult: (r) =>
      setStatus(
        r.ok
          ? `Popped out automatically (${r.grantedBy}).`
          : r.hadActivation
            ? `Blocked: ${r.error.name}.`
            : 'Blocked: no click or keystroke in the last ~5s to authorise it.'
      ),
  })

  const editor = useEditor({
    extensions: [StarterKit],
    content,
    onUpdate: ({ editor }) => onUpdate(editor.getHTML()),
  })

  // The editor's DOM node survives the move to the PiP document untouched, but ProseMirror caches
  // the document it resolved for selection reads (`EditorView._root`), so selection would still be
  // read from the opener. `updateRoot()` is ProseMirror's own invalidation for a view that has
  // moved documents — and unlike recreating the editor, it keeps the undo history.
  useEffect(() => {
    editor?.view.updateRoot()
  }, [editor, state.pipWindow])

  return (
    <div className="flex flex-col gap-3">
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 min-h-[100px] bg-white dark:bg-gray-900 text-left">
        <EditorContent editor={editor} />
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer text-left">
        <input
          type="checkbox"
          checked={autoPip}
          onChange={(e) => {
            setAutoPip(e.target.checked)
            setStatus(null)
          }}
          className="cursor-pointer"
        />
        <span>
          <strong>Auto-PiP on tab switch.</strong> Tick this, then switch tabs within ~5s of your
          last click or keystroke — the browser only permits the pop-out that soon after you
          interact. Pause to think first and nothing happens.
        </span>
      </label>

      {status && (
        <p className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-left">
          {status}
        </p>
      )}
    </div>
  )
}

export default function BasicDemo() {
  const [html, setHtml] = useState('<p>Hello World! 🌎️</p>')

  return (
    <PipWrapper>
      <div className="border border-gray-200 dark:border-gray-700 p-4 rounded-xl shadow-md bg-white dark:bg-gray-800 flex flex-col gap-4">
        <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-3">
          <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200">
            Rich Text Editor
          </h3>
          <PipTrigger className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium rounded-lg text-sm transition-all duration-200 shadow-sm cursor-pointer whitespace-nowrap" />
        </div>

        <RichEditor content={html} onUpdate={setHtml} />

        <div className="border-t border-gray-100 dark:border-gray-700 pt-3 flex items-center justify-end">
          <DocsLink file="packages/react/README.md" anchor="automatic-pip">
            Automatic PiP docs
          </DocsLink>
        </div>
      </div>
    </PipWrapper>
  )
}
