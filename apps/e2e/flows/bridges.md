# Bridges

What: keyboard and pointer events inside the PiP window re-dispatched on the opener, trusted events only, pointer clones marked `pipItUpBridged`.
Code: packages/core/src/keyboard-bridge.ts, packages/core/src/pointer-bridge.ts
Spec: apps/e2e/tests/contract/bridges.spec.ts
Last run: 2026-09-27 · matrix (chrome, firefox, webkit; msedge is CI-only)

## Keyboard

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| BR1 | Open, press Q in the "Notes" box inside PiP | The opener's window receives a forwarded (untrusted) `keydown` and `keyup` for "q" | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| BR2 | Open, dispatch a synthetic `KeyboardEvent` on the PiP window and body | Nothing is forwarded (isTrusted filter, SEC-202) | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| BR3 | `forwardKeyboardEvents=false`: type in PiP | The key lands in the input; nothing reaches the opener | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |

## Pointer

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| BR4 | Open, click the heading inside PiP | The opener gets `pointerdown`, `pointerup`, `click`, each with `pipItUpBridged` | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| BR5 | Open, dispatch a synthetic PointerEvent and click in PiP | Nothing is forwarded (SEC-203) | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| BR6 | `forwardPointerEvents=false`: click "+1" in PiP | The click works in PiP (Count: 1); nothing reaches the opener | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| BR7 | The opener `preventDefault()`s a forwarded Ctrl/Cmd+K (like the playground's Cmd+S save handler); Ctrl/Cmd+J is left alone | The original K keydown in PiP is cancelled (`defaultPrevented`); J is not | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |

## Notes

- The targets log only what arrives at the opener: `key:<type>:<key>` for UNTRUSTED key events on `window` (forwarded clones are untrusted by construction; the opener's own real keys are trusted and not logged), `pointer:<type>` for events carrying the marker.
- BR2/BR5/BR3/BR6 settle with a `setTimeout(0)` round trip in both windows before asserting that nothing arrived.
- BR7 covers the `canceled` path in keyboard-bridge.ts (the playground's Cmd+S handler). The targets `preventDefault()` a forwarded Ctrl/Cmd+K; a real Cmd+S would open the browser's save dialog if the bridge regressed.
- Not tested: pointer coordinates staying PiP-relative (documented, not a promise to test).
- The Alt+P global shortcut pressed inside PiP (a bridged key driving the page) is registry.md RG2.

## Corrections

<!-- Dated lines from the user's corrections. They override what the code suggests. -->
