import { useState } from 'react'
import { PipWrapper, PipTrigger } from '@pip-it-up/react'
import Editor from '@monaco-editor/react'

export default function MonacoDemo() {
  const [code, setCode] = useState("// Write some code\nconsole.log('Hello from Monaco!');\n")

  // No `onPipWindowReady` workaround here any more.
  //
  // Previously this demo had to call `editor.layout()` on a timeout after the PiP window
  // opened, and re-layout on every PiP resize, because opening PiP unmounted and remounted
  // the editor's DOM. Monaco came back with a stale zero-size layout and an empty undo stack.
  //
  // `<PipWrapper>` now hosts its children in a single portal whose container never changes,
  // and moves that container between documents with native DOM APIs. The editor's DOM node,
  // its model, its undo history and its scroll position are the same objects before and after.
  // `automaticLayout: true` below uses Monaco's own ResizeObserver, which keeps observing the
  // element across the document move, so the relayout happens without our help.
  return (
    <PipWrapper>
      <div className="border p-4 rounded-md shadow-sm bg-white dark:bg-gray-800 text-center">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium">Code Editor</h3>
          <PipTrigger className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600" />
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-lg p-3 mb-3 text-left text-xs text-blue-800 dark:text-blue-300">
          <strong>Try this:</strong> type a few lines, then pop out. Your text, cursor position
          and undo history (<kbd>Cmd/Ctrl+Z</kbd>) all survive the move.
        </div>
        <div className="h-[200px] border rounded-md overflow-hidden">
          <Editor
            defaultLanguage="javascript"
            value={code}
            onChange={(value) => setCode(value || '')}
            options={{
              minimap: { enabled: false },
              automaticLayout: true,
            }}
          />
        </div>
      </div>
    </PipWrapper>
  )
}
