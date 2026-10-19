# Focus and scroll

What: restoreScroll / restoreFocus (default on): scroll offsets inside the content, and the opener's focused input with its selection, restored on close.
Code: packages/core/src/focus-scroll.ts, packages/core/src/createPip.ts:297-304 and :410-412 (disposer order)
Spec: apps/e2e/tests/contract/focus-scroll.spec.ts
Last run: 2026-09-27 · matrix (chrome, firefox, webkit; msedge is CI-only)

## Restore on close

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| FS1 | Scroll "Scroll box" to 300 px, open, close from the OS | The box is back at scrollTop 300 | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| FS2 | Focus "Notes" with "abcdef", select 2–4, open (keyboard-free), close | "Notes" is focused in the page again with selection 2–4 | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| FS3 | `restoreScroll=false`, same as FS1 | Not restored (not 300) | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| FS4 | `restoreFocus=false`, same as FS2 | "Notes" is not focused | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |

## Notes

- **Fixed 2026-09-28:** (FS1, FS2) the restore disposer is registered before the move-mode disposer, so it runs after the content is back (packages/core/src/createPip.ts). Was: **app bug, confirmed 2026-09-27:** close() runs the disposers LIFO. `restoreFocusScroll` is pushed after `applyMoveMode`'s disposer, so it runs FIRST: it restores scroll offsets on nodes still inside the PiP document and skips the focus (the input isn't in the opener yet), then the move-mode disposer moves the content back, which resets the offsets. React is unaffected: its teardown hook moves the content back at the top of close(), before cleanup().
- FS3/FS4 are weak on their own (a cross-document move resets scroll and drops focus anyway); they guard against a regression that restores when told not to.
- Opening in FS1/FS2 uses a scripted click on "Open PiP" so focus stays in "Notes" at the moment core takes its snapshot.

## Corrections

<!-- Dated lines from the user's corrections. They override what the code suggests. -->
