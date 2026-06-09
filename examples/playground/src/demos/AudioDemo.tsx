import { PipWrapper, PipTrigger } from '@pip-it-up/react'

export default function AudioDemo() {
  return (
    <PipWrapper>
      <div className="border border-gray-200 dark:border-gray-700 p-4 rounded-xl shadow-md bg-white dark:bg-gray-800 text-center flex flex-col gap-4">
        <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-3">
          <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200">Audio Player</h3>
          <PipTrigger className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium rounded-lg text-sm transition-all duration-200 shadow-sm cursor-pointer" />
        </div>

        <div className="flex flex-col items-start gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Audio Stream</span>
          <audio
            src="/video-demo.mp4"
            controls
            className="w-full"
          />
        </div>
      </div>
    </PipWrapper>
  )
}
