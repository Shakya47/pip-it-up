# @pip-it-up/react

<p align="center">
  <img src="https://raw.githubusercontent.com/Shakya47/pip-it-up/main/docs/assets/pip-it-up-github-banner.gif" alt="pip-it-up-github-banner" width="100%" />
</p>

> **Status: Public Beta** — Core API is stable. Some advanced features are in progress. See the [roadmap](#roadmap) for what's coming.

React bindings for `pip-it-up` — the **Document Picture-in-Picture** engine.

## What is Document Picture-in-Picture?

The [Document Picture-in-Picture API](https://developer.mozilla.org/en-US/docs/Web/API/Document_Picture-in-Picture_API) is a new browser capability that allows you to open a floating window that can be populated with any arbitrary HTML content, rather than just a video element. 

`@pip-it-up/react` makes it trivial to use this API in React applications with familiar patterns like Portals, Hooks, and Controlled Components.

## Installation

```bash
npm install @pip-it-up/react @pip-it-up/core
```

## Live Demo

Try out the components instantly in your browser:

[![Edit in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/p/sandbox/pip-it-up-test-xfng5n)

## Components

### `<PipWrapper>`

Wraps the content you want to move into the **Picture-in-Picture** window. 

#### Uncontrolled (Default)
```tsx
<PipWrapper>
  <div>Content to move</div>
  <PipTrigger>Toggle</PipTrigger>
</PipWrapper>
```

#### Controlled
```tsx
const [isOpen, setIsOpen] = useState(false);

<PipWrapper open={isOpen} onOpenChange={setIsOpen}>
  <div>Content to move</div>
</PipWrapper>
```

#### Props

Supports all `PipOptions` from `@pip-it-up/core`, including:

- **`id`** (string): A unique identifier for the PiP instance. Required if you want to control this wrapper from a remote `<PipTrigger pipId="...">`.
- **`width` / `height`** (number, optional): If provided, forces the PiP window to these dimensions. **If omitted, the library uses a `ResizeObserver` to automatically match the component's exact size on the page.**
- **`mode`** (deprecated, `"move" | "portal"`, default: `"move"`):
  - *Deprecated*: The React package always uses **React Portals** (`"portal"` mode) internally because React manages its own DOM structure. Direct vanilla DOM manipulation (like `move`/`clone`) would break React's reconciler. Both options behave identically in `PipWrapper`.
- **`fallback`** (`"new-tab" | "none"`, default: `"new-tab"`):
  - Determines behavior when the Document PiP API is not supported.
- **`fallbackUrl`** (string):
  - The URL to open in a new browser tab when using `fallback="new-tab"`. This is required if `'new-tab'` is used.
- **`copyStyles`** (`"sync" | "once" | false`, default: `"sync"`): 
  - `"sync"`: Real-time synchronization of CSS changes (MutationObserver).
  - `"once"`: One-time copy at window open.
- **`reserveSpace`** (boolean, default: `true`): Whether to show a placeholder in the original position to prevent layout jumps.
- **`placeholder`** (ReactNode): Custom component to show in the placeholder area.
- **`centerInPip`** (boolean, default: `false`): Automatically centers your content in the PiP window.
- **`open`** (boolean): Controlled state for the window.
- **`onOpenChange`** (callback): Fired when the window opens or closes.

### `<PipTrigger>`

A button that toggles the **Picture-in-Picture** window.

#### Nested (Colocated)
When placed directly inside a `<PipWrapper>`, it automatically controls its parent:
```tsx
<PipTrigger asChild>
  <button className="my-custom-btn">Open Picture-in-Picture</button>
</PipTrigger>
```

#### Decoupled (Remote)
If your trigger and wrapper live in completely different parts of your React tree, you can link them using an `id` (powered by the core registry API):
```tsx
// Anywhere in your app (e.g., in a global Navbar)
<PipTrigger pipId="main-player">Open Player</PipTrigger>

// Somewhere else completely
<PipWrapper id="main-player">
  <Player />
</PipWrapper>
```

## Hooks

### `usePip()`
Returns the context state for managing the **Picture-in-Picture** lifecycle.
```tsx
const { isOpen, pipWindow, instance, isInsidePip } = usePip();
```
- **`isOpen`**: Boolean indicating if the PiP window is open.
- **`pipWindow`**: The native `Window` object of the PiP instance (null if closed).
- **`isInsidePip`**: Boolean that is `true` only when the component is being rendered inside the PiP window.
- **`instance`**: The underlying `@pip-it-up/core` instance.

> [!NOTE]
> `usePipContext()` is also available if you only need the raw context without the extra convenience properties of `usePip()`.

### `useIsPipSupported()`
Returns `true` if the browser natively supports the **Document Picture-in-Picture API**.
```tsx
const isSupported = useIsPipSupported();
```

## Tips & Gotchas

### CSS Inheritance
The Picture-in-Picture window is a separate document. While `@pip-it-up` automatically copies stylesheets and `body`/`html` classes, your content will **not** inherit styles from parent elements outside the `<PipWrapper>` (like a `#root` div or a theme provider). 
*   **Fix**: Add necessary alignment or theme classes (e.g., `text-center`, `dark`) directly to the content inside the `<PipWrapper>`.

### Complex Editors (Monaco, TipTap, Canvas)
Editors that bind to the `document` object at initialization may break when moved to a new window.
*   **Fix 1**: Force a remount of the editor when moving to PiP by using the `isInsidePip` state as a React `key`.
*   **Fix 2**: Lift your editor state (content, cursors, etc.) **above** the `<PipWrapper>`. Since the wrapper unmounts and remounts its children when moving them into the PiP window, any state stored *inside* the wrapper will be lost during the transition.

```tsx
const [content, setContent] = useState("");

return (
  <PipWrapper>
    <RichTextEditor 
      key={isInsidePip ? 'pip' : 'main'} 
      value={content} 
      onChange={setContent} 
    />
  </PipWrapper>
);
```

### Cross-Origin Iframes (YouTube, Vimeo, Maps, etc.)
Cross-origin `<iframe>` embeds (YouTube, Vimeo, Google Maps, Spotify, etc.) will **not work** inside the PiP window. When PiP opens, React unmounts children and remounts them into a new document context. The iframe reloads in this new context with a different (or null) origin, causing the embedded service to reject the request (e.g., YouTube **Error 153**).

This is a **browser platform limitation** of the Document Picture-in-Picture API, not a bug in `pip-it-up`.

*   **Workaround**: For video content, use a native `<video>` element with a direct source URL instead of an iframe embed. Note that services like YouTube do not provide direct video file URLs — you'll need self-hosted or direct-URL video sources.

## Next.js / SSR
Because the **Document Picture-in-Picture API** is browser-only, ensure components interacting with it are rendered on the client (`"use client"`).

## Browser Security & Iframe Restrictions

The **Document Picture-in-Picture API** is governed by strict browser security policies:

- **Top-Level Context Required**: The browser strictly prohibits opening a PiP window from inside a nested `<iframe>` (attempting this will throw `NotAllowedError: Opening a PiP window is only allowed from a top-level browsing context`).
- **Online Editors (CodeSandbox, StackBlitz)**: Because online sandboxes run your live preview inside an iframe, the PiP window will fail. To test or demo your code successfully, you **must open the live preview in a new standalone browser window/tab** (look for the "Open in New Window" icon in the sandbox's preview panel).
- **Secure Context (HTTPS)**: The API is only active in secure environments (using `https://` or `localhost`).

## Roadmap

These are actively being worked on:

- [ ] **Seamless video/canvas/WebRTC PiP** — DOM node identity preserved across open/close (no more video restarts)
- [ ] **Vue and Svelte bindings** — `@pip-it-up/vue`, `@pip-it-up/svelte`
- [ ] **Angular bindings** — `@pip-it-up/angular` support
- [ ] **v1.0 stable release** — locked API, full browser matrix testing

Have a feature request? [Open an issue](https://github.com/Shakya47/pip-it-up/issues).

