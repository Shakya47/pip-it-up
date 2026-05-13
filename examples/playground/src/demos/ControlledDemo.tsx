import { useState } from 'react'
import { PipWrapper } from '@pip-it-up/react'

export default function ControlledDemo() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <section className="border rounded-lg p-6 flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">6. Controlled mode</h2>
      <p className="text-gray-500 mb-4">external state drives open prop.</p>
      
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
        <div className="border p-6 rounded-md bg-green-50 dark:bg-green-900/20">
          <p className="font-medium text-green-800 dark:text-green-200">
            My visibility is strictly controlled by React state.
          </p>
        </div>
      </PipWrapper>
    </section>
  )
}
