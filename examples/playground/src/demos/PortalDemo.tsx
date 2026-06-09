import { useState } from 'react'
import { PipWrapper, PipTrigger } from '@pip-it-up/react'

export default function PortalDemo() {
  const [count, setCount] = useState(0)

  return (
    <div className="flex flex-col gap-4">
      <div className="text-left">
        <p>Count from outside: {count}</p>
        <button onClick={() => setCount(c => c + 1)} className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded mt-2 cursor-pointer">+1 Outside</button>
      </div>

      <PipWrapper>
        <div className="border p-6 rounded-md shadow-sm bg-white dark:bg-gray-800 text-center">
          <div className="flex flex-col items-center gap-4">
            <p className="text-lg">Count inside portal: <strong className="text-blue-500">{count}</strong></p>
            <div className="flex gap-2">
              <button onClick={() => setCount(c => c + 1)} className="px-4 py-2 bg-blue-500 text-white rounded cursor-pointer">+1 Inside</button>
              <PipTrigger className="px-4 py-2 border border-gray-300 rounded cursor-pointer" />
            </div>
          </div>
        </div>
      </PipWrapper>
    </div>
  )
}
