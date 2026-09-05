---
"@pip-it-up/core": minor
"@pip-it-up/react": minor
---

Route-persistent Picture-in-Picture: zero-remount teleportation registry.

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
