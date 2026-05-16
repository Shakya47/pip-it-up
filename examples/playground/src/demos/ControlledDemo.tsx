import { useState } from 'react'
import { PipWrapper } from '@pip-it-up/react'

import { ViewSourceLink } from '../components/ViewSourceLink'

export default function ControlledDemo() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <section className="border rounded-lg p-6 flex flex-col gap-4 relative">
      <div className="flex flex-col items-center text-center">
        <h2 className="text-2xl font-semibold">5. Controlled State</h2>
        <p className="text-gray-500">External React state driving the open/closed status of the PiP window.</p>
      </div>
      <div className="absolute top-6 right-6">
        <ViewSourceLink file="examples/playground/src/demos/ControlledDemo.tsx" />
      </div>
      
      <div className="mb-4">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          {isOpen ? 'Close PiP via state' : 'Open PiP via state'}
        </button>
      </div>

      <PipWrapper 
        open={isOpen} 
        onOpenChange={setIsOpen}
      >
        <div className="border p-6 rounded-md bg-green-50 dark:bg-green-900/20 text-center">
          <p className="font-medium text-green-800 dark:text-green-200">
            My visibility is strictly controlled by React state.
          </p>
        </div>
      </PipWrapper>
    </section>
  )
}
