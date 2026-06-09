import { useState } from 'react'
import { PipWrapper } from '@pip-it-up/react'

export default function ControlledDemo() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <div className="text-left">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="px-4 py-2 bg-green-500 text-white rounded cursor-pointer"
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
    </div>
  )
}
