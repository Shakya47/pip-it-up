import { useEffect, useState } from 'react'
import { IframeGuard } from './components/IframeGuard'
import { ViewSourceLink } from './components/ViewSourceLink'
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
  id: string;
  title: string;
  description: string;
  file: string;
  children: React.ReactNode;
}

function DemoCard({ id, title, description, file, children }: DemoCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
    // Update hash in address bar
    history.pushState(null, '', `#${id}`);
  };

  return (
    <section id={id} className="group relative border rounded-xl p-6 flex flex-col gap-4 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 transition-colors scroll-mt-6">
      <div className="absolute top-4 right-4 z-10">
        <ViewSourceLink file={file} />
      </div>
      <div className="flex flex-col items-center text-center">
        <h2 className="text-2xl font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-indigo-600 bg-clip-text text-transparent">
          <span>{title}</span>
          <button
            onClick={handleCopyLink}
            title="Copy link to this demo"
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-gray-400 hover:text-teal-500 text-lg cursor-pointer flex items-center justify-center select-none"
            style={{ width: '28px', height: '28px' }}
          >
            {copied ? '✅' : '🔗'}
          </button>
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
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash) {
        const id = hash.replace('#', '');
        const element = document.getElementById(id);
        if (element) {
          // Small timeout to allow layout settlement on load
          setTimeout(() => {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        }
      }
    };

    // Run on initial mount
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            history.replaceState(null, '', `#${id}`);
          }
        });
      },
      {
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0.1,
      }
    );

    const sections = document.querySelectorAll('section[id]');
    sections.forEach((section) => observer.observe(section));

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      observer.disconnect();
    };
  }, []);


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
            href="#/dashboard"
            className="px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium shadow-sm transition-colors whitespace-nowrap"
          >
            Route-Persistent PiP →
          </a>
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
        id="basic-demo"
        title="1. TipTap Editor"
        description="The editor DOM node moves between windows without unmounting, so React state, cursor and selection all survive."
        file="examples/playground/src/demos/BasicDemo.tsx"
      >
        <BasicDemo />
      </DemoCard>

      <DemoCard
        id="monaco-demo"
        title="2. Monaco Editor"
        description="No relayout workaround needed. The editor keeps its model, scroll position and undo history across the move."
        file="examples/playground/src/demos/MonacoDemo.tsx"
      >
        <MonacoDemo />
      </DemoCard>

      <DemoCard
        id="tailwind-demo"
        title="3. Tailwind Styling"
        description="Verifies automatic synchronization of Tailwind classes and global style changes to the floating window."
        file="examples/playground/src/demos/TailwindDemo.tsx"
      >
        <TailwindDemo />
      </DemoCard>

      <DemoCard
        id="decoupled-demo"
        title="4. Decoupled Trigger"
        description="A remote, standalone toggle button controlling a distant content wrapper via a unique ID link."
        file="examples/playground/src/demos/DecoupledDemo.tsx"
      >
        <DecoupledDemo />
      </DemoCard>

      <DemoCard
        id="controlled-demo"
        title="5. Controlled State"
        description="Drives the open/closed visibility status of the Picture-in-Picture window using parent React state."
        file="examples/playground/src/demos/ControlledDemo.tsx"
      >
        <ControlledDemo />
      </DemoCard>

      <DemoCard
        id="portal-demo"
        title="6. Shared React Tree"
        description="Demonstrates that the portal content and the opener window share the exact same React context, hooks, and state."
        file="examples/playground/src/demos/PortalDemo.tsx"
      >
        <PortalDemo />
      </DemoCard>

      <DemoCard
        id="fixed-size-demo"
        title="7. Fixed Component Size"
        description="Enforces strict component layout dimensions inside the Picture-in-Picture window."
        file="examples/playground/src/demos/FixedSizeDemo.tsx"
      >
        <FixedSizeDemo />
      </DemoCard>

      <DemoCard
        id="keyboard-shortcut-demo"
        title="8. Keyboard Event Forwarding"
        description="Forwards keyboard shortcuts (like Cmd+S / Ctrl+S) from the PiP window back to the main document context."
        file="examples/playground/src/demos/KeyboardShortcutDemo.tsx"
      >
        <KeyboardShortcutDemo />
      </DemoCard>

      <DemoCard
        id="video-demo"
        title="9. Native Video PiP (video-only)"
        description="Pops out ONLY the video, YouTube-style, using the classic Video PiP API. Also demonstrates why auto-PiP on tab switch cannot be done from a web page."
        file="examples/playground/src/demos/VideoDemo.tsx"
      >
        <VideoDemo />
      </DemoCard>

      <DemoCard
        id="audio-demo"
        title="10. Audio Stream Continuity"
        description="Audio has no native PiP API, so this uses Document PiP to float real DOM — artwork and controls included — with the stream never interrupted."
        file="examples/playground/src/demos/AudioDemo.tsx"
      >
        <AudioDemo />
      </DemoCard>

      <DemoCard
        id="scribble-demo"
        title="11. Scribble Canvas Board"
        description="Interact and draw. Opening/closing PiP preserves your canvas drawing buffer, strokes, and undo/redo history perfectly."
        file="examples/playground/src/demos/ScribbleDemo.tsx"
      >
        <ScribbleDemo />
      </DemoCard>

      <DemoCard
        id="map-demo"
        title="12. Interactive Map"
        description="Interact with a live Leaflet map. Panning, zooming, and dragging the marker are preserved seamlessly between windows."
        file="examples/playground/src/demos/MapDemo.tsx"
      >
        <MapDemo />
      </DemoCard>

      <DemoCard
        id="build-progress-demo"
        title="13. Build Progress Monitor"
        description="Start a build. Move it into PiP to monitor your tasks in a small floating corner window while you browse other tabs."
        file="examples/playground/src/demos/BuildProgressDemo.tsx"
      >
        <BuildProgressDemo />
      </DemoCard>

    </div>
  )
}

export default App
