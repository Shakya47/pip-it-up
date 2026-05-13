# pip-it-up

A robust, framework-agnostic solution for the Document Picture-in-Picture API. Build highly interactive, tear-away windows for your web applications with native DOM moving, styling sync, and fallbacks.

## Features

- **Mode System**: Choose between `move` (moves elements physically), `clone` (copies DOM), or `portal` (React-specific portals).
- **Style Synchronization**: Automatically copies CSS rules (Tailwind, Emotion, Styled Components) and updates them dynamically.
- **Fallbacks**: Gracefully degrades to a popup window or a centered modal when PiP is unsupported.
- **Framework Agnostic**: Core library works with vanilla JS. React wrapper (`@pip-it-up/react`) provides seamless hooks and components.
- **Dynamic Resizing**: Lock aspect ratios or dynamically resize the PiP window to match content.

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
        <h1>My Video / Tool</h1>
        <PipTrigger>
          <button>Toggle Picture in Picture</button>
        </PipTrigger>
      </div>
    </PipWrapper>
  );
}
```

## Packages

- [`@pip-it-up/core`](./packages/core/README.md) - The vanilla JavaScript engine.
- [`@pip-it-up/react`](./packages/react/README.md) - React components, hooks, and context.

## Documentation

See the recipes for advanced usage:
- [Tiptap Integration](./docs/recipes/tiptap.md)
- [Monaco Editor](./docs/recipes/monaco.md)
- [Tailwind CSS](./docs/recipes/tailwind.md)
- [Next.js SSR](./docs/recipes/nextjs.md)
- [Fallbacks](./docs/recipes/fallbacks.md)
- [Keyboard Shortcuts](./docs/recipes/keyboard-shortcuts.md)

## Browser Support

| Browser | Document PiP Support |
| --- | --- |
| Google Chrome | >= 116 (macOS, Windows, ChromeOS, Linux) |
| Microsoft Edge | >= 116 |
| Safari | Unsupported (uses Fallbacks) |
| Firefox | Unsupported (uses Fallbacks) |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
