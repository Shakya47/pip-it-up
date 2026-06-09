import { useEffect, useState } from 'react'
import { PipWrapper, PipTrigger } from '@pip-it-up/react'

export default function KeyboardShortcutDemo() {
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        setSavedAt(new Date().toLocaleTimeString())
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex flex-col gap-4">
      {savedAt && (
        <div className="p-3 bg-green-100 text-green-800 rounded-md font-medium text-left">
          Command intercepted! Last saved at: {savedAt}
        </div>
      )}

      <PipWrapper 
        forwardKeyboardEvents={true}
      >
        <div className="border p-8 rounded-xl bg-gray-50 dark:bg-gray-800 text-center shadow-inner">
          <h3 className="text-lg font-bold mb-4">Press Cmd+S (or Ctrl+S)</h3>
          <p className="mb-4">It should trigger the save action in the main window when you are inside PiP.</p>
          <PipTrigger className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors shadow cursor-pointer">
            Open PiP
          </PipTrigger>
        </div>
      </PipWrapper>
    </div>
  )
}
