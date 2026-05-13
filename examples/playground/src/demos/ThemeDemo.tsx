import { useTheme } from 'next-themes'
import { PipWrapper, PipTrigger } from '@pip-it-up/react'
import { useEffect, useState } from 'react'

export default function ThemeDemo() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  return (
    <section className="border rounded-lg p-6 flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">4. Dynamic theme toggle</h2>
      <p className="text-gray-500 mb-4">exercises copyStyles="sync" via data-theme attribute.</p>
      
      <div className="flex items-center gap-4 mb-4">
        <button 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md"
        >
          Toggle Theme ({theme})
        </button>
      </div>

      <PipWrapper copyStyles="sync">
        <div className="border p-4 rounded-md shadow-sm bg-white dark:bg-gray-800 text-black dark:text-white transition-colors">
          <div className="flex justify-between items-center">
            <span>Theme-aware content</span>
            <PipTrigger className="px-3 py-1 bg-blue-500 text-white rounded">
              Toggle PiP
            </PipTrigger>
          </div>
        </div>
      </PipWrapper>
    </section>
  )
}
