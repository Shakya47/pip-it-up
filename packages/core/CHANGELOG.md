# @pip-it-up/core

## 0.3.0

### Minor Changes

- d11e953: Fixes found by the new real-browser e2e suite (Chrome, Firefox, WebKit, real Safari, Next.js SSR).

  **Behaviour changes**
  - `open()` now rejects when it fails, even when `onError` is set. `onError` is still called first. It used to resolve whenever `onError` was set, so callers such as `createAutoPip` / `useAutoPip` reported blocked attempts as successes. If you call `open()` or `toggle()` yourself without awaiting it (for example in a click handler), add a `.catch()`. `<PipTrigger>` does this for you. More failures now reject (through `onError`) instead of resolving:
    - the automatic video fallback refused by the browser (Safari `NotAllowedError`) when `fallback` is `'none'`;
    - a custom `fallback` function that throws;
    - `fallback: 'new-tab'` without a usable `fallbackUrl` (code `ERR_INVALID_FALLBACK`);
    - a window that is already closed when it arrives (`ERR_WINDOW_CLOSED`).
  - `close()` or `destroy()` while `open()` is still pending cancels it: a late window is closed and `open()` rejects with an `AbortError` (code `ERR_OPEN_ABORTED`). `onError` is not called, and `<PipWrapper>` / `<PipTrigger>` don't log it. It used to open the window anyway. The new codes are in the exported `PipOpenErrorCode` type.
  - If something throws after the window opened (`onOpen`, style sync…), the window is now closed and teardown hooks run; it used to stay open, untracked. A throwing `onError` no longer replaces the original error. If `onOpen` or a state subscriber closes the window during `open()`, `onOpen` no longer runs after `onClose`, `onPipWindowReady` no longer fires on the closed window, and teardown hooks don't run twice.
  - Controlled `<PipWrapper open={false}>` set while an open is still pending now cancels it (the window used to open anyway and stay open).
  - `useVideoPip`: `enter()` and `leave()` now reject when the browser refuses (for example `NotAllowedError` without a recent user gesture), and `enter()` rejects when no `<video>` is attached, so `useAutoPip(enter)` reports the real outcome. If you call `enter()`/`leave()` from a handler, add a `.catch()` or use `toggle()`, which still never rejects (it logs a `[useVideoPip]` warning instead).
  - `state.isSupported` (from `getState()`, `usePip()`, `usePipContext()`) now means "open() will do something for this instance": Document PiP, the automatic single-`<video>` fallback, or a usable `fallback` (`'new-tab'` needs a valid `fallbackUrl`). `<PipTrigger>` uses it, so `renderUnsupported` finally shows in browsers with only video PiP (Safari) instead of a button that did nothing. It is re-checked whenever the content changes, so a `<video>` rendered later inside a `<PipWrapper>` or `usePip()` content shows the trigger. `useIsPipSupported()` is unchanged.
  - `<PipTrigger>` without a `<PipWrapper>` around it and without `pipId` now renders nothing (or `renderUnsupported`) instead of a button that did nothing. It no longer warns about a failed open when the owner handles errors (`onError` on the wrapper, `usePip()` or `PipProvider` options).
  - `<PipWrapper>` no longer logs its own warning for a failed `open`/`defaultOpen` when `onError` is set.
  - `<PipWrapper>` accepts no `mode` prop (it always portals); a JS caller passing a `mode` other than `'portal'` gets a console warning.
  - `<PipWrapper>` without `width`/`height` sizes the window to your content's own element (when it is a single element with no text beside it), like `<PipProvider>` and `createPip()`. It used to measure its own full-width wrapper, so every window was as wide as the page column. A custom `fallback` function now receives that element as `contentEl` too (it used to get the wrapper).
  - `fixedSize` keeps the size lock on the PiP document (html/body) but no longer tries to resize the window back: browsers only allow `resizeTo()` with a user gesture, and it set the outer size.

  **Fixes**
  - Move mode (`createPip`) returns the content to the `originEl` passed to `open()` (it only used the default origin, so the content stayed in the closed window), or to the parent it had at open time. `close()` also exits video PiP for a video in a `contentEl` passed to `open()`.
  - Move mode (`createPip`) puts back the inline width/height it overwrote on the content and the origin, instead of clearing them, so the second window opens at the same size as the first.
  - Move mode restores focus, selection and scroll after the content is back in the page (they were restored too early and lost).
  - `<PipWrapper reserveSpace={false}>` no longer reserves space with its placeholder.
  - `<PipProvider>`:
    - the `frozen` activity level works: `freeze`/`resume` are listened for on `document`, where browsers fire them.
    - on a route change the hosted subtree is parked before its anchor is removed, so iframes don't reload and media isn't interrupted (with `Element.moveBefore`).
    - server-rendered pages (Next.js): anchors now dock after hydration, including two anchors for one id.
  - Development-only diagnostics now run in bundled browser code; they were always off because of a `typeof process` check. In development builds this means `ERR_UNKNOWN_ID` now throws (an error boundary will catch it), and `ERR_DUPLICATE_ANCHOR` and the anchor style warnings appear.
  - `usePip()`: React event handlers (`onClick`, `onChange`, …) inside the moved content now work while it is in PiP. The node is moved rather than portalled, so React, which listens on its root in the main document, never heard those events; `usePip()` now bridges them, including `preventDefault()` and `stopPropagation()`. Bridged events are marked `pipItUpBridged` (page-level capture listeners on `window`/`document` also see them and can skip them); `offsetX`, `composedPath()`, `getCoalescedEvents()` and similar come from the real event.
  - `usePip()` survives React Strict Mode: its instance was destroyed by Strict Mode's simulated unmount, so the first `open()` failed with `ERR_DESTROYED`. Teardown is now deferred and cancelled on remount (a real unmount still destroys it). Its `id` registration is also removed only if it is still its own.
  - `useAutoPip`: the `signal` option is now honoured (it was accepted by the type but ignored).
  - Automatic video fallback: `onOpen` fires once per open. Safari fires `enterpictureinpicture` after `requestPictureInPicture()` resolves, which reported the open a second time.

## 0.2.0

### Minor Changes

- b41c363: Automatic Picture-in-Picture on tab switch.

  **@pip-it-up/core**
  - `createAutoPip(enter, options?)` — enters PiP when the document becomes hidden. Framework-agnostic,
    returns a disposer, and drives either native Video PiP or Document PiP since the caller supplies
    `enter`. Options: `when`, `onResult`, `mediaSession`, `signal`. Tree-shakes to 487 B gzipped.
  - `registerEnterPipAction(enter)` — registers the `enterpictureinpicture` Media Session action, the
    page-side opt-in that lets Chrome trigger PiP itself with no user gesture on eligible origins.
  - New types: `AutoPipOptions`, `AutoPipResult`.

  **@pip-it-up/react**
  - `useAutoPip(enter, options?)` — the same behaviour as a hook, always on unless `enabled: false`.
    `enter` is read through a ref, so passing a fresh inline arrow each render never detaches the
    listener.

  `onResult` reports whether an attempt was paid for by a live user gesture (`grantedBy: 'gesture'`),
  granted by the browser (`grantedBy: 'browser'`), or rejected — and for a rejection, whether an
  activation was live (`hadActivation`), which separates the expected "nothing recent authorised it"
  case from a real failure. Both READMEs document the transient-activation rules that govern this:
  activation is time-based and survives across tasks, but a successful call consumes it, so there is
  one attempt per gesture.

  Both READMEs also document what happens when two components enable auto-PiP at once: a single tab
  switch carries one transient activation, so exactly one wins and the other is rejected with
  `NotAllowedError`. The two trigger paths order themselves in opposite directions — `visibilitychange`
  fires every listener so the _first_ registered wins, while `enterpictureinpicture` has one global
  handler slot so the _last_ registered wins — which makes the outcome depend on JSX order. The docs
  show arbitrating explicitly through `when` instead.

  Also documents the correct fix for editors that cache a document reference (TipTap/ProseMirror's
  `EditorView.root`): call the library's own invalidation — `editor.view.updateRoot()` keyed on
  `state.pipWindow` — rather than remounting the component via a `key`, which discards the undo
  history this library exists to preserve.

- b41c363: Route-persistent Picture-in-Picture: zero-remount teleportation registry.

  **@pip-it-up/core**
  - Added tri-state element registration: `registerElements(patch)` returns a compare-and-clear
    handle, plus `getDefaultElements()` and `subscribeElements()`. Element slots now distinguish
    `undefined` (leave alone), `null` (vacate) and an `HTMLElement` (claim).
  - Added `registerTeardown(fn)`, a synchronous hook list run at the top of `close()` before the PiP
    window is destroyed, for DOM repatriation that cannot wait for an async callback.
  - `destroy()` is now terminal: it aborts a new `instance.signal`, exposes `instance.destroyed`, and
    releases retained DOM references.
  - `unregisterPip(id, instance)` is now compare-and-delete, so an outgoing component's cleanup can no
    longer remove an incoming component's registration.
  - Behaviour change: `setDefaultElements({ contentEl: undefined })` is now a no-op instead of a wipe.
    Pass `null` to vacate a slot explicitly.
  - Behaviour change: `updateOptions()` no longer overwrites stored options with `undefined`, so
    partial updates are safe.
  - Security: `fallbackUrl` now navigates to the parsed, validated URL rather than the raw input,
    closing a `<base href>` resolution differential. Bridged pointer events carry a non-enumerable
    `pipItUpBridged` marker.

  **@pip-it-up/react**
  - `<PipWrapper>` no longer remounts its subtree when the PiP window opens or closes. `<video>`
    playheads, `<canvas>` bitmaps, WebGL contexts, WebRTC streams and component state are all
    preserved. Content is hosted in an immortal portal container that is moved with native DOM APIs.
  - Added `<PipProvider>` and `<PipAnchor>` for route-persistent PiP: content mounted at the
    application root docks into different route-level anchors with zero unmounts and zero layout
    shift.
  - Added the dormancy hooks `useDormancy`, `useActiveEffect`, `useRevealEffect` and
    `useAdaptiveInterval` so hosted subtrees can throttle work when backgrounded or parked.
  - Behaviour change: `<PipWrapper>`'s origin element is now `position: relative` instead of
    `display: contents`, so it generates a real layout box. This is required for size reservation and
    placeholder positioning.
  - Removed the internal `PipPortal` component. It was never exported.

## 0.1.10

### Patch Changes

- 5cc1e2e: Introduce video Picture-in-Picture fallback support for browsers that do not support the Document Picture-in-Picture API (e.g. Safari, iOS browsers, Firefox).

  Core:
  - Add video PiP support detection (`isVideoPipSupported`, `isWebkitPipSupported`, `isInVideoPip`) and APIs (`enterVideoPip`, `exitVideoPip`)
  - Auto-detect single `<video>` elements to request standard video PiP fallback when document PiP is unavailable or `forceFallback` option is true
  - Add pointer events bridge to forward events from the PiP window back to the main opener window
  - Add `updateOptions` to dynamically update instance options after initialization
  - Implement re-entrancy protection, cross-document element checks, and stylesheet child-list observation improvements

  React:
  - Add a new `useVideoPip` hook to manage standard/WebKit video PiP on a specific video element
  - Support dynamic option updates via `updateOptions` in `usePip` and `PipWrapper`
  - Add screen-reader announcements (live regions) and automatic focus redirection on PiP open and close
  - Automatically reserve layout space and size for content using `ResizeObserver` while PiP is open
  - Update `useIsPipSupported` to check for both document and video PiP compatibility

## 0.1.9

### Patch Changes

- 0eb4867: Cleaned up the codebase to address community feedback. Removed the unused mode prop from the React package, deleted dead references to maintenance guides, and streamlined code comments and README descriptions.

## 0.1.8

### Patch Changes

- 99c4cf2: Defensive coding hardening — six improvements for resilience against misuse, third-party interference, and future refactors. No behavioral changes for correct callers.
  - **`pipBodyStyles` / `fallbackUrl` JSDoc**: Documented as trusted-input-only fields to surface CSS/URL injection risks to consumers.
  - **Clone mode documentation**: Added JSDoc on `applyCloneMode` and README entry documenting `cloneNode(true)` semantics (inline handlers ARE cloned, event listeners are NOT, form state is NOT preserved).
  - **SSR audit**: Verified all `window` references in helper files are inside function bodies — no module-scope access that would crash in SSR environments.
  - **Cross-document `instanceof` comment**: Documented the cross-realm constructor trap in `focus-scroll.ts` with guidance for future refactors.
  - **Disposer error isolation**: Wrapped each `dispose()` call in `try/catch` so one failing disposer doesn't prevent the rest from running — prevents resource leaks from faulty cleanup.
  - **Close-polling documentation**: Added inline comments explaining the `setInterval` close-polling re-entrancy safety.

- 99c4cf2: Security hardening: three fixes for identified vulnerabilities.
  - **fallbackUrl validation**: `fallback: 'new-tab'` now validates URLs — only `http:` and `https:` protocols are allowed. `javascript:`, `data:`, and other dangerous schemes are rejected with a `console.warn`. All new-tab windows are opened with `noopener,noreferrer` to prevent reverse tabnabbing.
  - **Registry collision warning**: `registerPip()` now emits a `console.warn` when a different instance is registered under an existing ID, surfacing accidental collisions or third-party hijacking. Re-registering the same instance reference (e.g., during React Strict Mode remounts) does not trigger the warning.
  - **Keyboard bridge isTrusted filter**: The keyboard event bridge now ignores synthetic `dispatchEvent()` calls in the PiP window (`e.isTrusted === false`), preventing spoofed keystroke escalation to the opener window.

## 0.1.7

### Patch Changes

- 76dd252: Update library package metadata and documentation to officially transition to a Public Beta status. This includes:
  - Updating core and React npm package descriptions to signal Public Beta status.
  - Adding top-level status badges and aligning the v1.0 public roadmap (featuring Vue, Svelte, and Angular binding tracks) in READMEs.

## 0.1.6

### Patch Changes

- e204133: Removed unsupported lockAspectRatio prop and massively improved Registry and Iframe documentation.

## 0.1.5

### Patch Changes

- 896cc00: Remove debug console logs from production builds.

## 0.1.4

### Patch Changes

- 5c77fb7: Significant changes have been made across multiple rounds:
  - Round 2: dead code removal, anti-pattern fixes, performance improvements
  - Round 3: `isInsidePip` correctness, Strict Mode destroy fix, React 19 ref compat, registry fixes
  - Playground regression fix: `setDefaultElements` API, `PipPortal` context threading, `PipWrapper` mode override

## 0.1.1

### Patch Changes

- 6ddbc9d: initial release of core engine and react bindings
