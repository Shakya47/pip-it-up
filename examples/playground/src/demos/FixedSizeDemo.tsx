import { PipWrapper, PipTrigger } from '@pip-it-up/react'

import { ViewSourceLink } from '../components/ViewSourceLink'

export default function FixedSizeDemo() {
  return (
    <section className="border rounded-lg p-6 flex flex-col gap-4 relative">
      <div className="flex flex-col items-center text-center">
        <h2 className="text-2xl font-semibold">7. Fixed Component Size</h2>
        <p className="text-gray-500">Pins the component layout to specific dimensions inside the PiP window.</p>
      </div>
      <div className="absolute top-6 right-6">
        <ViewSourceLink file="examples/playground/src/demos/FixedSizeDemo.tsx" />
      </div>

      <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-xl flex justify-center">
        <PipWrapper 
          width={400}
          height={300}
          fixedSize={true}
        >
          <div className="w-[400px] h-[300px] border-4 border-dashed border-gray-400 flex flex-col items-center justify-center p-4 relative bg-white dark:bg-gray-800">
            <p className="text-center font-mono text-xl">400x300 Fixed</p>
            <PipTrigger className="absolute bottom-4 right-4 px-4 py-2 bg-black dark:bg-white dark:text-black text-white rounded font-bold">
              Open Fixed PiP
            </PipTrigger>
          </div>
        </PipWrapper>
      </div>
    </section>
  )
}
