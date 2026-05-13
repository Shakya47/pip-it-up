import { PipWrapper, PipTrigger } from '@pip-it-up/react'

export default function TailwindDemo() {
  return (
    <section className="border rounded-lg p-6 flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">3. Tailwind-styled modal</h2>
      <p className="text-gray-500 mb-4">verifies html/body class copying.</p>
      
      <PipWrapper>
        <div className="p-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white shadow-lg">
          <h3 className="text-xl font-bold mb-2">Tailwind is awesome!</h3>
          <p className="mb-4">This gradient and typography should look the same inside PiP.</p>
          <PipTrigger className="px-4 py-2 bg-white text-purple-600 font-semibold rounded-lg shadow hover:bg-gray-100 transition-colors">
            Open PiP
          </PipTrigger>
        </div>
      </PipWrapper>
    </section>
  )
}
