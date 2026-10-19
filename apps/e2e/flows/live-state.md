# Live state

What: content in PiP stays part of the page's live tree. Updates made outside it still reach it (the playground's shared-state demos: Portal, BuildProgress), and a `<canvas>` bitmap travels with the node (Scribble). `mode: 'clone'` is the documented opposite: a snapshot.
Code: packages/core/src/dom-modes.ts (move / clone)
Spec: apps/e2e/tests/contract/usecases.spec.ts
Last run: never

## Shared tree

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| LS1 | Click "+1 outside" (a control outside the content), open, click it twice more, close from the OS | PiP shows "External count: 1", then 3; the page keeps 3 | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| LS2 | `canvas`: draw a stroke, open, check the bitmap, draw a second stroke inside PiP, close from the OS | The same `<canvas>` node moves both ways; the first stroke is there in PiP; both strokes are there after closing | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| LS3 | `canvas` with `mode: 'clone'`: draw, open, click "+1 outside" | The page shows "External count: 1" while the copy stays at 0; the copied canvas is blank (clone doesn't copy bitmaps) | vanilla | docpip | pass 2026-09-29 · vanilla-chrome vanilla-firefox |

## Notes

- LS3 is core-only: `<PipWrapper>` has no clone mode (react.md RX11).
- The playground's Scribble undo is playground.md PG4.

## Corrections

<!-- Dated lines from the user's corrections. They override what the code suggests. -->
