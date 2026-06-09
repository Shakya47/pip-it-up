import { IframeGuard } from './components/IframeGuard'
import BasicDemo from './demos/BasicDemo'
import MonacoDemo from './demos/MonacoDemo'
import TailwindDemo from './demos/TailwindDemo'
import DecoupledDemo from './demos/DecoupledDemo'
import ControlledDemo from './demos/ControlledDemo'
import PortalDemo from './demos/PortalDemo'
import FixedSizeDemo from './demos/FixedSizeDemo'
import KeyboardShortcutDemo from './demos/KeyboardShortcutDemo'
import VideoDemo from './demos/VideoDemo'
import AudioDemo from './demos/AudioDemo'
import ScribbleDemo from './demos/ScribbleDemo'
import MapDemo from './demos/MapDemo'
import BuildProgressDemo from './demos/BuildProgressDemo'

interface DemoCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function DemoCard({ title, description, children }: DemoCardProps) {
  return (
    <section className="border rounded-xl p-6 flex flex-col gap-4 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 transition-colors">
      <div className="flex flex-col items-center text-center">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-teal-500 to-indigo-600 bg-clip-text text-transparent">
          {title}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-lg mt-1 text-sm md:text-base">
          {description}
        </p>
      </div>
      <div className="max-w-xl mx-auto w-full">
        {children}
      </div>
    </section>
  );
}

function App() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 md:px-8 md:py-12 space-y-12 md:space-y-16">
      <IframeGuard />

      <header className="mb-8 md:mb-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Pip-it-up Playground</h1>
          <p className="text-base md:text-lg text-gray-600 dark:text-gray-400">
            Demos and manual QA for @pip-it-up/react
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://codesandbox.io/p/sandbox/pip-it-up-test-xfng5n"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-85 transition-opacity"
          >
            <img 
              src="https://codesandbox.io/static/img/play-codesandbox.svg" 
              alt="Edit in CodeSandbox" 
              className="h-10"
            />
          </a>
        </div>
      </header>

      <DemoCard 
        title="1. TipTap Editor" 
        description="Portals preserve React state, but complex editors need a re-mount on window change."
      >
        <BasicDemo />
      </DemoCard>

      <DemoCard 
        title="2. Monaco Editor" 
        description="Uses controlled value and explicit layout calls to persist code editor state across windows."
      >
        <MonacoDemo />
      </DemoCard>

      <DemoCard 
        title="3. Tailwind Styling" 
        description="Verifies automatic synchronization of Tailwind classes and global style changes to the floating window."
      >
        <TailwindDemo />
      </DemoCard>

      <DemoCard 
        title="4. Decoupled Trigger" 
        description="A remote, standalone toggle button controlling a distant content wrapper via a unique ID link."
      >
        <DecoupledDemo />
      </DemoCard>

      <DemoCard 
        title="5. Controlled State" 
        description="Drives the open/closed visibility status of the Picture-in-Picture window using parent React state."
      >
        <ControlledDemo />
      </DemoCard>

      <DemoCard 
        title="6. Shared React Tree" 
        description="Demonstrates that the portal content and the opener window share the exact same React context, hooks, and state."
      >
        <PortalDemo />
      </DemoCard>

      <DemoCard 
        title="7. Fixed Component Size" 
        description="Enforces strict component layout dimensions inside the Picture-in-Picture window."
      >
        <FixedSizeDemo />
      </DemoCard>

      <DemoCard 
        title="8. Keyboard Event Forwarding" 
        description="Forwards keyboard shortcuts (like Cmd+S / Ctrl+S) from the PiP window back to the main document context."
      >
        <KeyboardShortcutDemo />
      </DemoCard>

      <DemoCard 
        title="9. Video Player Continuity" 
        description="Start playback. Open Picture-in-Picture. The video moves to the PiP window and continues playing seamlessly."
      >
        <VideoDemo />
      </DemoCard>

      <DemoCard 
        title="10. Audio Stream Continuity" 
        description="Start playback. Toggle Picture-in-Picture. The audio stream moves to the PiP window and continues playing seamlessly."
      >
        <AudioDemo />
      </DemoCard>

      <DemoCard 
        title="11. Scribble Canvas Board" 
        description="Interact and draw. Opening/closing PiP preserves your canvas drawing buffer, strokes, and undo/redo history perfectly."
      >
        <ScribbleDemo />
      </DemoCard>

      <DemoCard 
        title="12. Interactive Map" 
        description="Interact with a live Leaflet map. Panning, zooming, and dragging the marker are preserved seamlessly between windows."
      >
        <MapDemo />
      </DemoCard>

      <DemoCard 
        title="13. Build Progress Monitor" 
        description="Start a build. Move it into PiP to monitor your tasks in a small floating corner window while you browse other tabs."
      >
        <BuildProgressDemo />
      </DemoCard>
    </div>
  )
}

export default App
