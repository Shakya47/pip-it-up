import { useState } from 'react'
import { PipWrapper, PipTrigger } from '@pip-it-up/react'
import Editor from '@monaco-editor/react'

export default function MonacoDemo() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editor, setEditor] = useState<any>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditorDidMount = (editor: any) => {
    setEditor(editor)
  }

  const handlePipReady = (pipWindow: Window) => {
    // Wait a tick for DOM to settle, then layout
    setTimeout(() => {
      if (editor) editor.layout()
    }, 10)
    // Also listen to resize
    const onResize = () => editor && editor.layout()
    pipWindow.addEventListener('resize', onResize)
    return () => pipWindow.removeEventListener('resize', onResize)
  }

  return (
    <section className="border rounded-lg p-6 flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">2. Monaco editor in PiP</h2>
      <p className="text-gray-500 mb-4">uses onPipWindowReady to call editor.layout()</p>
      
      <PipWrapper onPipWindowReady={handlePipReady}>
        <div className="border p-4 rounded-md shadow-sm bg-white dark:bg-gray-800">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Code Editor</h3>
            <PipTrigger className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">
              Toggle PiP
            </PipTrigger>
          </div>
          <div className="h-[200px] border rounded-md overflow-hidden">
            <Editor
              defaultLanguage="javascript"
              defaultValue="// Write some code"
              onMount={handleEditorDidMount}
              options={{ minimap: { enabled: false } }}
            />
          </div>
        </div>
      </PipWrapper>
    </section>
  )
}
