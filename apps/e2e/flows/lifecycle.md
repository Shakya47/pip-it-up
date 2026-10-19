# Lifecycle

What: opening and closing a Document PiP window through a PipInstance: callbacks, the isOpening lock, one window per tab, onBeforeOpen, user activation, destroy.
Code: packages/core/src/createPip.ts (open, close, toggle, destroy), packages/react/src/PipWrapper.tsx
Spec: apps/e2e/tests/contract/lifecycle.spec.ts
Last run: 2026-09-27 · matrix (chrome, firefox, webkit; msedge is CI-only)

## Open and close

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| LC1 | Click "Open PiP" | A PiP window opens holding the same "PiP content" node; status "PiP: open"; button "Close PiP"; log `open`, `ready` in that order | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| LC2 | Open, then click "Close PiP" in the opener | The window closes; the same node is back; status "PiP: closed"; log ends `close` | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| LC3 | Open, then click "Close from inside" (instance.close() from the PiP window) | Same as LC2 | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| LC4 | Open, then close the window from the OS (`pip.close()`, fires `pagehide`) | Same node back, status closed, `close` logged | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| LC5 | Two clicks on "Open PiP" in the same task (before requestWindow can resolve) | Exactly one window and one `open` (isOpening lock, MAINTENANCE §5) | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| LC6 | Content sized 420×300: open, close from the OS, open again | The second window has the same inner size as the first (MAINTENANCE §8) | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| LC7 | "+1" twice, open, "+1" inside PiP, close | "Count: 2" in PiP, "Count: 3" after the click, still "Count: 3" back in the page (V11) | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| LC8 | Two instances: open A, then open B | The browser closes A's window (one Document PiP window per tab): A logs `close`, its content is back; B is open | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |

## Guards

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| LC9 | `beforeOpen=deny` (onBeforeOpen returns false), click "Open PiP" | Log `before-open` only; no window; status closed | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| LC10 | `beforeOpen=allow`, click "Open PiP" | Log `before-open`, `open`, `ready` | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| LC11 | Toggle with no user gesture: a page timer calls open 6.5 s after the last Playwright call | onError gets NotAllowedError (log `error:NotAllowedError`); no window; status closed | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| LC12 | `destroy()`, then click "Open PiP" | Nothing opens, no callbacks; console warns `[pip-it-up] ERR_DESTROYED` | vanilla | docpip | pass 2026-09-29 · vanilla-chrome vanilla-firefox |
| LC13 | Load the target inside an `<iframe>` (the playground's IframeGuard demo) and click Open | `open()` is refused: the first log entry is `error:<name>`, status stays closed, no window | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |

## Notes

- LC5 (2026-09-27, Firefox): a real double click is two tasks. Firefox resolves the first `requestWindow()` in between, so the second click toggles the window closed, which is correct. The lock is only for overlapping calls, so LC5 clicks twice inside one task.

- Targets drive the instance: vanilla via `createPip`, react via `<PipWrapper id>` + `getPip(id).toggle()` (apps/e2e-react/src/Contract.tsx). `window.__contract` (toggle, destroy) exists only for LC11/LC12, which must act without a click.
- **Fixed 2026-09-28:** (LC6) applyMoveMode saves the inline sizes it overwrites and puts them back on close, on the origin it actually reserved (packages/core/src/dom-modes.ts; 2 new unit tests). Was: **app bug, confirmed 2026-09-27:** `applyMoveMode` (packages/core/src/dom-modes.ts) sets `contentEl.style.width/height` (and the origin's) to the measured px on open and resets them to `''` on close. That wipes any inline size the app had set, so the next open measures a different box. React is unaffected (portal mode; core's move mode is not used).
- LC8: the brief's area map said "second open → onError". In Chrome the browser closes the first window instead (the spec: one PiP window per top-level traversable); the first instance sees `pagehide` and closes cleanly. The test encodes what the browser and the code do.
- LC11: **fixed 2026-09-28:** `open()` used to call `onError` and resolve when `onError` was set (auto-pip.md AP2). It now calls onError AND rejects; the targets log `reject:<name>` only for a rejection onError never saw, so LC11's exact log `[error:NotAllowedError]` also proves onError reported it.
- `onBeforeOpen` is awaited before `requestWindow` (createPip.ts:283-289). MAINTENANCE §1 forbids awaits between the gesture and `requestWindow`; transient activation is time-based (~5 s), so a quick onBeforeOpen passes (LC10). A slow async one (>5 s) would make the open fail with NotAllowedError. Not tested yet.
- LC13's host page is served by the test (`page.route` + `page.goto`), not made with `page.setContent` on a loaded target page: on Next the target was still hydrating, React saw its document replaced, threw a hydration error and re-rendered the whole document, which removed the iframe (found on the first GitHub run, 2026-10-19; it passed on a fast Mac by timing).

## Corrections

<!-- Dated lines from the user's corrections. They override what the code suggests. -->
