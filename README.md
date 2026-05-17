# pip-it-up

> **Status: Public Beta** — Core API is stable. Some advanced features are in progress. See the [roadmap](#roadmap) for what's coming.

The ultimate toolkit for the **Document Picture-in-Picture API**. 

Build highly interactive, tear-away windows for your web applications with native DOM moving, styling synchronization, and graceful fallbacks. **pip-it-up** is a framework-agnostic solution that makes it easy to open any HTML content in a floating **Picture-in-Picture** window.

## Features

- **Magic Auto-Sizing**: Automatically detects and matches the dimensions of your component using `ResizeObserver`. No manual width/height needed!
- **Persistent State**: The `move` mode physically detaches your DOM element, preserving internal state, event listeners, and cursor position perfectly.
- **Dynamic Style Sync**: Automatically mirrors CSS rules (Tailwind, CSS-in-JS) and syncs changes in real-time using `MutationObserver`.
- **Responsive Placeholders**: Leaves a stable, responsive placeholder in your main window to prevent layout jumps.
- **Smart Fallbacks**: Gracefully degrades to a popup window or a custom fallback UI when the API is unsupported.
- **Framework Ready**: Official bindings for **React**, with **Vue**, **Angular**, and **Svelte** support coming soon.

## Quickstart

```bash
npm install @pip-it-up/react @pip-it-up/core
```

### React Example

```tsx
import { PipWrapper, PipTrigger } from '@pip-it-up/react';

function App() {
  return (
    <PipWrapper>
      <div>
        <h1>My Floating Tool</h1>
        <PipTrigger>
          <button>Open Picture-in-Picture</button>
        </PipTrigger>
      </div>
    </PipWrapper>
  );
}
```

## Packages

- [`@pip-it-up/core`](./packages/core/README.md) - The vanilla JavaScript engine for the **Document Picture-in-Picture API**.
- [`@pip-it-up/react`](./packages/react/README.md) - React components, hooks, and context for managing **Picture-in-Picture** state.

## Documentation

See our recipes for advanced usage:
- [Tiptap Integration](./docs/recipes/tiptap.md)
- [Monaco Editor](./docs/recipes/monaco.md)
- [Tailwind CSS](./docs/recipes/tailwind.md)
- [Next.js SSR](./docs/recipes/nextjs.md)
- [Fallbacks](./docs/recipes/fallbacks.md)
- [Keyboard Shortcuts](./docs/recipes/keyboard-shortcuts.md)

## Browser Support

| Browser | Document Picture-in-Picture Support |
| --- | --- |
| Google Chrome | >= 116 (macOS, Windows, ChromeOS, Linux) |
| Microsoft Edge | >= 116 |
| Safari | Unsupported (uses Fallbacks) |
| Firefox | Unsupported (uses Fallbacks) |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Roadmap

These are actively being worked on:

- [ ] **Seamless video/canvas/WebRTC PiP** — DOM node identity preserved across open/close (no more video restarts)
- [ ] **Vue and Svelte bindings** — `@pip-it-up/vue`, `@pip-it-up/svelte`
- [ ] **Angular bindings** — `@pip-it-up/angular` support
- [ ] **v1.0 stable release** — locked API, full browser matrix testing

Have a feature request? [Open an issue](https://github.com/Shakya47/pip-it-up/issues).

## License

MIT
