import { PipWrapper, PipTrigger } from '@pip-it-up/react'

export default function TailwindDemo() {
  return (
    <PipWrapper>
      <div className="p-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white shadow-lg text-center">
        <h3 className="text-xl font-bold mb-2">Tailwind is awesome!</h3>
        <p className="mb-4">This gradient and typography should look the same inside PiP.</p>
        <PipTrigger className="px-4 py-2 bg-white text-purple-600 font-semibold rounded-lg shadow hover:bg-gray-100 transition-colors cursor-pointer">
          Open PiP
        </PipTrigger>
      </div>
    </PipWrapper>
  )
}
