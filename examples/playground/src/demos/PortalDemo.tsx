import { useState } from 'react'
import { PipWrapper, PipTrigger } from '@pip-it-up/react'

export default function PortalDemo() {
  const [count, setCount] = useState(0)

  return (
    <section className="border rounded-lg p-6 flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">7. Portal mode</h2>
      <p className="text-gray-500 mb-4">mode="portal" with state mutations to prove single React tree.</p>
      
      <div className="mb-4">
        <p>Count from outside: {count}</p>
        <button onClick={() => setCount(c => c + 1)} className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded mt-2">+1 Outside</button>
      </div>

      <PipWrapper mode="portal">
        <div className="border p-6 rounded-md shadow-sm bg-white dark:bg-gray-800">
          <div className="flex flex-col items-center gap-4">
            <p className="text-lg">Count inside portal: <strong className="text-blue-500">{count}</strong></p>
            <div className="flex gap-2">
              <button onClick={() => setCount(c => c + 1)} className="px-4 py-2 bg-blue-500 text-white rounded">+1 Inside</button>
              <PipTrigger className="px-4 py-2 border border-gray-300 rounded">Toggle PiP</PipTrigger>
            </div>
          </div>
        </div>
      </PipWrapper>
    </section>
  )
}
