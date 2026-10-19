# Sizing

What: the window size core requests (auto-size from the content box, clamped; explicit width/height), fixedSize, reserveSpace, centerInPip, pipBodyStyles.
Code: packages/core/src/createPip.ts:306-318 (size), :379-396 (body styles), packages/core/src/fixed-size.ts, packages/core/src/dom-modes.ts (reserveSpace in move mode), packages/react/src/PipWrapper.tsx (placeholder + origin reservation)
Spec: apps/e2e/tests/contract/sizing.spec.ts
Last run: 2026-09-27 · matrix (chrome, firefox, webkit; msedge is CI-only)

## Requested size

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| SZ1 | Content box 380×280, no width/height, open | requestWindow is asked for 380×280; the window's inner size is within 24 px of it | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| SZ2 | Content box 120×80, open | Requested 300×200 (the minimum clamp) | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| SZ3 | Content box 2400×1800, open | Requested 1600×1200 (the maximum clamp) | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| SZ4 | `width=420&height=320`, open | Requested 420×320; granted within 24 px | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| SZ10 | `disallowReturnToOpener=true`, open | Passed through in the requestWindow options | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |

## Fixed size

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| SZ5 | `fixedSize` 420×320: open, resize the window to 640×520 | `<html>` and `<body>` are locked to 420px × 320px, overflow hidden; the lock holds after the window really got bigger (checked first; skipped where resizeTo() is a no-op). The window is NOT resized back (Corrections 2026-09-28) | all | docpip | pass 2026-09-29 · next-firefox react-firefox vanilla-firefox |

## Layout around the window

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| SZ6 | reserveSpace (default): open, then close from the OS | "Content below" doesn't move on open, and is back at the same place after close | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| SZ7 | `reserveSpace=false`, open | The page collapses: "Content below" moves up by more than 50 px | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| SZ8 | `centerInPip=true`, open | The PiP body is `display: flex`, centered both ways | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| SZ9 | Default body styles, open | PiP body margin 0 | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| SZ11 | `pipBodyStyles=false`, open | PiP body keeps the browser default margin (8px) | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |

## Notes

- What the library ASKS for is asserted exactly (lib/pip.ts `recordPipRequests` wraps `requestWindow`); what the window manager grants is checked within 24 px. Chrome trims a few px, and headless Chrome caps PiP windows to its small virtual screen (a 480-wide request was granted 80 px less), so granted-size checks stay small.
- **Fixed 2026-09-28:** (SZ1–SZ3) PipWrapper registers the wrapped content's own element as `contentEl` when it is a single element (`measurableContent`, packages/react/src/PipWrapper.tsx; 2 new unit tests). Was: **bug, decided 2026-09-28 (see Corrections):** `<PipWrapper>` registers its own wrapper `<div>` (`contentRef`) as `contentEl`. That div is a block box, so it is as wide as the page column (740 px here) whatever the content inside measures; auto-size therefore never follows the content's width. `<PipProvider>` measures the hosted subtree's first element instead (`resolveContentEl`), so the two React paths disagree. Fix: measure the wrapped content's own element, as PipProvider does (no layout change); changelog note.
- **Fixed 2026-09-28 (SZ5), as decided:** the resize snap-back is gone; `fixedSize` locks html/body only, and SZ5 now checks the lock holds through a window resize (packages/core/src/fixed-size.ts, core README). Was: **app bug, confirmed 2026-09-27:** fixed-size.ts snaps back with `pipWindow.resizeTo(width, height)`. Headed Chrome 153: a PiP window opened at 420×320 inner, resized to 640×520, stays at 640×486 — Chrome only allows `resizeTo()` in a PiP window with user activation, and a resize isn't one. Headless (where the call went through) it snapped to 384×278: `resizeTo` sets the OUTER size, so even a successful snap-back shrinks the window by its title bar. The CSS lock (html/body px, overflow hidden) works. Firefox: nondeterministic — across four matrix runs the snap-back worked in some and not others, on both targets (react and vanilla swapped between runs; earlier "React-only" note corrected 2026-09-27). Listed as a flaky known bug: CI skips SZ5 on Firefox.
- **Fixed 2026-09-28:** (SZ7) with `reserveSpace={false}` the placeholder no longer takes the reserved height. Was: **possible bug, 2026-09-27:** with `reserveSpace={false}` the PipWrapper placeholder is still rendered at the last measured height (PipWrapper.tsx `placeholderNode`), so nothing collapses. Vanilla honours the option.
- 2026-09-29 (SZ5): the test first checks `resizeTo(640, 520)` really widened the window (it polls `innerWidth` for 3 s); where the window manager ignores the call it SKIPS with that reason instead of passing on an unchanged window. The flaky Firefox known-bug entry is gone (the snap-back it was about was removed 2026-09-28).
- The React origin element gets `display: inline-block` + fixed px while open (PipWrapper.tsx reservation effect); vanilla's origin gets min/fixed px from dom-modes.ts.

## Corrections

<!-- Dated lines from the user's corrections. They override what the code suggests. -->
- 2026-09-28 (SZ5): `fixedSize` keeps the CSS size lock and does NOT resize the window back (browsers block `resizeTo()` without a gesture). Document that the window itself can still be resized.
- 2026-09-28 (SZ1–SZ3): `<PipWrapper>` auto-size must follow the wrapped content's own element (like `<PipProvider>` and vanilla `createPip`), not PipWrapper's full-width wrapper div. The current behaviour is a bug.
