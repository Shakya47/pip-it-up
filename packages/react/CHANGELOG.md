# @pip-it-up/react

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

### Patch Changes

- Updated dependencies [b41c363]
- Updated dependencies [b41c363]
  - @pip-it-up/core@0.2.0

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

- Updated dependencies [5cc1e2e]
  - @pip-it-up/core@0.1.10

## 0.1.9

### Patch Changes

- 0eb4867: Cleaned up the codebase to address community feedback. Removed the unused mode prop from the React package, deleted dead references to maintenance guides, and streamlined code comments and README descriptions.
- Updated dependencies [0eb4867]
  - @pip-it-up/core@0.1.9

## 0.1.8

### Patch Changes

- Updated dependencies [99c4cf2]
- Updated dependencies [99c4cf2]
  - @pip-it-up/core@0.1.8

## 0.1.7

### Patch Changes

- 76dd252: Update library package metadata and documentation to officially transition to a Public Beta status. This includes:
  - Updating core and React npm package descriptions to signal Public Beta status.
  - Adding top-level status badges and aligning the v1.0 public roadmap (featuring Vue, Svelte, and Angular binding tracks) in READMEs.
- Updated dependencies [76dd252]
  - @pip-it-up/core@0.1.7

## 0.1.6

### Patch Changes

- e204133: Removed unsupported lockAspectRatio prop and massively improved Registry and Iframe documentation.
- Updated dependencies [e204133]
  - @pip-it-up/core@0.1.6

## 0.1.5

### Patch Changes

- 896cc00: Remove debug console logs from production builds.
- Updated dependencies [896cc00]
  - @pip-it-up/core@0.1.5

## 0.1.4

### Patch Changes

- 5c77fb7: Significant changes have been made across multiple rounds:
  - Round 2: dead code removal, anti-pattern fixes, performance improvements
  - Round 3: `isInsidePip` correctness, Strict Mode destroy fix, React 19 ref compat, registry fixes
  - Playground regression fix: `setDefaultElements` API, `PipPortal` context threading, `PipWrapper` mode override

- Updated dependencies [5c77fb7]
  - @pip-it-up/core@0.1.4

## 0.1.1

### Patch Changes

- 6ddbc9d: initial release of core engine and react bindings
- Updated dependencies [6ddbc9d]
  - @pip-it-up/core@0.1.1
