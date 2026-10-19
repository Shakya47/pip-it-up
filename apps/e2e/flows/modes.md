# Modes

What: core's DOM modes. `move` (default) moves the content node into the PiP document, `clone` copies it, `portal` leaves the DOM to a binding.
Code: packages/core/src/dom-modes.ts, packages/core/src/createPip.ts (mode dispatch)
Spec: apps/e2e/tests/contract/modes.spec.ts
Last run: 2026-09-27 · matrix (chrome, firefox, webkit; msedge is CI-only)

## Core modes

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| MO1 | `mode=move`, open, close from the OS | The same node goes to PiP and back; the page no longer holds it while open; the origin keeps its height while it's away | vanilla | docpip | pass 2026-09-29 · vanilla-chrome vanilla-firefox |
| MO2 | `mode=clone`, open, click "+1" in the copy, close | The original stays in the page, visible; PiP shows a copy whose "+1" does nothing (listeners aren't cloned); closing removes the copy | vanilla | docpip | pass 2026-09-29 · vanilla-chrome vanilla-firefox |
| MO3 | `mode=portal`, open | The window opens (status open) but core moves nothing: the content stays in the page, PiP is empty | vanilla | docpip | pass 2026-09-29 · vanilla-chrome vanilla-firefox |

## Notes

- Bindings always use `portal` and move the DOM themselves: React's same-node guarantee is lifecycle.md LC1/LC2 (and route-persistent.md), React's clone guard is react.md RX11.
- MO2 documents a trust boundary (CONTRIBUTING threat model): inline handlers in cloned markup DO run in the PiP window. Not tested (the contract uses addEventListener).

## Corrections

<!-- Dated lines from the user's corrections. They override what the code suggests. -->
