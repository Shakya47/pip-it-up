# React

What: @pip-it-up/react specifics: controlled mode, `<PipTrigger>` (labels, hideInPip, pipId, asChild, orphan ids, renderUnsupported), isInsidePip, Strict Mode survival, the clone-mode guard.
Code: packages/react/src/PipWrapper.tsx, PipTrigger.tsx, Slot.tsx, useIsPipSupported.ts, PipContext.tsx
Spec: apps/e2e/tests/react/react.spec.ts (react target: `#/react-controlled`, `#/react-trigger`, `#/react-clone-mode`, and the contract routes)
Last run: 2026-09-27 · matrix (chrome, firefox, webkit; msedge is CI-only)

## Controlled mode

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| RX1 | Tick "Open (controlled)" (`open={true}`) | The window opens with "Controlled content"; onOpenChange(true) | react | docpip | pass 2026-09-29 · react-chrome react-firefox |
| RX2 | Then close the window from the OS | onOpenChange(false); the checkbox unticks (parent state follows) | react | docpip | pass 2026-09-29 · react-chrome react-firefox |
| RX3 | Untick it (`open={false}`) | The window closes; content back in the page | react | docpip | pass 2026-09-29 · react-chrome react-firefox |

## PipTrigger

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| RX4 | Click the colocated default trigger "↗ Pop out" | Its wrapper opens; inside PiP the trigger is hidden (hideInPip default) | react | docpip | pass 2026-09-29 · react-chrome react-firefox |
| RX5 | Decoupled `pipId` trigger with openLabel/closeLabel | "Open remotely" opens the wrapper; it becomes "Close remotely" with aria-pressed true; clicking closes it | react | docpip | pass 2026-09-29 · react-chrome react-firefox |
| RX6 | `asChild` link trigger | Clicking the link opens the wrapper; the link gets aria-pressed true | react | docpip | pass 2026-09-29 · react-chrome react-firefox |
| RX7 | A trigger whose pipId nobody registered | Rendered disabled | react | any | pass 2026-09-29 · react-chrome react-firefox react-webkit |
| RX8 | No Document PiP: a trigger with `renderUnsupported` | The unsupported UI shows, not a button that does nothing | react | nopip | pass 2026-09-29 · react-webkit |

## Context and Strict Mode

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| RX9 | Contract page: read "Inside PiP" before and after opening | "no" in the page, "yes" inside PiP | react | docpip | pass 2026-09-29 · react-chrome react-firefox |
| RX10 | Under StrictMode: open, close, open again | Both opens reach requestWindow; no `ERR_DESTROYED` or other pip-it-up warning (MAINTENANCE §2) | react | docpip | pass 2026-09-29 · react-chrome react-firefox |
| RX11 | `<PipWrapper mode="clone">` (JS caller), open | A console warning, and portal mode: the same node moves (MAINTENANCE §3) | react | docpip | pass 2026-09-29 · react-chrome react-firefox |
| RX12 | `#/react-trigger`: pop out, then click the default placeholder's "Restore" button in the page | The window closes; the content node is back in the page | react | docpip | pass 2026-09-29 · react-chrome react-firefox |
| RX13 | `#/react-usepip`: Count to 1, "Open with usePip", "+1 from page", "Close with usePip" | The same node moves into PiP and back; "usePip: open/closed"; the page-driven render reaches it in PiP (Count: 2) and survives the return; no `ERR_DESTROYED` under StrictMode | react | docpip | pass 2026-09-29 · react-chrome react-firefox |
| RX14 | `#/react-usepip`: open, then inside PiP click Count, type "abc" in the controlled input, click the link whose onClick calls `preventDefault()`, fire `animationend` on the heading | Count: 1; the input shows "ABC" (controlled onChange); the handler logs once and the PiP location doesn't change; an `animationend` reaches onAnimationEnd | react | docpip | pass 2026-09-29 · react-chrome react-firefox |

## Notes

- The react target runs in `<StrictMode>` (React 19.2), so every contract row on it is also a Strict Mode test. A React 18 twin for the peer range (`react >= 18`) is optional; not built yet.
- **Fixed 2026-09-28:** (RX11) PipWrapper warns `[PipWrapper] mode="clone" is not supported and is ignored` (1 new unit test). Was: **doc drift, confirmed 2026-09-27:** MAINTENANCE §3 says `mode="clone"` on PipWrapper "will emit a console.warn and fall back to portal mode". The fallback happens (`createPip({ ...coreOptions, mode: 'portal' })`) but nothing warns; `mode` isn't in PipWrapperProps, so only JS callers can hit it.
- **Fixed 2026-09-28 (RX8):** core's per-instance `state.isSupported` now means "open() will do something" (Document PiP, the single-video fallback, or a fallback other than 'none'), and PipTrigger uses it instead of the browser-wide `useIsPipSupported()`; confirmed in WebKit and real Safari (safari.md SF5). Was: **possible bug:** `useIsPipSupported()` is true when EITHER Document PiP or video PiP exists. Every desktop browser has video PiP (Safari, Firefox, and Playwright's WebKit exposes it too), so `renderUnsupported` never shows there, and a PipTrigger for non-video content stays a button whose click does nothing (fallback none) or opens a new tab. Confirmed on webkit 2026-09-27.
- **Fixed 2026-09-28:** `usePip`'s cleanup now calls `unregisterPip(options.id!, instance)` (the compare-and-delete MAINTENANCE §10 requires).
- RX13 found a bug (fixed 2026-09-28): under StrictMode `usePip()` destroyed its own instance in the simulated unmount, so the first `open()` failed with `ERR_DESTROYED`. Fixed with the deferred teardown (MAINTENANCE §2), with unit tests in packages/react/tests/usePip.test.tsx.
- **Fixed 2026-09-28 (RX14):** `usePip()` MOVES the node (core move mode) rather than portalling it, and React's delegated listeners live on its root in the main document, so `onClick` etc. inside the content never fired in PiP. `usePip()` now bridges delegated events from the PiP document to the owning React container (packages/react/src/reactEventBridge.ts, unit tests in tests/reactEventBridge.test.tsx).

## Corrections

<!-- Dated lines from the user's corrections. They override what the code suggests. -->
- 2026-09-28 (RX8): show the trigger only when something can open (Document PiP, a single-video fallback, or a configured fallback); otherwise show `renderUnsupported`.
