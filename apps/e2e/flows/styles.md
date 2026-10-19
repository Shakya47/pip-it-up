# Styles

What: copying the opener's stylesheets and html/body attributes into the PiP document, once or kept in sync.
Code: packages/core/src/styles.ts (copyStylesOnce, startStylesSync), CONTRACT_CSS in apps/e2e-contract/src/index.ts
Spec: apps/e2e/tests/contract/styles.spec.ts
Last run: 2026-09-27 · matrix (chrome, firefox, webkit; msedge is CI-only)

## Copy and sync

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| ST1 | Open the `styles` scenario | "Contract content" has the same color in PiP as in the page (rgb(0, 102, 51)) | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| ST2 | Open, then "Toggle theme" (class `theme-dark` + `data-theme` on `<html>`) | PiP `<html>` gets the class and attribute; the heading turns rgb(200, 30, 30) | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| ST3 | Open, then "Add style" (a new `<style>` in the page head) | The PiP heading becomes underlined | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| ST4 | `copyStyles=once`: open, then toggle theme and add a style | The PiP window keeps the colors and attributes it opened with: green, no underline, no `theme-dark` | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| ST5 | Playground Tailwind demo: open | Computed styles of the demo's elements match the page (Tailwind parity) | playground | docpip | todo |
| ST6 | A strict CSP + Trusted Types page (docs/csp-and-trusted-types.md): open, sync a style, close | Zero `securitypolicyviolation` events in either document | all | docpip | todo (needs a CSP route in the targets) |

## Notes

- Sync is batched per animation frame (styles.ts `scheduleTextUpdate`); ST2/ST3 poll, ST4 waits two frames in the PiP window before asserting nothing changed.
- `syncAttrs` copies `className`, `style.cssText` and `data-*` attributes of `<html>`/`<body>` at open; afterwards the MutationObserver mirrors every attribute change (ST2).
- Playground PG2 already compares one Tailwind-styled heading's typography in PiP.

## Corrections

<!-- Dated lines from the user's corrections. They override what the code suggests. -->
