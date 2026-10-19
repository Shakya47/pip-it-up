# pip-it-up

<p align="center">
  <img src="https://raw.githubusercontent.com/Shakya47/pip-it-up/main/docs/assets/pip-it-up-github-banner.gif" alt="pip-it-up-github-banner" width="100%" />
</p>

> **Status: beta.** The API can change before v1.0. See the [roadmap](#roadmap).

Open any part of your page (a player, an editor, a dashboard) in a floating, always-on-top window using the **Document Picture-in-Picture API**.

## Features

- **Keeps state**: your content is moved into the window, not re-created. Inputs, listeners and playing media carry over.
- **Styles follow**: page CSS (Tailwind, CSS-in-JS) is copied into the window and kept in sync.
- **No layout jumps**: a placeholder holds the space while the content is away.
- **Fallbacks**: content with a single `<video>` uses native Video PiP where Document PiP is missing; otherwise a popup tab or your own handler.

## Quickstart

```bash
npm install @pip-it-up/react @pip-it-up/core
```

React:

```tsx
import { PipWrapper, PipTrigger } from '@pip-it-up/react';

function App() {
  return (
    <PipWrapper>
      <h1>My Floating Tool</h1>
      <PipTrigger asChild>
        <button>Open Picture-in-Picture</button>
      </PipTrigger>
    </PipWrapper>
  );
}
```

Vanilla (`npm install @pip-it-up/core`):

```ts
import { createPip } from '@pip-it-up/core';

const panel = document.querySelector<HTMLElement>('#panel')!;
const button = document.querySelector<HTMLButtonElement>('#pip-button')!;
const pip = createPip();
button.addEventListener('click', () => {
  pip.toggle({ contentEl: panel }).catch(console.error);
});
```

## Packages

| Package | What it is |
| --- | --- |
| [`@pip-it-up/core`](./packages/core/README.md) | Framework-agnostic library: options, errors, registry, native video PiP, automatic PiP. |
| [`@pip-it-up/react`](./packages/react/README.md) | React components and hooks, including route-persistent `<PipProvider>` / `<PipAnchor>`. React 18+. |

## Browser support

| Browser | Document PiP (any content) | Native Video PiP (single `<video>`) |
| --- | --- | --- |
| Chrome / Edge (desktop) | 116+ | Yes |
| Firefox (desktop) | 151+ | Yes |
| Safari (macOS, iOS) | No | Yes |
| Mobile Chrome / Firefox | No | Varies by browser |

- Where Document PiP is missing, the library falls back to native Video PiP when the content holds exactly one `<video>`, then to your `fallback` option.
- Document PiP needs a secure context (HTTPS or localhost) and a user gesture to open.
- Tested end to end in Chrome, Firefox, WebKit and Safari ([`apps/e2e`](./apps/e2e)).
- **Node**: `engines` (`>=20`) applies to building and tooling only. The published bundles run in the browser.

## Recipes

- [Tiptap](./docs/recipes/tiptap.md)
- [Monaco Editor](./docs/recipes/monaco.md)
- [Tailwind CSS](./docs/recipes/tailwind.md)
- [Next.js (SSR)](./docs/recipes/nextjs.md)
- [Fallbacks](./docs/recipes/fallbacks.md)
- [Keyboard shortcuts](./docs/recipes/keyboard-shortcuts.md)
- [Chrome extension](./docs/recipes/chrome-extension.md)

## Roadmap

- [x] **Seamless video/canvas/WebRTC PiP**: the same DOM node moves into the window and back, so video keeps playing. With `<PipProvider>`, content parked between routes uses `moveBefore()` where the browser has it (Chrome, Firefox), so iframes don't reload.
- [ ] **Vue and Svelte bindings**: `@pip-it-up/vue`, `@pip-it-up/svelte`
- [ ] **Angular bindings**: `@pip-it-up/angular`
- [ ] **v1.0 stable release**: locked API, full browser matrix testing

Feature request? [Open an issue](https://github.com/Shakya47/pip-it-up/issues).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
