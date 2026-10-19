# SSR

What: server rendering and hydration of @pip-it-up/react in Next.js (App Router): no portal markup on the server, no hydration mismatches, and PiP working after hydration.
Code: packages/react/src/SwitchingPortal.tsx (client gate), PipWrapper.tsx, PipProvider.tsx (isClient gate, lazy entries), PipAnchor.tsx (claimAnchor), apps/e2e-next/app
Spec: apps/e2e/tests/ssr/ssr.spec.ts (next target; its `/` also runs the whole contract client-only)
Last run: 2026-09-27 · next-chrome next-firefox next-webkit

## PipWrapper

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| SS1 | Fetch `/ssr` raw from the server | The HTML has the page ("Server HTML", "Content below") but no portal markup: no `data-pip-shuttle`, no wrapped content (V20) | next | any | pass 2026-09-29 · next-chrome next-firefox next-webkit |
| SS2 | Load `/ssr` | Hydrates ("Hydrated") with no hydration warning or error; the wrapped content renders and its state works | next | any | pass 2026-09-29 · next-chrome next-firefox next-webkit |
| SS3 | After hydration, pop the content out, then close | The same node goes to PiP and back with its state | next | docpip | pass 2026-09-29 · next-chrome next-firefox |

## PipProvider

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| SS4 | Fetch `/ssr-persist` raw | The anchor box (`data-pip-anchor="widget"`) is there, no portal markup (V20) | next | any | pass 2026-09-29 · next-chrome next-firefox next-webkit |
| SS5 | Load `/ssr-persist` | Hydrates clean, the widget docks in its anchor ("Placement: anchor"), and pops out | next | docpip | pass 2026-09-29 · next-chrome next-firefox |

## Notes

- **Fixed 2026-09-28:** (SS5) PipProvider keeps claims that arrive before their entry exists (`pendingClaims`) and applies them in a layout effect once the entries exist. Was: **app bug, confirmed 2026-09-27:** with a server-rendered `<PipProvider>`, anchors never dock: after hydration the shuttle stays in the garage and the anchor keeps its placeholder (checked in the page: shuttle parent = `[data-pip-garage]`). The same page rendered client-only (react target, route-persistent.md RP1) docks fine. Likely cause, from the code: during the hydration render `isClient` is false, so PipProvider creates no entries (PipProvider.tsx "4.2 Lazy entry creation" is gated on `isClient`); `<PipAnchor>`'s ref callback runs in that commit and `claimAnchor` returns early because `entries.get(id)` is undefined; the ref callback never runs again, so the claim is lost. Every server-rendered first page with route-persistent PiP is affected.
- By design the server renders no portal markup (SwitchingPortal returns `null` until the client gate flips), so wrapped content appears only after hydration (SS1). That is V20, not a bug; it does mean a content flash on SSR pages.
- The contract suite also runs on this target (`/`, client-only via `next/dynamic` with `ssr: false`, reusing apps/e2e-react's Contract): results match the react target row for row.
- React: the Next app aliases `react`/`react-dom` to its own copy (next.config.ts `turbopack.resolveAlias`), because the linked @pip-it-up/react would otherwise resolve its React 18 dev copy.
- Next's dev build calls `console.timeStamp('Hydrated')`; Firefox reports it as a console message, so SS2 counts only warnings and errors.

## Corrections

<!-- Dated lines from the user's corrections. They override what the code suggests. -->
