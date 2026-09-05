import { useEffect, useMemo, useRef, useState } from 'react'
import {
  PipProvider,
  PipAnchor,
  PipTrigger,
  useDormancy,
  useAdaptiveInterval,
  useVideoPip,
} from '@pip-it-up/react'
import { IframeGuard } from './components/IframeGuard'
import { ViewSourceLink } from './components/ViewSourceLink'
import { DocsLink } from './components/DocsLink'

/* --- A dependency-free hash router. Any router works: the mechanism is only that a route change
       unmounts one <PipAnchor> and mounts another. --- */

const ROUTES = [
  { path: 'dashboard', label: 'Dashboard' },
  { path: 'reports', label: 'Reports' },
  { path: 'settings', label: 'Settings' },
] as const

type RoutePath = (typeof ROUTES)[number]['path']

function parseHash(): RoutePath {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0]
  return ROUTES.find((r) => r.path === raw)?.path ?? 'dashboard'
}

function useHashRoute() {
  const [route, setRoute] = useState<RoutePath>(parseHash)
  useEffect(() => {
    const onHashChange = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  return { route, navigate: (p: RoutePath) => { window.location.hash = `#/${p}` } }
}

/* --- Persistent widget 1: a timer that throttles itself when parked --- */

function LiveTracker() {
  const [seconds, setSeconds] = useState(0)
  const { level, placement } = useDormancy()

  useAdaptiveInterval(() => setSeconds((n) => n + 1))

  return (
    <div className="h-full border border-gray-200 dark:border-gray-700 p-4 rounded-xl shadow-md bg-white dark:bg-gray-800 flex flex-col gap-3">
      <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-3">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">Live Tracker</h3>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          {level}
        </span>
      </div>
      <div className="font-mono text-4xl tabular-nums text-gray-900 dark:text-gray-100 text-center">
        {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">{placement}</p>
    </div>
  )
}

/* --- Persistent widget 2: a video that can also pop out natively --- */

function PersistentVideo() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { isActive, toggle } = useVideoPip(videoRef)

  return (
    <div className="h-full border border-gray-200 dark:border-gray-700 p-4 rounded-xl shadow-md bg-white dark:bg-gray-800 flex flex-col gap-3">
      <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-3">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">Video</h3>
        <button
          onClick={() => void toggle()}
          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md text-xs shadow-sm cursor-pointer whitespace-nowrap"
        >
          {isActive ? '⊠ Exit' : '↗ Native PiP'}
        </button>
      </div>
      <video
        ref={videoRef}
        src="/video-demo.mp4"
        controls
        loop
        muted
        playsInline
        className="w-full aspect-video object-cover rounded-lg bg-black"
      />
    </div>
  )
}

function Placeholder({ label }: { label: string }) {
  return (
    <div className="h-full w-full rounded-xl border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 text-center px-3">
      📺 {label} is in PiP
    </div>
  )
}

/* --- Routes. Only Dashboard renders anchors; the others need no PiP code at all. --- */

function Filler({ label }: { label: string }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 text-left">
      {label}
    </div>
  )
}

const ROUTE_META: Record<RoutePath, { title: string; description: string }> = {
  dashboard: {
    title: 'Dashboard',
    description: 'The only route that renders anchors. Both widgets live here.',
  },
  reports: {
    title: 'Reports',
    description: 'An ordinary page with no PiP code. A popped-out window keeps floating above it.',
  },
  settings: {
    title: 'Settings',
    description: 'Another ordinary page. Adopting route-persistent PiP required no change here.',
  },
}

export default function RoutePersistentPage() {
  const { route, navigate } = useHashRoute()

  const registry = useMemo(
    () => ({ tracker: <LiveTracker />, video: <PersistentVideo /> }),
    []
  )

  const meta = ROUTE_META[route]

  return (
    // In a real app this lives at the application root: app/layout.tsx, pages/_app.tsx, or above
    // <Routes>. It must outlive every route it serves.
    <PipProvider registry={registry}>
      <div className="w-full max-w-4xl mx-auto px-4 py-8 md:px-8 md:py-12 space-y-8 md:space-y-12">
        <IframeGuard />

        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Route-Persistent PiP</h1>
            <p className="text-base md:text-lg text-gray-600 dark:text-gray-400">
              Widgets mounted once at the app root, docking into different routes
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PipTrigger
              pipId="tracker"
              className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg text-sm shadow-sm cursor-pointer whitespace-nowrap"
            />
            <a
              href="#"
              className="px-3.5 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white text-sm font-medium shadow-sm transition-all whitespace-nowrap"
            >
              ← Playground
            </a>
          </div>
        </header>

        <nav
          aria-label="Routes"
          className="flex flex-wrap justify-center gap-1 p-1.5 border rounded-xl bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800"
        >
          {ROUTES.map((r) => (
            <button
              key={r.path}
              onClick={() => navigate(r.path)}
              aria-current={route === r.path ? 'page' : undefined}
              className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-colors cursor-pointer ${
                route === r.path
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </nav>

        <section className="group relative border rounded-xl p-6 flex flex-col gap-4 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <div className="absolute top-4 right-4 z-10">
            <ViewSourceLink file="examples/playground/src/RoutePersistentPage.tsx" />
          </div>

          <div className="flex flex-col items-center text-center">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-teal-500 to-indigo-600 bg-clip-text text-transparent">
              {meta.title}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-lg mt-1 text-sm md:text-base">
              {meta.description}
            </p>
          </div>

          <div className="max-w-xl mx-auto w-full flex flex-col gap-4">
            {route === 'dashboard' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PipAnchor
                  id="tracker"
                  placeholder={<Placeholder label="Tracker" />}
                  className="min-h-[210px]"
                />
                <PipAnchor
                  id="video"
                  placeholder={<Placeholder label="Video" />}
                  className="min-h-[210px]"
                />
              </div>
            ) : (
              <Filler label={`${meta.title} content. Completely unaware that PiP exists.`} />
            )}

            <Filler label="Content below the anchors. It stays put when a widget pops out." />
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-left">
              Pop out, switch routes, then come back — state is never lost.
            </p>
            <DocsLink file="packages/react/README.md" anchor="route-persistent-pip">
              Route-persistent PiP docs
            </DocsLink>
          </div>
        </section>
      </div>
    </PipProvider>
  )
}
