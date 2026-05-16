import { PipWrapper, PipTrigger } from '@pip-it-up/react'

import { ViewSourceLink } from '../components/ViewSourceLink'

export default function DecoupledDemo() {
  return (
    <section className="border rounded-lg p-6 flex flex-col gap-4 relative">
      <div className="flex flex-col items-center text-center">
        <h2 className="text-2xl font-semibold">4. Decoupled Trigger</h2>
        <p className="text-gray-500">A remote trigger controlling a distant wrapper via a unique ID.</p>
      </div>
      <div className="absolute top-6 right-6">
        <ViewSourceLink file="examples/playground/src/demos/DecoupledDemo.tsx" />
      </div>
      
      <div className="p-4 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 mb-4">
        <p className="mb-2">This button controls the PiP below:</p>
        <PipTrigger pipId="decoupled-demo" className="px-4 py-2 bg-blue-500 text-white rounded">
          Remote Trigger
        </PipTrigger>
      </div>

      <PipWrapper id="decoupled-demo">
        <div className="border p-8 rounded-xl bg-gray-50 dark:bg-gray-800 text-center">
          <h3 className="text-lg font-bold mb-2">I am the target!</h3>
          <p>I can be opened from anywhere.</p>
        </div>
      </PipWrapper>
    </section>
  )
}
