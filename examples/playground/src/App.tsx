import { IframeGuard } from './components/IframeGuard'
import BasicDemo from './demos/BasicDemo'
import MonacoDemo from './demos/MonacoDemo'
import TailwindDemo from './demos/TailwindDemo'
import DecoupledDemo from './demos/DecoupledDemo'
import ControlledDemo from './demos/ControlledDemo'
import PortalDemo from './demos/PortalDemo'
import FixedSizeDemo from './demos/FixedSizeDemo'
import KeyboardShortcutDemo from './demos/KeyboardShortcutDemo'

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

      <BasicDemo />
      <MonacoDemo />
      <TailwindDemo />
      <DecoupledDemo />
      <ControlledDemo />
      <PortalDemo />
      <FixedSizeDemo />
      <KeyboardShortcutDemo />
    </div>
  )
}

export default App
