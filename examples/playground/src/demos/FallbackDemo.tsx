import { PipWrapper, PipTrigger } from '@pip-it-up/react'

export default function FallbackDemo() {
  return (
    <section className="border rounded-lg p-6 flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">8. Fallback demo</h2>
      <p className="text-gray-500 mb-4">simulate fallback behavior.</p>

      <div className="flex gap-4">
        <PipWrapper fallback="new-tab">
          <div className="border p-4 rounded-md flex-1">
            <p className="mb-2 font-medium">Fallback: New Tab</p>
            <PipTrigger className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600">
              Try PiP
            </PipTrigger>
          </div>
        </PipWrapper>

        <PipWrapper fallback="modal">
          <div className="border p-4 rounded-md flex-1">
            <p className="mb-2 font-medium">Fallback: Modal</p>
            <PipTrigger className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600">
              Try PiP
            </PipTrigger>
          </div>
        </PipWrapper>
      </div>
    </section>
  )
}
