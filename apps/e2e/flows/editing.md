# Editing

What: editable content moved into Document PiP keeps working like it did in the page: caret placement by click, native undo, and values typed before the move. The playground's Tiptap editor demo, on plain `contenteditable` and `<input>` in every contract target.
Code: packages/core/src/dom-modes.ts (the move), packages/core/src/keyboard-bridge.ts (keys still reach the PiP document first)
Spec: apps/e2e/tests/contract/usecases.spec.ts
Last run: never

## Editable content

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| ED1 | Open, click just after "alpha" in the "Rich text" box inside PiP, type "-beta" | The caret lands where clicked: "alpha-beta omega" | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| ED2 | Open, type "!" at the end of "Rich text", press Ctrl/Cmd+Z | Native undo removes it: "alpha omega" | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| ED3 | Type "before" in "Notes", open, type " after" in PiP, close from the OS | PiP shows "before", then "before after"; the page keeps "before after" | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |

## Notes

- Tiptap itself (the playground's `updateRoot()` call and undo history across the pop-out) is playground.md PG6, PG7. These rows check the browser behaviour Tiptap depends on, in every framework.
- ED1 clicks at an offset inside the element, not at window coordinates: the PiP window can scroll sideways (seen in vanilla-firefox), which moved "alpha" off-screen.
- "Rich text" was first called "Rich notes", which clashed with "Notes" in Playwright's substring name match.

## Corrections

<!-- Dated lines from the user's corrections. They override what the code suggests. -->
