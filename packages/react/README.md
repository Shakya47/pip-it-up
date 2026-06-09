# @pip-it-up/react

<p align="center">
  <img src="https://raw.githubusercontent.com/Shakya47/pip-it-up/main/docs/assets/pip-it-up-github-banner.gif" alt="pip-it-up-github-banner" width="100%" />
</p>

> **Status: Active Beta** — The API is in active development and subject to change before v1.0. See the [roadmap](#roadmap) for upcoming features.

React bindings for `pip-it-up` — a helper library for the **Document Picture-in-Picture API**.

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
Returns `true` if the browser natively supports any Picture-in-Picture API (either Document PiP or classic Video PiP).
```tsx
const isSupported = useIsPipSupported();
```

### `useVideoPip()`
Controls Picture-in-Picture mode explicitly for a single HTML `<video>` element. Unlike `usePip()` (which opens a Document PiP window), `useVideoPip()` uses the classic HTML5 Video Picture-in-Picture API (`video.requestPictureInPicture()`), which has a much higher browser compatibility (~95%), including Safari macOS/iOS and Firefox.

```tsx
import { useRef } from 'react';
import { useVideoPip } from '@pip-it-up/react';

function MyPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isActive, toggle } = useVideoPip(videoRef);

  return (
    <div>
      <video ref={videoRef} src="video.mp4" controls playsInline />
      <button onClick={toggle}>
        {isActive ? 'Close PiP' : 'Open Video PiP'}
      </button>
    </div>
  );
}
```

## Classic Video PiP & Safari/iOS Auto-Fallback

While the modern **Document Picture-in-Picture API** (~78% global coverage) allows floating any arbitrary HTML content, it is not supported in browsers like Safari (macOS/iOS) or Firefox.

`pip-it-up` automatically bridges this gap:
1. **Auto-Detection fallback in `<PipWrapper>`**: When Document PiP is not supported, `<PipWrapper>` inspects its wrapped content. If it detects a single `<video>` element (either the wrapper root itself is a `<video>` or it contains exactly one `<video>`), it automatically falls back to use the classic **Video Picture-in-Picture API** (`video.requestPictureInPicture()`) instead. This enables PiP support for video player components automatically on Safari, iPhone/iPad, and Firefox with zero configuration required.
2. **WebKit/iOS presentation fallback**: For older iOS/Safari versions, it automatically handles WebKit-specific presentation modes (`webkitSetPresentationMode`) and fullscreen triggers (`webkitEnterFullscreen`).
3. **`disableVideoPip` option**: If you want to disable this automatic fallback and rely entirely on standard fallbacks (like opening in a `new-tab` or doing nothing), you can pass `disableVideoPip={true}` to `<PipWrapper>`.

## Tips & Gotchas

### CSS Inheritance
The Picture-in-Picture window is a separate document. While `@pip-it-up` automatically copies stylesheets and `body`/`html` classes, your content will **not** inherit styles from parent elements outside the `<PipWrapper>` (like a `#root` div or a theme provider). 
*   **Fix**: Add necessary alignment or theme classes (e.g., `text-center`, `dark`) directly to the content inside the `<PipWrapper>`.

### Seamless State Preservation (Video, Audio, Canvas, WebRTC)
Because `<PipWrapper>` uses a target-switching React Portal, stateful DOM content like `<video>` (keeps playing from the same position), `<audio>`, `<canvas>` (keeps its drawing buffer), and WebRTC `MediaStream` (remains active) will retain their state, refs, and DOM identity perfectly when entering or exiting Picture-in-Picture. You do not need to lift state, manually restore playheads, or re-initialize canvas drawings.

### Complex Editors, Maps & Custom Bindings
Some complex third-party editors (like Monaco or TipTap) and interactive DOM libraries (like Leaflet, Mapbox, Google Maps, or D3) bind to the global `document` or `window` object at initialization. Even though the DOM node is preserved, these event bindings might still point to the main opener document instead of the PiP window's document, causing mouse interaction, dragging, or focus bugs.
*   **Fix**: Force the component to cleanly remount in the context of the new document by using the `isInsidePip` state (or wrapper `isOpen` state) as a React `key` (e.g., `key={isInsidePip ? 'pip' : 'main'}`). If you need to maintain interactive state (like map coordinates, zoom level, or slider position), store it in a parent state or state manager (Zustand, Redux, URL params, etc.) and pass it down as controlled props.

### Cross-Origin Iframes (YouTube, Vimeo, Maps, etc.)
Cross-origin `<iframe>` embeds (YouTube, Vimeo, Google Maps, Spotify, etc.) will **not work** inside the PiP window. When PiP opens, React unmounts children and remounts them into a new document context. The iframe reloads in this new context with a different (or null) origin, causing the embedded service to reject the request (e.g., YouTube **Error 153**).

This is a **browser platform limitation** of the Document Picture-in-Picture API, not a bug in `pip-it-up`.

*   **Workaround**: For video content, use a native `<video>` element with a direct source URL instead of an iframe embed. Note that services like YouTube do not provide direct video file URLs — you'll need self-hosted or direct-URL video sources.

## Accessibility

`@pip-it-up/react` is built with accessibility (WAI-ARIA compliance) in mind:

- **State Announcements**: Automatically manages a visually hidden `aria-live="polite"` live region that announces to screen readers when content is portaled to the PiP window and when it is restored.
- **Trigger Attributes**: `<PipTrigger>` sets `aria-pressed` according to the active PiP window state and provides default `aria-label` tags (`Open Picture-in-Picture` / `Close Picture-in-Picture`), which can be overridden using custom button properties.
- **Focus Management**:
  - **On Open**: Focuses the new floating window and automatically redirects active keyboard focus to the first focusable element inside the portaled content (or fallback-focuses the root container).
  - **On Close**: Restores focus to the trigger button that launched the PiP window. If the trigger button is no longer present or focus gets lost to the document's body, it fallback-focuses the restored content container.
- **Keyboard Shortcut Discoverability**: If you implement custom global keyboard shortcuts to toggle the PiP window, you can document them for assistive technologies by passing the standard `aria-keyshortcuts` attribute (e.g. `<PipTrigger aria-keyshortcuts="Alt+P">`) directly to `<PipTrigger>`.

## Next.js / SSR
Because the **Document Picture-in-Picture API** is browser-only, ensure components interacting with it are rendered on the client (`"use client"`).

## Browser Security & Iframe Restrictions

The **Document Picture-in-Picture API** is governed by strict browser security policies:

- **Top-Level Context Required**: The browser strictly prohibits opening a PiP window from inside a nested `<iframe>` (attempting this will throw `NotAllowedError: Opening a PiP window is only allowed from a top-level browsing context`).
- **Online Editors (CodeSandbox, StackBlitz)**: Because online sandboxes run your live preview inside an iframe, the PiP window will fail. To test or demo your code successfully, you **must open the live preview in a new standalone browser window/tab** (look for the "Open in New Window" icon in the sandbox's preview panel).
- **Secure Context (HTTPS)**: The API is only active in secure environments (using `https://` or `localhost`).

## Roadmap

These are actively being worked on:

- [x] **Seamless video/canvas/WebRTC PiP** — DOM node identity preserved across open/close (no more video restarts)
- [ ] **Vue and Svelte bindings** — `@pip-it-up/vue`, `@pip-it-up/svelte`
- [ ] **Angular bindings** — `@pip-it-up/angular` support
- [ ] **v1.0 stable release** — locked API, full browser matrix testing

Have a feature request? [Open an issue](https://github.com/Shakya47/pip-it-up/issues).

