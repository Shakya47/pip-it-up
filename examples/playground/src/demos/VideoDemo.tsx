import { useRef, useMemo } from 'react'
import { PipWrapper, PipTrigger } from '@pip-it-up/react'
import { isSupported, isVideoPipSupported, isWebkitPipSupported } from '@pip-it-up/core'

export default function VideoDemo() {
  const videoRef = useRef<HTMLVideoElement>(null)

  const supportType = useMemo(() => {
    if (typeof window === 'undefined') return 'Detecting...'
    if (isSupported()) return 'Document Picture-in-Picture'
    if (isVideoPipSupported() || isWebkitPipSupported()) return 'Classic Video Picture-in-Picture'
    return 'Not Supported'
  }, [])

  return (
    <PipWrapper>
      <div className="border border-gray-200 dark:border-gray-700 p-4 rounded-xl shadow-md bg-white dark:bg-gray-800 text-center flex flex-col gap-4">
        <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-3">
          <div className="text-left">
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200">Video Player</h3>
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 bg-gray-150 dark:bg-gray-700 px-2 py-0.5 rounded-full mt-1 inline-block">
              Mode: {supportType}
            </span>
          </div>
          <PipTrigger className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium rounded-lg text-sm transition-all duration-200 shadow-sm cursor-pointer" />
        </div>

        <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-inner bg-black">
          <video
            ref={videoRef}
            src="/video-demo.mp4"
            controls
            className="w-full aspect-video object-cover"
            poster="https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?auto=format&fit=crop&w=600&q=80"
          />
        </div>
      </div>
    </PipWrapper>
  )
}
