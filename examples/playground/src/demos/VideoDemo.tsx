import { useRef, useState } from 'react'
import { useVideoPip, useAutoPip } from '@pip-it-up/react'
import { DocsLink } from '../components/DocsLink'

export default function VideoDemo() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { isActive, toggle, enter } = useVideoPip(videoRef)

  const [autoPip, setAutoPip] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  // Drop `enabled` to make this always on, as the editor demo does.
  useAutoPip(enter, {
    enabled: autoPip,
    mediaSession: true,
    when: () => !!videoRef.current && !videoRef.current.paused,
    onResult: (r) =>
      setStatus(
        r.ok
          ? `Entered PiP (${r.grantedBy}).`
          : r.hadActivation
            ? `Blocked: ${r.error.name}.`
            : 'Blocked: no click in the last ~5s to authorise it.'
      ),
  })

  return (
    <div className="border border-gray-200 dark:border-gray-700 p-4 rounded-xl shadow-md bg-white dark:bg-gray-800 flex flex-col gap-4">
      <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-3">
        <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200">Native Video PiP</h3>
        <button
          onClick={() => void toggle()}
          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium rounded-lg text-sm transition-all duration-200 shadow-sm cursor-pointer whitespace-nowrap"
        >
          {isActive ? '⊠ Exit PiP' : '↗ Pop out video'}
        </button>
      </div>

      <video
        ref={videoRef}
        src="/video-demo.mp4"
        controls
        loop
        playsInline
        className="w-full aspect-video object-cover rounded-lg bg-black"
      />

      <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer text-left">
        <input
          type="checkbox"
          checked={autoPip}
          onChange={(e) => {
            setAutoPip(e.target.checked)
            setStatus(null)
          }}
          className="cursor-pointer"
        />
        <span>
          <strong>Auto-PiP on tab switch.</strong> Play the video, tick this, then switch tabs
          within ~5s of that click — the browser only permits the pop-out that soon after you
          interact. Watch for a minute first and nothing happens.
        </span>
      </label>

      {status && (
        <p className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-left">
          {status}
        </p>
      )}

      <div className="border-t border-gray-100 dark:border-gray-700 pt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-left">
          Only the video pops out, not this card.
        </p>
        <DocsLink file="packages/react/README.md" anchor="automatic-pip">
          Automatic PiP docs
        </DocsLink>
      </div>
    </div>
  )
}
