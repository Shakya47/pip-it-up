import { PipWrapper, PipTrigger } from '@pip-it-up/react'

export default function FixedSizeDemo() {
  return (
    <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-xl flex justify-center">
      <PipWrapper 
        width={400}
        height={300}
        fixedSize={true}
      >
        <div className="w-[400px] h-[300px] border-4 border-dashed border-gray-400 flex flex-col items-center justify-center p-4 relative bg-white dark:bg-gray-800">
          <p className="text-center font-mono text-xl">400x300 Fixed</p>
          <PipTrigger className="absolute bottom-4 right-4 px-4 py-2 bg-black dark:bg-white dark:text-black text-white rounded font-bold cursor-pointer">
            Open Fixed PiP
          </PipTrigger>
        </div>
      </PipWrapper>
    </div>
  )
}
