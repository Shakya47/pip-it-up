# @pip-it-up/core

The framework-agnostic JavaScript engine for the **Document Picture-in-Picture API**.

`@pip-it-up/core` provides a robust, framework-agnostic way to manage the lifecycle of **Picture-in-Picture** windows, including style synchronization, element positioning, and keyboard event bridging.

## Installation

```bash
npm install @pip-it-up/core
```

## Usage

```html
<!-- HTML Structure: contentEl lives inside originEl -->
<div id="my-origin">
  <div id="my-content">
    <p>This is the actual element that will move to Picture-in-Picture.</p>
  </div>
</div>
```

```javascript
import { createPip } from '@pip-it-up/core';

const contentEl = document.getElementById('my-content');
const originEl = document.getElementById('my-origin');

const pip = createPip({
  mode: 'move', // 'move', 'clone', or 'portal'
  copyStyles: 'sync', // 'sync', 'once', or false
  fallback: 'new-tab' // 'new-tab' or 'none'
});

// Elements are passed to the open call
pip.open({ contentEl, originEl }).then(() => {
  console.log('Picture-in-Picture window opened!');
});
```

#### Understanding `contentEl` vs `originEl`

| Element Parameter | DOM Role | What to put here |
| :--- | :--- | :--- |
| **`contentEl`** | **The Movable Content** | The actual UI element/widget you want to display inside the PiP window (e.g. your `<video>`, interactive editor, chat box, canvas, etc.). |
| **`originEl`** | **The Layout Anchor** | The outer parent wrapper element that **remains in the main tab**. The library uses this element to measure and reserve the layout space (keeping a blank spot of the same dimensions) and automatically re-appends `contentEl` back here when PiP closes. |

## API

### `createPip(options: PipOptions): PipInstance`

Creates a new **Picture-in-Picture** instance.

#### `PipOptions`
##### Core Options
- `mode`: `'move'` (default), `'clone'`, or `'portal'`.
- `copyStyles`: `'sync'` (default), `'once'`, or `false`.
- `fallback`: `'new-tab'` (default) or `'none'`.
- `fallbackUrl`: The URL to open in a new browser tab/popup when using `fallback: 'new-tab'`. Required if `'new-tab'` is used.
- `width` / `height`: Initial dimensions. If not provided, they are inferred from the element passed to `open()`.
- `fixedSize`: Enforces fixed dimensions on the inner document/body styles with `overflow: hidden` to prevent component layout reflowing. (Note: Snapping the outer OS window frame programmatically is often blocked by modern browser security policies, which restrict `resizeTo()` calls to active user-gesture contexts).
- `reserveSpace`: Preserve the layout in the main window when `mode: 'move'` (default: `true`).
- `centerInPip`: Centering the content inside the window via flexbox (default: `false`).
- `pipBodyStyles`: Custom styles for the PiP window's `<body>`.

##### Advanced Options
- `id`: A unique string identifier. If provided, registers the instance globally so it can be retrieved via `getPip(id)`.
- `preferInitialWindowPlacement`: Tells the browser to place the PiP window at its default initial position rather than reusing the last position of a previously closed window.
- `disallowReturnToOpener`: Hides the browser's native "Return to Tab" button in the PiP window frame.
- `forceFallback`: Forces the library to trigger its fallback behavior even if the browser natively supports the Document PiP API (excellent for testing or fallback-by-default behavior).
- `forwardKeyboardEvents`: Bubbles `keydown` and `keyup` events from the PiP window back to the main opener window so global keyboard shortcuts continue working (default: `true`).
- `restoreScroll`: Automatically snapshots and restores the exact scroll positions of all elements within the moved container upon closing (default: `true`).
- `restoreFocus`: Automatically captures and restores active focus and text/input selections when returning elements to the opener window (default: `true`).

##### Lifecycle Callbacks
- `onBeforeOpen`: A lifecycle function executed before opening the window. Returning `false` (or resolving to `false`) cancels the open request.
- `onOpen`: Fired immediately when the window opens, passing the native PiP `Window` object.
- `onPipWindowReady`: Callback fired when the window is fully prepared and first animation frame resolves.
- `onClose`: Fired when the PiP window closes.
- `onError`: Fired when an error occurs during PiP operations. If omitted, errors are thrown.

#### `PipInstance`
- `open({ contentEl?, originEl? })`: Requests and opens the **Picture-in-Picture** window.
  - `contentEl` (HTMLElement): The actual component or element (e.g. video, textarea, interactive widget) that you want to move into the PiP window.
  - `originEl` (HTMLElement): The original parent wrapper element in the main tab. When `mode: 'move'` is used, the library uses this element to measure and preserve the layout space on the main page, and as the return target where `contentEl` will be automatically re-appended when the PiP window is closed.
- `close()`: Closes the window.
- `toggle({ contentEl?, originEl? })`: Toggles the window state between open and closed.
- `isOpen()`: Returns boolean.
- `getPipWindow()`: Returns the Window object or null.
- `getState()`: Returns the current state.
- `destroy()`: Cleans up listeners and DOM.

## Registry API

The library includes a global registry that allows you to share and control Picture-in-Picture instances across different modules of your application (e.g., controlling a single PiP window from separate trigger elements).

> [!NOTE]
> In `@pip-it-up/core`, registration is fully manual/opt-in. In `@pip-it-up/react`, the `<PipWrapper id="...">` handles registration and cleanup automatically on mount and unmount.

### `registerPip(id: string, instance: PipInstance): void`
Registers a Picture-in-Picture instance in the global registry under a unique string identifier.

### `unregisterPip(id: string): void`
Unregisters a Picture-in-Picture instance by ID from the global registry (essential for cleaning up references and preventing memory leaks).

### `getPip(id: string): PipInstance | null`
Retrieves a registered Picture-in-Picture instance by ID from the global registry. Returns `null` if no instance is found.

### Practical Use Cases

#### 1. Decoupled Triggers
Control a Picture-in-Picture window from a button located anywhere else (e.g., in a global navigation bar):
```javascript
import { getPip } from '@pip-it-up/core';

// In a completely separate navbar component:
button.addEventListener('click', () => {
  getPip('main-video')?.toggle();
});
```

#### 2. Global Keyboard Shortcuts
Toggle your Picture-in-Picture window from a global shortcut anywhere on the page:
```javascript
import { getPip } from '@pip-it-up/core';

window.addEventListener('keydown', (e) => {
  if (e.altKey && e.key.toLowerCase() === 'p') {
    getPip('main-video')?.toggle();
  }
});
```

#### 3. Navigation Cleanup
Close the Picture-in-Picture window automatically when a user navigates to a new page:
```javascript
import { getPip } from '@pip-it-up/core';

router.onBeforeEach((to, from) => {
  getPip('main-video')?.close();
});
```

## Tips & Gotchas

### Cross-Origin Iframes (YouTube, Vimeo, Maps, etc.)
Cross-origin `<iframe>` embeds (YouTube, Vimeo, Google Maps, Spotify, etc.) will **not work** inside the PiP window. When the PiP window opens, the iframe is destroyed and recreated in a new document context with a different (or null) origin, causing the embedded service to reject the request (e.g., YouTube **Error 153**).

This is a **browser platform limitation** of the Document Picture-in-Picture API, not a bug in `pip-it-up`.

*   **Workaround**: For video content, use a native `<video>` element with a direct source URL instead of an iframe embed. Note that services like YouTube do not provide direct video file URLs — you'll need self-hosted or direct-URL video sources.

## Browser Security & Iframe Restrictions

The **Document Picture-in-Picture API** is governed by strict browser security policies:

- **Top-Level Context Required**: The browser strictly prohibits opening a PiP window from inside a nested `<iframe>` (attempting this will throw `NotAllowedError: Opening a PiP window is only allowed from a top-level browsing context`).
- **Online Editors (CodeSandbox, StackBlitz)**: Because online sandboxes run your live preview inside an iframe, the PiP window will fail. To test or demo your code successfully, you **must open the live preview in a new standalone browser window/tab** (look for the "Open in New Window" icon in the sandbox's preview panel).
- **Secure Context (HTTPS)**: The API is only active in secure environments (using `https://` or `localhost`).

