import { ThemeProvider } from 'next-themes'
import BasicDemo from './demos/BasicDemo'
import MonacoDemo from './demos/MonacoDemo'
import TailwindDemo from './demos/TailwindDemo'
import ThemeDemo from './demos/ThemeDemo'
import DecoupledDemo from './demos/DecoupledDemo'
import ControlledDemo from './demos/ControlledDemo'
import PortalDemo from './demos/PortalDemo'
import FallbackDemo from './demos/FallbackDemo'
import FixedSizeDemo from './demos/FixedSizeDemo'
import KeyboardShortcutDemo from './demos/KeyboardShortcutDemo'

function App() {
  return (
    <ThemeProvider attribute="data-theme">
      <div className="max-w-4xl mx-auto p-8 space-y-16">
        <header className="mb-12">
          <h1 className="text-4xl font-bold mb-4">Pip-it-up Playground</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Demos and manual QA for @pip-it-up/react
          </p>
        </header>

        <BasicDemo />
        <MonacoDemo />
        <TailwindDemo />
        <ThemeDemo />
        <DecoupledDemo />
        <ControlledDemo />
        <PortalDemo />
        <FallbackDemo />
        <FixedSizeDemo />
        <KeyboardShortcutDemo />
      </div>
    </ThemeProvider>
  )
}

export default App
