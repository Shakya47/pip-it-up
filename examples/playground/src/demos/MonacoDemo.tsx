import { useState, useRef } from 'react'
import { PipWrapper, PipTrigger } from '@pip-it-up/react'
import Editor from '@monaco-editor/react'
import type { OnMount } from '@monaco-editor/react'

import { ViewSourceLink } from '../components/ViewSourceLink'

export default function MonacoDemo() {
  const [code, setCode] = useState("// Write some code\nconsole.log('Hello from Monaco!');\n")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null)

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor
  }

  const handlePipReady = (pipWindow: Window) => {
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.layout()
        editorRef.current.focus()
      }
    }, 100)
    const onResize = () => editorRef.current && editorRef.current.layout()
    pipWindow.addEventListener('resize', onResize)
    return () => pipWindow.removeEventListener('resize', onResize)
  }

  return (
    <section className="border rounded-lg p-6 flex flex-col gap-4 relative">
      <div className="flex flex-col items-center text-center">
        <h2 className="text-2xl font-semibold">2. Monaco Editor</h2>
        <p className="text-gray-500">Uses controlled value and explicit layout calls to persist state across windows.</p>
      </div>
      <div className="absolute top-6 right-6">
        <ViewSourceLink file="examples/playground/src/demos/MonacoDemo.tsx" />
      </div>
      
      <PipWrapper onPipWindowReady={handlePipReady}>
        <div className="border p-4 rounded-md shadow-sm bg-white dark:bg-gray-800 text-center">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Code Editor</h3>
            <PipTrigger className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600" />
          </div>
          <div className="h-[200px] border rounded-md overflow-hidden">
            <Editor
              defaultLanguage="javascript"
              value={code}
              onChange={(value) => setCode(value || '')}
              onMount={handleEditorDidMount}
              options={{ 
                minimap: { enabled: false },
                automaticLayout: true,
              }}
            />
          </div>
        </div>
      </PipWrapper>
    </section>
  )
}
