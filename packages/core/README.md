# @pip-it-up/core

<p align="center">
  <img src="https://raw.githubusercontent.com/Shakya47/pip-it-up/main/docs/assets/pip-it-up-github-banner.gif" alt="pip-it-up-github-banner" width="100%" />
</p>

The framework-agnostic JavaScript library for the **Document Picture-in-Picture API**.

`@pip-it-up/core` provides a robust, framework-agnostic way to manage the lifecycle of **Picture-in-Picture** windows, including style synchronization, element positioning, and keyboard event bridging.

## Installation

```bash
npm install @pip-it-up/core
```

> **Node version**: `engines` constrains the **build and tooling** environment (`>=20`). The published bundles target browsers: Document Picture-in-Picture requires Chromium 116+, and the classic Video PiP fallback covers roughly 95% of browsers including Safari and Firefox.

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
- `disableVideoPip`: Boolean to disable automatic video-only PiP fallback on unsupported browsers (default: `false`).

##### Support and Video PiP Utilities
- `isSupported()`: Returns `true` if the browser supports the Document Picture-in-Picture API.
- `isVideoPipSupported()`, `isWebkitPipSupported()`, `isInVideoPip()`, `enterVideoPip(video)`,
  `exitVideoPip(video)`: native Video PiP detection and control. See
  [Native Video PiP](#native-video-pip) for usage and caveats.

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
- `subscribe(fn)`: Subscribe to any state change. Returns an unsubscribe function.
- `destroy()`: **Permanent** teardown. This is the only terminal lifecycle event — closing a window,
  replacing an element or unmounting a framework component are all non-terminal. After `destroy()`
  the instance's `signal` is aborted, every retained DOM reference is released, and all mutating
  methods are inert (`open()` warns `ERR_DESTROYED` and does nothing).
- `destroyed` (boolean): `true` after `destroy()`.
- `signal` (AbortSignal): aborted by `destroy()`. Pass it to your own `addEventListener` calls to get
  leak-proof teardown tied to the instance's lifetime.

##### Element Slots

`contentEl` and `originEl` are **named slots** with different lifetimes: `contentEl` is usually owned
for a whole session, while `originEl` can be replaced whenever the surrounding UI re-renders or a
route changes. The slot API below is built for that asymmetry.

- `setDefaultElements({ contentEl?, originEl? })`: Merge new slot values. **Tri-state:** `undefined`
  (or an omitted key) means "leave this slot alone", `null` means "vacate this slot", and an
  `HTMLElement` claims it. Passing `{ contentEl: undefined }` is a no-op, **not** a wipe.
- `getDefaultElements()`: The merged slot state. Referentially stable between real changes, so it is
  safe to use directly as a `useSyncExternalStore` snapshot.
- `subscribeElements(fn)`: Subscribe to slot changes only, narrower than `subscribe`. Returns an
  unsubscribe function.
- `registerElements(patch)`: The preferred API for anything with a lifetime. Claims slots and returns
  an `ElementRegistration` handle:
  - `update(patch)`: re-point the slots this handle owns.
  - `release()`: **compare-and-clear** — vacates a slot only if this handle still owns it. If
    something newer already claimed it, `release()` is a no-op. Idempotent.
  - `released` (boolean).

  Compare-and-clear is what makes replaceable origins safe. During a route change the incoming
  element can claim the slot *before* the outgoing one releases it; a blind `originEl = null` would
  destroy the new registration and leave the instance with no restore target.

  ```ts
  const reg = instance.registerElements({ originEl: slotEl });
  // ...later, when that slot goes away:
  reg.release();   // only clears if `slotEl` is still the registered origin
  ```

- `registerTeardown(fn)`: Register a hook run **synchronously** at the top of `close()`, before the
  PiP window is destroyed. Returns an unregister function. Hooks run LIFO and are error-isolated, so
  a throwing hook cannot abandon the window.

  This is the only reliable place to move DOM out of a PiP window: the browser destroys that document
  immediately after `pagehide`, and core registers its own listener first, so a `pagehide` listener
  you add later runs too late.

  ```ts
  const off = instance.registerTeardown((pipWindow) => {
    myHiddenContainer.appendChild(contentEl);   // still alive here
  });
  ```

##### Utilities

- `mergeElements(current, patch)`: The tri-state merge, exported for direct use. Returns `current`
  **by reference** when nothing changed.
- `isUsable(el)`: `true` only if `el` is connected to a document that still has a live browsing
  context. Use it before touching any element you did not create in the current tick — a node in a
  torn-down PiP document is still "in the DOM" but calling `focus()` on it is a no-op or a throw.

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

<a id="native-video-pip"></a>

## Native Video PiP (vanilla)

Two different APIs, and core exposes both. Pick native Video PiP when the content **is** a
`<video>`; pick Document PiP (`createPip`) for anything else.

| | Native Video PiP | Document PiP (`createPip`) |
| :--- | :--- | :--- |
| What floats | the video's frames, OS-drawn | a real window containing your DOM |
| Moves DOM? | no | yes |
| Support | ~95%, incl. Safari/iOS and Firefox | Chromium 116+ |

```ts
import { enterVideoPip, exitVideoPip, isVideoPipSupported, isInVideoPip } from '@pip-it-up/core';

const video = document.querySelector('video')!;

// Must be inside a click handler - see caveat 1.
button.addEventListener('click', async () => {
  if (isInVideoPip()) await exitVideoPip(video);
  else await enterVideoPip(video);
});
```

- `isVideoPipSupported()`: the standard API is available.
- `isWebkitPipSupported()`: older WebKit presentation mode is available.
- `isInVideoPip()`: any element on the page is currently in PiP.
- `enterVideoPip(video)`: requests PiP. Sets `playsinline` if missing (required on iOS), then falls
  back to `webkitSetPresentationMode('picture-in-picture')` and `webkitEnterFullscreen()` on older
  WebKit. Throws if none is available.
- `exitVideoPip(video)`: exits, handling the same three paths.

Track state with the element's own events — `enterpictureinpicture`, `leavepictureinpicture`, and on
WebKit `webkitpresentationmodechanged` — so your UI stays correct when the user closes the overlay
from its own chrome. (`@pip-it-up/react`'s `useVideoPip` does this for you.)

### Caveats

**1. Requires a real user gesture.** `requestPictureInPicture()` needs *transient* user activation.
Without it:

```
NotAllowedError: Must be handling a user gesture if there isn't already an element in
Picture-in-Picture.
```

**2. You cannot reliably *initiate* auto-PiP on tab switch — but you can *register* for it.**
Calling `requestPictureInPicture()` from a `visibilitychange` handler normally rejects, because that
handler has no transient activation, and **sticky activation does not substitute** (it still rejects
when `navigator.userActivation.hasBeenActive === true`). Two exemptions exist: swapping while
something is *already* in PiP, and timing — transient activation lasts roughly 5 seconds after a
click, so switching tabs immediately after clicking does succeed. That makes the approach
*intermittent*, not viable: check `navigator.userActivation.isActive` if you want to know which case
you are in.

The working mechanism is the Media Session action. Register
`navigator.mediaSession.setActionHandler('enterpictureinpicture', handler)` and Chrome will invoke
that handler itself when the tab hides — if it considers your origin eligible. Eligibility is
granted to origins actively using camera or microphone (how Google Meet does it), to installed
PWAs, and via the user's `chrome://settings/content/autoPictureInPicture` setting. An ineligible
origin simply never gets called, which degrades gracefully. The same registration also adds a PiP
button to the browser's media controls.

**3. One PiP element per document.** Requesting a second one moves the overlay.

**4. No audio PiP exists.** Use Document PiP to float an audio player's controls and artwork.

**5. The overlay cannot be styled.** It is OS-drawn. Custom controls mean Document PiP.

**6. Honour `disablePictureInPicture`.** The browser blocks the request when that attribute is set.

`createPip()` uses all of this automatically: when Document PiP is unsupported and the content is a
single `<video>`, it falls back to native Video PiP unless you pass `disableVideoPip: true`.

## Route persistence and framework bindings

Keeping a widget alive across route changes — so its PiP window survives navigation — ships as a
**React-only** feature today: `<PipProvider>`, `<PipAnchor>` and the dormancy hooks live in
[`@pip-it-up/react`](https://github.com/Shakya47/pip-it-up/blob/main/packages/react/README.md). There is no `createPip` equivalent.

That is mostly because the hardest part of the problem is React-specific. React's reconciler
destroys a portal whose container changes, so the React binding has to render into a container it
never replaces and move that container with native DOM calls. In vanilla JS there is no reconciler
and no unmounting: a DOM node you hold a reference to simply stays alive, and you move it.

Core does provide every **lifecycle** primitive the React binding is built on, so you can implement
route persistence yourself in vanilla JS or another framework:

| You need | Core gives you |
| :--- | :--- |
| Swap the restore target when the UI changes | `registerElements` + compare-and-clear `release()` |
| Survive an origin being replaced mid-session | Restore target resolved lazily at close time |
| Rescue content before the PiP document dies | `registerTeardown` |
| Know whether a node is still safe to touch | `isUsable(el)` |
| Tie listeners to the instance's lifetime | `instance.signal` |
| Share one instance across modules | `registerPip` / `getPip` (owner-only unregistration) |

A minimal vanilla version:

```ts
const pip = createPip({ id: 'tracker', mode: 'move' });

// A hidden container you own, so parked content stays CONNECTED to the document.
// Detaching it instead would run the HTML media removal steps and pause any <video>.
const parked = document.createElement('div');
parked.setAttribute('inert', '');
parked.style.cssText =
  'position:fixed;top:0;left:0;width:0;height:0;overflow:hidden;content-visibility:hidden;contain-intrinsic-size:0 0';
document.body.appendChild(parked);

let registration = pip.registerElements({ contentEl });

// On every route change, re-point the origin at whatever slot exists now (or nothing).
function onRouteChange(slotEl: HTMLElement | null) {
  registration.release();
  registration = pip.registerElements(
    slotEl ? { contentEl, originEl: slotEl } : { contentEl, originEl: null }
  );
  if (slotEl) slotEl.appendChild(contentEl);
  else parked.appendChild(contentEl);
}

// Rescue the content before the PiP document is destroyed.
pip.registerTeardown(() => {
  const slot = pip.getDefaultElements().originEl;
  (isUsable(slot) ? slot : parked).appendChild(contentEl);
});
```

What core does **not** provide, and you would have to write:

- the hidden parking container and the `moveBefore`-vs-`appendChild` policy for moving nodes
  (`moveBefore` preserves state on same-document moves but throws across documents);
- the anchor/registry abstraction;
- the anti-CLS size reservation (`ResizeObserver` + a size handoff animation);
- the four-level dormancy model and its throttling verbs.

Framework bindings that package all of this for Vue, Svelte and Solid are on the roadmap.

<a id="automatic-pip"></a>

## Automatic PiP (pop out on tab switch)

`createAutoPip` enters Picture-in-Picture when the document becomes hidden — the behaviour YouTube
and Google Meet have when you switch away. It is framework-agnostic and returns a disposer.

It owns *when* to attempt; you own *what* opens, so it drives native Video PiP and Document PiP
equally:

```ts
import { createAutoPip, createPip } from '@pip-it-up/core';

// A bare <video>.
const stop = createAutoPip(() => video.requestPictureInPicture(), {
  when: () => !video.paused,
});

// Or a whole component, tied to the instance's own lifetime so there is no disposer to track.
const pip = createPip({ contentEl: panel });
createAutoPip(pip.open, { when: () => !pip.isOpen() });
```

### Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `when` | `() => boolean` | always | Guard evaluated at attempt time. Skip if it returns `false`. |
| `onResult` | `(r: AutoPipResult) => void` | — | Reports every attempt, including expected rejections. |
| `mediaSession` | `boolean` | `false` | Also register the `enterpictureinpicture` Media Session action. |
| `signal` | `AbortSignal` | — | Stop listening when aborted, instead of via the disposer. |

### Why an attempt can be rejected

Both `video.requestPictureInPicture()` and `documentPictureInPicture.requestWindow()` require
**transient user activation**. Two properties of it decide whether automatic PiP works:

1. **Activation is time-based, and survives across tasks.** A gesture stays live for roughly five
   seconds, so a `visibilitychange` listener — which by definition runs long after the click or
   keystroke that armed it — still holds it. Deferring the call does not lose the gesture.
2. **A successful call consumes it.** You get one attempt per gesture; the next fails with
   `NotAllowedError` until the user interacts again.

So automatic PiP succeeds whenever the user touched the page shortly before leaving it, and fails
on a page that has sat untouched for longer than the activation window. `onResult` tells you which
happened:

```ts
createAutoPip(enter, {
  onResult: (r) => {
    if (r.ok) return;             // r.grantedBy is 'gesture' or 'browser'
    if (!r.hadActivation) return; // expected: nothing recent authorised it
    console.error(r.error);       // the gesture was accepted; something else broke
  },
});
```

### Gesture-free auto-PiP

Chrome can enter PiP with no gesture at all, but only on origins it considers eligible (camera or
microphone in use, an installed PWA, or a user allow-listing the site under
`chrome://settings/content/autoPictureInPicture`) *and* only if the page has registered the
`enterpictureinpicture` Media Session action. `mediaSession: true` registers it; `registerEnterPipAction`
is also exported if you want to manage it yourself.

Registering it is the part you control; eligibility is not. This is why Google Meet's auto-PiP
feels unconditional — a call holds the camera, so the origin is eligible and the browser invokes
the handler itself.

The action only exists while a media session does, i.e. while media is playing, so registering it
for a non-media component is inert. There is one Media Session per document, so register from a
single owner.

### Boundary

`createAutoPip` listens for `visibilitychange`, which covers switching tabs and minimising the
window. It does **not** fire when you switch to another application while the browser window stays
visible — the document is not hidden then, only unfocused.

## Tips & Gotchas

### Cross-Origin Iframes (YouTube, Vimeo, Maps, etc.)
Cross-origin `<iframe>` embeds (YouTube, Vimeo, Google Maps, Spotify, etc.) will **not work** inside the PiP window. When the PiP window opens, the iframe is destroyed and recreated in a new document context with a different (or null) origin, causing the embedded service to reject the request (e.g., YouTube **Error 153**).

This is a **browser platform limitation** of the Document Picture-in-Picture API, not a bug in `pip-it-up`.

*   **Workaround**: For video content, use a native `<video>` element with a direct source URL instead of an iframe embed. Note that services like YouTube do not provide direct video file URLs — you'll need self-hosted or direct-URL video sources.

### Seamless State Preservation (Video, Audio, Canvas, WebRTC)
When using `mode: 'move'` (default) or `mode: 'portal'`, `@pip-it-up` moves the actual DOM element without unmounting it. This means stateful DOM content like `<video>` (keeps playing from the same timestamp), `<audio>`, `<canvas>` (keeps its drawing buffer), and WebRTC `MediaStream` (remains active without reconnecting) will retain their state and identity perfectly across the window boundary.

### Libraries that cache `document` or `window`

Moving a DOM node between documents preserves the node, but not a reference some library resolved
*once* at initialisation. Whether that bites you comes down to one question: does the library read
the document live, or cache it?

- **Live — nothing to do.** Monaco's internal `getWindow(node)` reads
  `node.ownerDocument.defaultView` on every call, so the move is invisible to it.
- **Cached — invalidate it.** ProseMirror caches `EditorView._root` on first use and reads
  selection through it, so after the move selection would be read from the opener. It ships
  `view.updateRoot()` for exactly this. Call it from `onPipWindowReady` and again after `close()`.

Grep for a stored `document` or `window` field to tell which kind you have. Prefer the library's
own invalidation over destroying and rebuilding the component — rebuilding discards the undo
history, scroll position and selection this library exists to preserve.

### Clone Mode vs Move Mode

| Mode | Use when | Do not use when |
| :--- | :--- | :--- |
| `move` | The content is stateful — video, canvas, WebGL, WebRTC, editors, live subscriptions. The node itself relocates, so all state survives. | You need the content visible in **both** windows at once. A DOM node has exactly one parent. |
| `clone` | You need a static, read-only mirror visible in both windows (a preview, a printable view). | The content has any state. Listeners added via `addEventListener` are **not** cloned, form state is **not** preserved, `<script>` tags do **not** re-execute, and inline handlers (`onclick="..."`) **are** cloned and execute in the PiP window's context. |
| `portal` | You are in React. Forced automatically by `<PipWrapper>` and `<PipProvider>`. | Vanilla JS — there is no portal machinery outside React. |

> `clone` uses `cloneNode(true)`, which is the same trust boundary as `innerHTML` for inline handlers. Never clone untrusted or user-pasted HTML. React consumers are unaffected: `<PipWrapper>` and `<PipProvider>` force portal mode and never expose `clone`.

When using the vanilla `createPip({ mode: 'clone' })` API, be aware of `cloneNode(true)` semantics:
- **Event listeners** attached via `addEventListener` are **not** cloned — only inline handlers (`onclick="..."`) are copied.
- **Inline event handlers** (`onclick`, `onmouseover`) **are** cloned and execute in the PiP window's context. If your content includes user-generated or untrusted HTML with inline handlers, prefer `mode: 'move'` instead to avoid script-injection risks.
- **Form state** (typed text, selected options) is **not** preserved in the clone — only the initial HTML attribute values are copied.
- **`<script>` tags** are cloned but do **not** re-execute.

### Style sync and private CDNs
When using style synchronization, external CSS stylesheets (`<link rel="stylesheet">`) are fetched **twice** — once per document (once by the opener and once by the PiP window).

For authenticated or private-CDN stylesheets, the PiP fetch may fail silently, producing an unstyled PiP window with no error.

**Workaround**: Use `copyStyles: 'once'` plus pre-inlined critical CSS. Note that style copying/synchronization cannot be disabled entirely, as PiP windows do not inherit stylesheets from the opener document.

## Security

### 1. Same-Origin Requirement
The Document Picture-in-Picture API requires same-origin between the opener window and the PiP window. Cross-origin embedding is impossible by browser design (available in Chromium 116+ in secure contexts / HTTPS).

This frames every security consideration in this library: every cross-document DOM manipulation, style synchronization, and event bridging operation performed by `@pip-it-up/core` is strictly same-origin by construction. Top-level browsing contexts are required; opening a PiP window from inside a nested `<iframe>` is prohibited by the browser and throws a `NotAllowedError`.

### 2. Keyboard Event Bridge
Only user-initiated keystrokes in the PiP window are forwarded to the opener; programmatic `dispatchEvent` calls are ignored. When `forwardKeyboardEvents: true` (default), the bridge forwards 2 keyboard event types (`keydown` and `keyup`) with full key identity (`key`, `code`, and all modifier flags).

**Privacy Consideration**: Forwarded keystrokes are visible to every `keydown` and `keyup` listener on the opener `window`, including analytics, hotkey libraries, and session-recording scripts. Set `forwardKeyboardEvents: false` when the PiP window hosts sensitive inputs (such as passwords, credit card inputs, or private chat). Prefer scoping opener-side hotkey listeners to specific container elements rather than the global `window`.

### 3. Pointer Event Bridge & Coordinate Semantics
When `forwardPointerEvents: true` (default), user-initiated pointer and mouse events are forwarded to the opener so gesture and dismissal logic can observe interactions. The bridge forwards 8 event types: 4 pointer event types (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) and 4 mouse event types (`mousedown`, `mousemove`, `mouseup`, `click`).

**Coordinates are PiP-viewport relative and must not be used for opener hit-testing.** A click at coordinate `(20, 20)` in the PiP window arrives at `(20, 20)` in the opener's coordinate space, which corresponds to a completely different element. Every bridged event is stamped with a non-enumerable `pipItUpBridged: true` property. Guard coordinate-sensitive opener listeners with this marker:

```ts
window.addEventListener('pointerdown', (e) => {
  if ((e as PointerEvent & { pipItUpBridged?: boolean }).pipItUpBridged) return;
  // opener-only logic; PiP coordinates are not meaningful here
});
```

For openers performing coordinate-based hit-testing (e.g., `elementFromPoint`, drag libraries, or canvas interaction), set `forwardPointerEvents: false`.

### 4. Style Synchronization
Because PiP windows do not inherit stylesheets from the opener document, `@pip-it-up/core` synchronizes styles via `copyStyles: 'sync'` (default) or `copyStyles: 'once'`.

- **Double-Fetch Consequence**: External CSS stylesheets (`<link rel="stylesheet">`) are fetched twice — once by the opener document and once by the PiP window document.
- **Private CDNs & Authenticated Assets**: Stylesheets hosted on private CDNs, authenticated endpoints, or origin-restricted networks may fail silently in the PiP window without throwing an error. In such cases, use `copyStyles: 'once'` with pre-inlined critical CSS.
- **Replication**: Inline `<style>` elements are replicated verbatim into the second document.
- **Mandatory Sync**: Style copying cannot be disabled entirely (`copyStyles` supports `'sync'` and `'once'`, with no `'none'` option) without breaking core layout and component styling.

### 5. Fallback URL Validation
When using `fallback: 'new-tab'`, the `fallbackUrl` option is validated at runtime to allow only `http:` and `https:` schemes. Disallowed protocols (such as `javascript:`, `data:`, `file:`, or `vbscript:`) are rejected with a `console.warn`.

Navigation is executed using `window.open(parsed.href, '_blank', 'noopener,noreferrer')` targeting the validated URL. Passing `parsed.href` prevents `<base href>` manipulation, and `noopener,noreferrer` protects against reverse tabnabbing.

**Application Allowlist Recommendation**: Scheme validation prevents script injection and cross-site scripting (XSS), but it does not prevent open redirects to arbitrary valid HTTP(S) destinations. Applications should still enforce an application-level URL allowlist when deriving `fallbackUrl` from untrusted or user-supplied data.

### 6. Clone Mode Caveat
When using `mode: 'clone'` via vanilla `createPip()`, elements are duplicated using `cloneNode(true)`.

- **Inline Handlers**: Inline event handler attributes (`onclick="..."`, `onmouseover="..."`) are duplicated and execute in the PiP window's context. Never clone untrusted or user-generated HTML.
- **Listeners & State**: Event listeners registered via `addEventListener` are not cloned, `<script>` tags do not re-execute, and form input states are not preserved.
- **Move vs Clone**: For stateful content (videos, canvases, WebGL, WebRTC, forms, interactive widgets), use `mode: 'move'` (see the [Clone Mode vs Move Mode](#clone-mode-vs-move-mode) comparison table). React consumers are unaffected: `<PipWrapper>` and `<PipProvider>` always use portal mode and do not support clone mode.

### 7. Registry Trust Model
The global instance registry (`registerPip`, `unregisterPip`, `getPip`) provides same-page coordination for decoupled triggers and controls.

- **Same-Page Trust Boundary**: The registry is a same-page coordination mechanism, not an isolation boundary. Any script executing in the same document context can call `getPip(id).open()` or manipulate registrations. Never derive registry `id` values from untrusted user-generated content.
- **Registration Policy**: Registration is last-writer-wins and emits a `console.warn` upon collision. It never throws (preserving React Strict Mode double-mount compatibility).
- **Unregistration**: Unregistration is owner-only (`unregisterPip(id, instance)`). Passing the instance handle ensures compare-and-clear semantics so stale unmount cleanups cannot clobber active registrations.

### 8. Reporting Vulnerabilities
If you discover a security vulnerability in `pip-it-up`, please report it privately through [GitHub Security Advisories](https://github.com/Shakya47/pip-it-up/security/advisories/new) per our [`SECURITY.md`](https://github.com/Shakya47/pip-it-up/blob/main/SECURITY.md).

For Content Security Policy (CSP) configurations and Trusted Types compatibility, see [`docs/csp-and-trusted-types.md`](https://github.com/Shakya47/pip-it-up/blob/main/docs/csp-and-trusted-types.md).


