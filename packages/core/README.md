# @pip-it-up/core

Framework-agnostic engine for the **Document Picture-in-Picture API**. It opens a PiP window, moves (or clones) your DOM into it, keeps styles in sync, forwards keyboard and pointer events, and puts everything back on close. On browsers without Document PiP it falls back to native video PiP or a fallback you choose.

Using React? Use [`@pip-it-up/react`](https://github.com/Shakya47/pip-it-up/blob/main/packages/react/README.md), which is built on this package.

## Install

```bash
npm install @pip-it-up/core
```

Which browsers support what: see [Browser support](https://github.com/Shakya47/pip-it-up/blob/main/README.md#browser-support).

## Quick start

```html
<div id="origin">
  <div id="content">This element moves into the PiP window.</div>
</div>
<button id="toggle">Pop out</button>
```

```ts
import { createPip } from '@pip-it-up/core';

const contentEl = document.getElementById('content')!;
const originEl = document.getElementById('origin')!;
const button = document.getElementById('toggle')!;

const pip = createPip({ mode: 'move', copyStyles: 'sync' });

// Call open()/toggle() from a click: browsers reject it without a recent user gesture.
button.addEventListener('click', () => {
  pip.toggle({ contentEl, originEl }).catch((err) => console.warn('PiP failed:', err));
});
```

| Element | Role |
| :--- | :--- |
| `contentEl` | What goes into the PiP window: a video, editor, chat box, canvas, any element. |
| `originEl` | The wrapper that stays in the page. In `move` mode it keeps the blank space (`reserveSpace`) and receives `contentEl` back on close. With no `originEl`, `contentEl` returns to the parent it had when the window opened. |

## Options

`createPip(options?: PipOptions): PipInstance`. Every option is optional.

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | `pip-instance-N` | Instance id. Not registered automatically; see [Registry](#registry). |
| `mode` | `'move' \| 'clone'` | `'move'` | `move` relocates the real node (state survives). `clone` puts a `cloneNode(true)` copy in the window. See [Gotchas](#gotchas). |
| `copyStyles` | `'sync' \| 'once'` | `'sync'` | Copy `<link rel="stylesheet">` and `<style>` into the window; `sync` keeps watching for new styles. The `className`, inline `style` and `data-*` attributes of `<html>` and `<body>` are copied too (for example a `dark` class); `sync` keeps them updated, `once` copies them at open. Styles cannot be turned off. |
| `width` / `height` | `number` | from `contentEl` | Window size. Default: the size of `contentEl` (clamped to 300–1600 × 200–1200), or 900 × 600 if it has no size. |
| `fixedSize` | `boolean` | `false` | Lock the PiP document (`html`/`body`) to the requested px size with `overflow: hidden`. The user can still resize the window; it is not resized back (browsers only allow `resizeTo()` with a fresh gesture). |
| `reserveSpace` | `boolean` | `true` | `move` mode: freeze the size of `originEl` and `contentEl` while the content is away, so the page does not jump. |
| `centerInPip` | `boolean` | `false` | Center the content in the window with flexbox. |
| `pipBodyStyles` | `Partial<CSSStyleDeclaration> \| false` | built-in resets | Styles for the PiP `<body>`. An object **replaces** the built-in resets (margin, padding, box-sizing, size, overflow, `centerInPip`). `false` skips body styling entirely. Trusted values only. |
| `forwardKeyboardEvents` | `boolean` | `true` | Re-dispatch real `keydown`/`keyup` from the PiP window on the opener, so page shortcuts keep working. `preventDefault()` on the copy also prevents the original. See [Security](#security). |
| `forwardPointerEvents` | `boolean` | `true` | Re-dispatch real pointer and mouse events on the opener. Coordinates are PiP-relative. See [Gotchas](#gotchas). |
| `restoreScroll` | `boolean` | `true` | Save and restore the scroll positions inside `contentEl` across the round trip. |
| `restoreFocus` | `boolean` | `true` | Save and restore focus and input/textarea selection across the round trip. |
| `fallback` | `'none' \| 'new-tab' \| function` | `'none'` | What `open()` does when Document PiP is unavailable (or `forceFallback` is set) and the video fallback does not apply. `'new-tab'` opens `fallbackUrl`. A function `({ contentEl, originEl, resolvedOptions }) => cleanup \| void` runs your own; its cleanup runs on `close()`. [Recipe](https://github.com/Shakya47/pip-it-up/blob/main/docs/recipes/fallbacks.md). |
| `fallbackUrl` | `string` | — | Required for `'new-tab'`. Only `http:`/`https:`; otherwise `open()` rejects with `ERR_INVALID_FALLBACK`. |
| `forceFallback` | `boolean` | `false` | Use the fallback path even when Document PiP exists (testing, fallback-first apps). |
| `disableVideoPip` | `boolean` | `false` | Turn off the automatic native video PiP fallback. |
| `preferInitialWindowPlacement` | `boolean` | — | Ask the browser to open at its default position instead of where the last window was. |
| `disallowReturnToOpener` | `boolean` | — | Hide the browser's "back to tab" button in the window frame. |

| Callback | When it runs |
| :--- | :--- |
| `onBeforeOpen()` | Before a Document PiP window is requested. Return (or resolve) `false` to cancel. Not called on the video or fallback path. |
| `onOpen(win)` | Right after opening. `win` is the PiP window; on the video PiP and fallback paths it is the opener `window`. |
| `onPipWindowReady(win)` | Document PiP only, on the next animation frame after `onOpen`. |
| `onClose()` | After the window closed and everything was restored. |
| `onError(err)` | When opening fails. `open()` still rejects with the same error. A throwing `onError` is logged and does not replace the rejection. Not called for `ERR_OPEN_ABORTED`. |

## Instance methods

| Member | Description |
| :--- | :--- |
| `open(elements?)` | Open the window. `elements` (`{ contentEl?, originEl? }`) overrides the default slots for this session. Rejects on failure (see [Errors](#errors)). Resolves without opening when already open or opening, when `onBeforeOpen` returns `false`, or when nothing can open and `fallback` is `'none'` (a warning is logged). |
| `close()` | Close the window and restore the content. Also cancels a pending `open()`. |
| `toggle(elements?)` | `close()` if open, otherwise `open(elements)`. Handle its promise like `open()`. |
| `isOpen()` | `true` while a session is open. |
| `getPipWindow()` | The PiP `Window`, or `null` (also `null` on the video and fallback paths). |
| `getState()` | `{ isOpen, isSupported, pipWindow }`. A new object on each change, so it works as a `useSyncExternalStore` snapshot. |
| `subscribe(fn)` | Called on every state change. Returns an unsubscribe function. |
| `updateOptions(options)` | Merge new options. `undefined` values are ignored; `id` and `mode` cannot change after creation. Recomputes `isSupported`. |
| `destroy()` | Permanent teardown: closes, aborts `signal`, drops listeners and element references. Afterwards every method is inert. |
| `id` | The instance id. |
| `signal` | `AbortSignal` aborted by `destroy()`. Pass it to your own `addEventListener` calls. |
| `destroyed` | `true` after `destroy()`. |

**`isSupported` is per instance.** It answers "will `open()` do something here?", not "does this browser have Document PiP?". It is `true` when Document PiP is available (and `forceFallback` is off), when the video fallback applies (the content holds exactly one `<video>`, a video PiP API exists and `disableVideoPip` is not set), or when a usable `fallback` is set (a function, or `'new-tab'` with a valid URL). It is recomputed on every `setDefaultElements`, element registration and `updateOptions`. For the browser-level check, call `isSupported()` from the package.

## Errors

`open()` and `toggle()` reject on failure. Browser errors pass through unchanged (for example `NotAllowedError` without a recent click, including on the video fallback). Errors raised by core carry a `code`:

| Code | `name` | When | `onError` called? |
| :--- | :--- | :--- | :--- |
| `ERR_OPEN_ABORTED` | `AbortError` | `close()` or `destroy()` ran while `open()` was pending (in `onBeforeOpen`, `requestWindow` or the video PiP request). A window that arrives late is closed. | No |
| `ERR_WINDOW_CLOSED` | `PipError` | The window was already closed when the browser handed it over. | Yes |
| `ERR_INVALID_FALLBACK` | `PipError` | `fallback: 'new-tab'` with a missing or non-`http(s)` `fallbackUrl`. | Yes |
| `ERR_DESTROYED` | — | Not a rejection: `open()` on a destroyed instance logs a `console.warn` and resolves. | No |

If anything throws after the window appeared (in `onOpen`, style sync, a bridge), the window is closed again and `open()` rejects with that error.

```ts
pip.open().catch((err) => {
  if (err.name === 'AbortError') return; // you cancelled it
  console.error(err.code ?? err.name, err);
});
```

## Element slots and teardown

`contentEl` and `originEl` are **slots** with different lifetimes: `contentEl` usually lives for a whole session, while `originEl` can be replaced whenever the UI re-renders or the route changes.

| Member | Description |
| :--- | :--- |
| `setDefaultElements(patch)` | Merge slot values. Per slot: `undefined` (or omitted) = leave it, `null` = vacate it, an element = claim it. `{ contentEl: undefined }` is a no-op, not a wipe. |
| `getDefaultElements()` | Current slots. Same object until something changes (safe as a `useSyncExternalStore` snapshot). |
| `subscribeElements(fn)` | Called on slot changes only. Returns an unsubscribe function. |
| `registerElements(patch)` | Claim slots and get a handle: `update(patch)`, `release()`, `released`. Preferred for anything with a lifetime. |
| `registerTeardown(fn)` | Run `fn(pipWindow)` synchronously at the top of `close()`, before the window is destroyed. LIFO; a throwing hook is logged and the rest still run. Returns an unregister function. |

**`release()` is compare-and-clear.** It vacates a slot only if this handle still owns it, so an old origin releasing late cannot wipe the new one. During a route change the incoming element often claims the slot *before* the outgoing one releases it.

```ts
const reg = pip.registerElements({ originEl: slotEl });
// later, when that slot goes away:
reg.release(); // clears only if slotEl is still the registered origin
```

**The restore target is read at close time.** An origin registered while the window is open is where the content goes back.

**Use `registerTeardown` to move DOM out of a PiP window.** The browser destroys that document right after `pagehide`, and core's own `pagehide` listener runs first, so one you add later is too late.

```ts
pip.registerTeardown(() => {
  myHiddenContainer.appendChild(contentEl); // the PiP document is still alive here
});
```

Utilities:

- `mergeElements(current, patch)`: the tri-state merge. Returns `current` by reference when nothing changed.
- `isUsable(el)`: `true` only if `el` is connected to a document whose window is still open. Check it before touching a node you did not create this tick: a node in a closed PiP document is still "in the DOM", but `focus()` on it does nothing or throws.
- `ELEMENT_SLOTS`: `['contentEl', 'originEl']`.
- `startPointerBridge(pipWindow, openerWindow?, signal?)`: the pointer bridge on its own. Returns a stop function.

Keeping content alive across route changes in vanilla JS: [Vanilla route persistence](https://github.com/Shakya47/pip-it-up/blob/main/docs/guides/vanilla-route-persistence.md). React has it built in (`<PipProvider>` / `<PipAnchor>`).

## Registry

A page-wide map from id to instance, so any module can reach a PiP it did not create. Opt-in in core; React's `<PipWrapper id>` registers for you.

| Function | Description |
| :--- | :--- |
| `registerPip(id, instance)` | Register. Last writer wins; a different instance under the same id logs a warning. Never throws. |
| `unregisterPip(id, instance?)` | Remove. With `instance`, only if it is still the registered one (owner-only). Without it, removes unconditionally. |
| `getPip(id)` | The instance, or `null`. |
| `subscribeRegistry(id, fn)` | Called when `id` is registered or unregistered. Returns an unsubscribe function. |
| `clearRegistry()` | Remove every registration and listener (tests). |

To close the window on navigation, call `getPip(id)?.close()` from your router's navigation hook.

```ts
import { createPip, getPip, registerPip, unregisterPip } from '@pip-it-up/core';

const pip = createPip({ id: 'player' });
pip.setDefaultElements({ contentEl: document.getElementById('player')! });
registerPip('player', pip);

// Anywhere else, e.g. a global shortcut (Alt+P):
window.addEventListener('keydown', (e) => {
  if (e.altKey && e.key.toLowerCase() === 'p') {
    getPip('player')?.toggle().catch((err) => console.warn('PiP failed:', err));
  }
});

// On teardown:
unregisterPip('player', pip);
pip.destroy();
```

More: [keyboard shortcuts recipe](https://github.com/Shakya47/pip-it-up/blob/main/docs/recipes/keyboard-shortcuts.md).

## Native video PiP

Two different browser APIs. Use native video PiP when the content **is** a `<video>`; use Document PiP (`createPip`) for anything else.

| | Native video PiP | Document PiP (`createPip`) |
| :--- | :--- | :--- |
| What floats | the video's frames, drawn by the OS | a real window with your DOM |
| Moves DOM? | no | yes |
| Support | ~95%, including Safari/iOS and Firefox | see [Browser support](https://github.com/Shakya47/pip-it-up/blob/main/README.md#browser-support) |

```ts
import { enterVideoPip, exitVideoPip, isInVideoPip } from '@pip-it-up/core';

const video = document.querySelector('video')!;
const button = document.getElementById('video-pip')!;

// Must run inside a click handler (see caveats).
button.addEventListener('click', () => {
  const action = isInVideoPip() ? exitVideoPip(video) : enterVideoPip(video);
  action.catch((err) => console.warn('Video PiP failed:', err));
});
```

| Function | Description |
| :--- | :--- |
| `isSupported()` | The browser has Document PiP. |
| `isVideoPipSupported()` | The standard video PiP API exists. |
| `isWebkitPipSupported()` | Older WebKit presentation mode exists. |
| `isInVideoPip()` | Some element on the page is in video PiP. |
| `enterVideoPip(video)` | Adds `playsinline` if missing (needed on iOS), then tries `requestPictureInPicture()`, `webkitSetPresentationMode('picture-in-picture')`, `webkitEnterFullscreen()`. Rejects if none exists. |
| `exitVideoPip(video)` | Exits through the same three paths. |

Track state with the video's own events (`enterpictureinpicture`, `leavepictureinpicture`, and `webkitpresentationmodechanged` on WebKit), so your UI stays right when the user closes the overlay itself. React's `useVideoPip` does this for you.

**Automatic fallback:** when Document PiP is unavailable and the content holds exactly one `<video>`, `createPip().open()` uses native video PiP instead. Opt out with `disableVideoPip: true`.

### Video PiP caveats

1. **Needs a real user gesture.** Without one: `NotAllowedError: Must be handling a user gesture if there isn't already an element in Picture-in-Picture.`
2. **Tab-switch PiP is limited.** A `visibilitychange` handler only succeeds within the activation window after a click. Details: [Automatic PiP](#automatic-pip).
3. **One PiP element per document.** Requesting a second one moves the overlay to it.
4. **No audio PiP.** To float an audio player's controls and artwork, use Document PiP.
5. **The overlay cannot be styled.** The OS draws it. Custom controls need Document PiP.
6. **`disablePictureInPicture` blocks it.** The browser refuses the request when the attribute is set.
7. **iOS needs `playsinline`.** Without it the video plays fullscreen. `enterVideoPip` adds the attribute for you.

## Automatic PiP

`createAutoPip(enter, options?)` calls `enter` when the document becomes hidden (tab switch or minimise), like YouTube and Google Meet. It decides *when*; you decide *what* opens, so it works for native video PiP and Document PiP alike. Returns a stop function.

```ts
import { createAutoPip, createPip } from '@pip-it-up/core';

// A bare <video>:
const video = document.querySelector('video')!;
const stop = createAutoPip(() => video.requestPictureInPicture(), {
  when: () => !video.paused,
});

// A whole component, stopped automatically by pip.destroy():
const panel = document.getElementById('panel')!;
const pip = createPip();
pip.setDefaultElements({ contentEl: panel });
createAutoPip(() => pip.open(), { when: () => !pip.isOpen(), signal: pip.signal });
```

### Auto-PiP options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `when` | `() => boolean` | always | Checked at attempt time. `false` skips the attempt. |
| `onResult` | `(r: AutoPipResult) => void` | — | Reports every attempt, including expected rejections. |
| `mediaSession` | `boolean` | `false` | Also register the `enterpictureinpicture` Media Session action (see below). |
| `signal` | `AbortSignal` | — | Stop when aborted, instead of calling the stop function. |

### Why an attempt can be rejected

Both `requestPictureInPicture()` and `documentPictureInPicture.requestWindow()` need **transient user activation**:

1. **It lasts about five seconds after a click or keystroke**, across tasks. So a tab switch shortly after interacting succeeds, even though the handler runs later.
2. **A successful call consumes it.** One attempt per gesture; the next one fails with `NotAllowedError` until the user interacts again.
3. **Sticky activation does not count.** A page the user touched minutes ago (`navigator.userActivation.hasBeenActive === true`) is still rejected.
4. **Exception:** swapping content while something is already in PiP does not need activation.

So auto-PiP works when the user interacted just before leaving, and fails on a page left untouched. Check `navigator.userActivation.isActive` to see which case you are in. `onResult` tells you what happened:

```ts
createAutoPip(() => pip.open(), {
  onResult: (r) => {
    if (r.ok) return;             // r.grantedBy is 'gesture' or 'browser'
    if (!r.hadActivation) return; // expected: no recent gesture
    console.error(r.error);       // the gesture was there; something else broke
  },
});
```

**Gesture-free auto-PiP.** Chrome can enter PiP with no gesture, but only when both are true:

- the origin is eligible: camera or microphone in use (why Google Meet always works), an installed PWA, or the user allowed the site in `chrome://settings/content/autoPictureInPicture`;
- the page registered the `enterpictureinpicture` Media Session action: `mediaSession: true`, or call `registerEnterPipAction(enter)` yourself (returns an unregister function).

The action only exists while media is playing, so it does nothing for a non-media component. There is one Media Session per document: register from one owner. On an ineligible origin the browser simply never calls it. The registration also adds a PiP button to the browser's media controls.

**Boundary:** it listens for `visibilitychange`. Switching to another app while the browser window stays visible does not hide the document, so nothing happens.

## Gotchas

- **Cross-origin iframes do not work in the PiP window.** YouTube, Vimeo, Maps and Spotify embeds get reloaded in a new document and refuse to play (YouTube shows Error 153). This is a browser limitation. For video, use a `<video>` with a direct source URL.
- **`move` keeps state.** The real node relocates, so `<video>` and `<audio>` keep playing, `<canvas>` keeps its buffer and WebRTC streams stay connected.
- **Libraries that cache `document` or `window`.** Moving a node does not update a reference a library stored at startup. Libraries that read `node.ownerDocument.defaultView` live (Monaco) need nothing. Libraries that cache it (ProseMirror's `EditorView`) need their own refresh: call `view.updateRoot()` in `onPipWindowReady` and again after `close()`. Look for a stored `document`/`window` field to tell which you have. Prefer the refresh over rebuilding the component, which loses undo history, scroll and selection.
- **Style sync fetches external CSS twice** (once per document). A stylesheet behind auth or a private CDN can fail silently in the PiP window, leaving it unstyled. Use `copyStyles: 'once'` plus inlined critical CSS.
- **Bridged pointer coordinates are PiP-relative.** A click at (20, 20) in the PiP window arrives at (20, 20) on the opener, which is a different element. Bridged events carry a non-enumerable `pipItUpBridged: true`; skip them in coordinate-based code, or set `forwardPointerEvents: false` (for `elementFromPoint`, drag libraries, canvas hit-testing). Forwarded types: `pointerdown`, `pointermove`, `pointerup`, `pointercancel`, `mousedown`, `mousemove`, `mouseup`, `click`.

  ```ts
  window.addEventListener('pointerdown', (e) => {
    if ((e as PointerEvent & { pipItUpBridged?: boolean }).pipItUpBridged) return;
    // opener-only logic
  });
  ```

- **`'new-tab'` has no close signal.** The instance stays open until you call `close()`.
- **`mode: 'portal'`** exists in the `DomMode` type for the React binding. In vanilla `createPip` it moves nothing; use `move` or `clone`.

**Move vs clone:**

| Mode | Use when | Avoid when |
| :--- | :--- | :--- |
| `move` | The content has state: video, canvas, WebGL, WebRTC, editors, live data. | You need it visible in both windows at once (a node has one parent). |
| `clone` | A static, read-only copy in the PiP window (a preview, a printable view). | The content has state. `addEventListener` listeners and form state are not copied, `<script>` does not re-run, and inline handlers (`onclick="…"`) **are** copied and run in the PiP window. |

## Security

- **Same-origin only.** The PiP window is same-origin with the opener by design, and needs a secure context (HTTPS). Opening from inside an `<iframe>` throws `NotAllowedError`; it must be a top-level page.
- **Keyboard bridge.** Only real (`isTrusted`) keystrokes are forwarded, with full `key`, `code` and modifiers. Every opener `keydown`/`keyup` listener sees them (analytics, session replay), so set `forwardKeyboardEvents: false` when the window holds passwords, card numbers or private chat. Forwarded keys are dispatched on `window` only, so a hotkey listener scoped to a container element never sees them: the privacy-safe pattern for opener shortcuts.
- **Pointer bridge.** Only real (`isTrusted`) events are forwarded. Coordinates are PiP-relative; see [Gotchas](#gotchas).
- **Style sync.** Inline `<style>` text is copied verbatim, so injected CSS on the opener reaches the PiP window too. External stylesheets are fetched a second time.
- **`fallbackUrl`.** Only `http:`/`https:` pass. The new tab navigates to the validated `href`, so a `<base href>` on the page cannot redirect it. It opens with `noopener,noreferrer`, which prevents reverse tabnabbing. Open redirects are still possible, so allowlist URLs derived from user data.
- **`clone` mode.** `cloneNode(true)` copies inline handlers, the same trust level as `innerHTML`. Never clone untrusted or user-pasted HTML. React never uses clone mode.
- **`pipBodyStyles`.** Written to `body.style` without sanitising. Trusted values only.
- **Registry.** Same-page coordination, not isolation: any script on the page can call `getPip(id).open()`. Never build ids from user content. Pass the instance to `unregisterPip` so a stale cleanup cannot remove a newer registration.
- **CSP and Trusted Types:** see [csp-and-trusted-types.md](https://github.com/Shakya47/pip-it-up/blob/main/docs/csp-and-trusted-types.md).
- **Report a vulnerability** privately through [GitHub Security Advisories](https://github.com/Shakya47/pip-it-up/security/advisories/new) ([SECURITY.md](https://github.com/Shakya47/pip-it-up/blob/main/SECURITY.md)).
