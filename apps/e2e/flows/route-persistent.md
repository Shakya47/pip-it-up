# Route-persistent PiP

What: `<PipProvider registry>` + `<PipAnchor id>`: subtrees mounted once, docking into whichever route renders their anchor, floating in PiP, or parked in an attached inert garage; dormancy levels; the eviction lease; error codes.
Code: packages/react/src/PipProvider.tsx, PipAnchor.tsx, SwitchingPortal.tsx, garage.ts, dormancy.ts, useDormancy.ts, useLayoutReservation.ts, errors.ts
Spec: apps/e2e/tests/react/persist.spec.ts (contract extension `@ext-persist`, react target page `#/persist/<home|away>`); the playground's version: playground.md PG13–PG15
Last run: 2026-09-27 · matrix (chrome, firefox, webkit; msedge is CI-only)

## Placements

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| RP1 | Open `#/persist/home` | The tracker is docked ("Placement: anchor", "Level: active") and counting | ext-persist | any | pass 2026-09-29 · react-chrome react-firefox react-webkit |
| RP2 | Pop the tracker out ("↗ Pop out") | PiP shows "Placement: pip"; the anchor shows "Tracker is away"; "Content below" doesn't move (V15) | ext-persist | docpip | pass 2026-09-29 · react-chrome react-firefox |
| RP3 | In PiP: go Away, back Home, then close from the OS | Still in PiP across both routes and counting; after closing, the same node is docked with its count (V10, V13) | ext-persist | docpip | pass 2026-09-29 · react-chrome react-firefox |
| RP4 | With no window open, go Away | The shuttle is parked in `[data-pip-garage]` on `<body>` with `inert`, `aria-hidden="true"`, `content-visibility: hidden`; "Tracker notes" is gone from the accessibility tree and can't take focus; same node (V14) | ext-persist | any | pass 2026-09-29 · react-chrome react-firefox react-webkit |
| RP5 | Go Away, then Home | "Level: dormant" while parked; back Home it's "active" and kept its count | ext-persist | any | pass 2026-09-29 · react-chrome react-firefox react-webkit |
| RP10 | Home → Away → Home with the window closed | The same node returns; on browsers with `moveBefore` the tracker's iframe does NOT reload ("Frame loads" unchanged); without it, it reloads (declared per browser) | ext-persist | any | pass 2026-09-29 · react-chrome react-firefox react-webkit |

## Dormancy and media

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| RP6 | `dormantMedia=pause` (default): the player's video plays, go Away, come back | Paused while parked; playing again on return | ext-persist | any | pass 2026-09-29 · react-chrome react-firefox react-webkit |
| RP7 | `dormantMedia=keep`: go Away | The parked video keeps playing | ext-persist | any | pass 2026-09-29 · react-chrome react-firefox react-webkit |
| RP8 | Hide the tab (simulated), then show it | Docked tracker: "Level: background", then "active" | ext-persist | any | pass 2026-09-29 · react-chrome react-firefox react-webkit |
| RP9 | Dispatch Page Lifecycle `freeze` then `resume` the way Chromium does (at the document, not bubbling) | "Level: frozen", then "active" (V18) | ext-persist | any | pass 2026-09-29 · react-chrome react-firefox react-webkit |
| RP16 | Hide the tab with a `useAdaptiveInterval` counter running (background period 15 s) | The count stops while hidden and resumes once visible | ext-persist | any | pass 2026-09-29 · react-chrome react-firefox react-webkit |
| RP17 | Send the widget to the garage and back, twice | `useRevealEffect` runs again each time ("Reveals" goes up) | ext-persist | any | pass 2026-09-29 · react-chrome react-firefox react-webkit |
| RP18 | Hide the tab, then show it | `useActiveEffect` cleans up in the background ("stopped") and runs again when visible ("running") | ext-persist | any | pass 2026-09-29 · react-chrome react-firefox react-webkit |

## Lease and errors

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| RP11 | `gcGraceMs=300`: pop out, then "Remove tracker from registry" | Its PiP window closes at once; after the grace period its shuttle is removed from the DOM | ext-persist | docpip | pass 2026-09-29 · react-chrome react-firefox |
| RP12 | `gcGraceMs=5000`: remove the tracker from the registry, then restore it (two separate renders) | A FRESH widget docks in its anchor: a new node, its count restarted (removing a key means the widget is gone) | ext-persist | any | pass 2026-09-29 · react-chrome react-firefox react-webkit |
| RP13 | An anchor whose id isn't in the registry (`unknownAnchor=1`), development build | Throws `[pip-it-up] ERR_UNKNOWN_ID` (caught by an error boundary) | ext-persist | any | pass 2026-09-29 · react-chrome react-firefox react-webkit |
| RP14 | `<PipAnchor>` outside any `<PipProvider>` | Throws `ERR_NO_PROVIDER` | ext-persist | any | todo |
| RP15 | Two anchors for one id mounted for more than a frame (dev) | Warns `ERR_DUPLICATE_ANCHOR` | ext-persist | any | todo (RP13 fixed 2026-09-28: dev diagnostics run now, so this is testable) |

## Notes

- **Fixed 2026-09-28:** (RP9) PipProvider listens for `freeze`/`resume` on `document` (unit tests now dispatch there too). Was: **app bug, confirmed 2026-09-27:** Chromium dispatches `freeze`/`resume` at the Document with a non-bubbling event (blink document.cc `DispatchFreezeEvent`: `Event::Create(kFreeze)`; local_frame.cc: `Event::Create(kResume)`), and the Page Lifecycle spec defines `onfreeze`/`onresume` on Document. PipProvider listens with `window.addEventListener('freeze' | 'resume')` without capture (PipProvider.tsx:517-525), so the `frozen` level is never reached by a real freeze. Real freezes can't be produced under Playwright (CDP `Page.setWebLifecycleState` is a no-op, probed 2026-09-27), so RP9 dispatches the event exactly the way Chromium does.
- **Fixed 2026-09-28:** (RP10) `releaseAnchor` moves the shuttle out during the anchor's ref cleanup, while it is still connected, so `moveBefore` is used; the iframe no longer reloads in Chrome/Firefox (WebKit, without moveBefore, still reloads as declared). Was: **the reload confirmed 2026-09-27; the cause is inferred from the code:** on a route change React deletes the anchor element while the shuttle is still its child, so the shuttle (and its iframe) is detached with it; SwitchingPortal's layout effect then moves the now-disconnected shuttle into the garage, where `moveHost` must use `appendChild` (moveBefore needs a connected node). The iframe reloads, even in Chrome. MAINTENANCE §11's premise ("park in an attached garage so media removal steps never run") is broken for the route-change path; the same detachment would pause media and drop focus. Media in RP6 is paused by the dormancy policy anyway, which hides it.
- **Not a bug (RP2), 2026-09-28:** the reservation is exact (233.9 px docked and away); the anchor itself moved because the header's trigger label glyph ("⊠ Close") changes the header height. Test bug, fixed: RP2 now measures the content below relative to the anchor. Was: **possible bug:** the content below the anchors moves up 5 px when the tracker pops out, so the reservation is 5 px short of the docked box. Cause not diagnosed (margin collapsing through the anchor box is one candidate). The playground's tracker (PG14) doesn't show it.
- RP12 (decided 2026-09-28, see Corrections): the lease keeps the instance and shuttle for a same-commit rebuild (spec §2.5); a key that is gone across renders unmounts its widget, and re-adding it mounts a fresh one. **Docs to update:** say this in the React README's route-persistent section (`gcGraceMs`).
- **Fixed 2026-09-28:** (RP13) `isDevEnv()` reads the literal `process.env.NODE_ENV` (bundlers replace it) inside a try/catch, with no `typeof process` guard (packages/react/src/errors.ts). Was: **app bug, confirmed 2026-09-27:** `isDevEnv()` (errors.ts) is `typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production'`. In the browser under Vite `process` is undefined (checked on the page), so every dev-only diagnostic is off in development: ERR_UNKNOWN_ID only warns, ERR_DUPLICATE_ANCHOR and the `display: contents` / `position: static` anchor warnings never fire. Webpack 5 doesn't polyfill `process` either.
- Parked content is aria-hidden, so tests read it through `[data-pip-shuttle="tracker"]`, not role locators.
- RP10 branches on the DECLARED `moveBefore` capability (lib/capabilities.ts), never on feature detection. Safari (no moveBefore) is expected to reload.

## Corrections

<!-- Dated lines from the user's corrections. They override what the code suggests. -->
- 2026-09-28 (RP12): removing a registry key means the widget is gone. Re-adding it later mounts a fresh widget; state is NOT kept across renders. The lease only covers a key that returns within the same commit. Document this; don't keep orphaned widgets mounted.
