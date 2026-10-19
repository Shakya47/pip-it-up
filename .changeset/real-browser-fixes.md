---
"@pip-it-up/core": minor
"@pip-it-up/react": minor
---

Fixes found by the new real-browser e2e suite (Chrome, Firefox, WebKit, real Safari, Next.js SSR).

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
