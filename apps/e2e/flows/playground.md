# Playground

What: the real-app smoke. MANUAL_SMOKE parts A (playground `/`) and B (route-persistent page `#/dashboard`),
automated one behaviour per row, in a React 19 app under `<StrictMode>` with Tailwind, Tiptap, Monaco and Leaflet.
Code: examples/playground/src (App.tsx, RoutePersistentPage.tsx, demos/*), packages/react/src, packages/core/src
Spec: apps/e2e/tests/playground/smoke-a.spec.ts, apps/e2e/tests/playground/smoke-b.spec.ts
Last run: 2026-09-27 · matrix (chrome, firefox, webkit; msedge is CI-only)

## A. Playground `/`

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| PG1 | Step 1, video demo: play the video, click "↗ Pop out video" | The video enters video PiP (`document.pictureInPictureElement` is it), the button reads "⊠ Exit PiP", `currentTime` keeps rising and `paused` stays false, and the next demo card doesn't move | playground | videopip | pass 2026-09-29 · playground-chrome playground-firefox |
| PG2 | Step 1, Document PiP part (audio demo): play the audio, click "↗ Pop out" | A PiP window opens holding the same `<audio>` node, still playing; the "Audio Player" heading has the same color, weight and font family as in the page (style sync; not font-size, which is responsive); the page shows "Restore content from Picture-in-Picture"; the next card doesn't move (reservation) | playground | docpip | pass 2026-09-29 · playground-chrome playground-firefox |
| PG3 | Step 2: with the audio playing in PiP, close the window the way the OS X does (`pip.close()`) | The same `<audio>` node is back in the page and still playing; "↗ Pop out" is back; the next card doesn't move (`pagehide` repatriation) | playground | docpip | pass 2026-09-29 · playground-chrome playground-firefox |
| PG4 | Step 3, scribble: draw a stroke, pop out, draw another inside PiP, close from the OS | The same `<canvas>` node travels both ways; its bitmap has both strokes in the PiP window and after closing; "Undo" removes only the second stroke | playground | docpip | pass 2026-09-29 · playground-chrome playground-firefox |
| PG5 | Step 4, keyboard demo: click "Open PiP", press Cmd/Ctrl+S inside the PiP window | The page shows "Command intercepted! Last saved at: …" (trusted key in PiP → forwarded to the opener's handler) | playground | docpip | pass 2026-09-29 · playground-chrome playground-firefox |
| PG6 | Step 5, Rich Text Editor: type "alpha omega", pop out, click between "alpha" and " omega" inside PiP, type "-beta" | The text reads "alpha-beta omega": the caret landed where clicked (ProseMirror's `updateRoot()` ran) | playground | docpip | pass 2026-09-29 · playground-chrome playground-firefox |
| PG7 | Step 5: after popping out the typed editor, type inside PiP, then press Cmd/Ctrl+Z until the old text is back (max 6) | The editor returns to "Hello World! 🌎️", the text from before the pop-out: undo history survived, the editor wasn't remounted | playground | docpip | pass 2026-09-29 · playground-chrome playground-firefox |
| PG8 | Step 6, editor: tick "Auto-PiP on tab switch", type, switch tabs (simulated `visibilitychange`) | A PiP window opens with the typed text; its status reads "Popped out automatically (gesture)." | playground | docpip | pass 2026-09-29 · playground-chrome playground-firefox |
| PG9 | Step 6, video: play the video, tick "Auto-PiP on tab switch", switch tabs | The video enters video PiP; the status reads "Entered PiP (gesture)." | playground | videopip | pass 2026-09-29 · playground-chrome playground-firefox |
| PG10 | Step 6, expired activation: play the video, tick the box, touch nothing for 6.5 s, switch tabs | The status reads "Blocked: no click in the last ~5s to authorise it."; no video PiP | playground | videopip | pass 2026-09-29 · playground-chrome playground-firefox |
| PG11 | Step 6, both boxes ticked (editor first), video playing, type in the editor, switch tabs | The editor pops out ("Popped out automatically (gesture).") and the video does not enter PiP and reports a block ("Blocked: …") | playground | docpip, videopip | pass 2026-09-29 · playground-chrome playground-firefox |
| PG12 | Step 7: load `/` and let it settle | No uncaught errors, console errors or pip-it-up warnings (the watchdog enforces this in every PG test) | playground | any | pass 2026-09-29 · playground-chrome playground-firefox playground-webkit |

## B. Route-persistent page `#/dashboard`

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| PG13 | Step 8: pop the tracker out with the header "↗ Pop out", then click "Reports" | The PiP window stays open with the same timer node; it keeps counting; the tracker shows placement "pip" and level "active" | playground | docpip | pass 2026-09-29 · playground-chrome playground-firefox |
| PG14 | Step 9: pop out, go to Reports, back to Dashboard, then close the PiP window from the OS | While it floats, the anchor shows "📺 Tracker is in PiP" and the "Content below the anchors" block hasn't moved; after closing, the same timer node is docked (placement "anchor"), its time isn't reset, and the block below is where it started | playground | docpip | pass 2026-09-29 · playground-chrome playground-firefox |
| PG15 | Step 10: pop out, go to Reports, close the PiP window from the OS, return to Dashboard | The same timer node is docked in its anchor with no button press, time not reset, no placeholder left | playground | docpip | pass 2026-09-29 · playground-chrome playground-firefox |

## Notes

- Code: `useVideoPip` (packages/react/src/useVideoPip.ts), `useAutoPip` (packages/react/src/useAutoPip.ts),
  `createAutoPip` (packages/core/src/auto-pip.ts), `PipWrapper` placeholder and live region
  (packages/react/src/PipWrapper.tsx), `PipProvider`/`PipAnchor` (packages/react/src/PipProvider.tsx, PipAnchor.tsx).
- **Fixed 2026-09-28 (PG10, PG11):** `useVideoPip`'s `enter`/`leave` now reject; `toggle` warns instead (packages/react/src/useVideoPip.ts, 3 new unit tests, README note). Was: **app bug, confirmed 2026-09-27:** `useVideoPip`'s `enter` catches every error and only
  `console.warn`s it (useVideoPip.ts:13-21), so it never rejects. `createAutoPip` treats a resolved
  `enter()` as success and reports `{ ok: true, grantedBy: hadActivation ? 'gesture' : 'browser' }`
  (auto-pip.ts:105-106). Every blocked video auto-PiP is therefore reported as "Entered PiP (browser)."
  Not fixed (report only).
- PG11: the MANUAL_SMOKE text expects exactly "Blocked: NotAllowedError.". Even with the bug fixed that
  may not be what shows: the editor's `requestWindow()` consumes the one activation synchronously, so when
  the video's listener runs, `navigator.userActivation.isActive` is already false and the demo would print
  "Blocked: no click in the last ~5s to authorise it." The test asserts only "Blocked: …"; confirm the
  intended wording with the user.
- PG11: registration order is TICK order, not page order: `useAutoPip` attaches its listener when `enabled`
  turns true. MANUAL_SMOKE says "the editor's card is first in the page, so it registers first".
- MANUAL_SMOKE step 1 is stale: the video demo now uses video PiP (`useVideoPip`), so there is no PiP
  document to be "styled correctly" and no `pagehide`. PG1 tests the video demo as coded; PG2 and PG3 test
  the Document PiP half of steps 1–2 on the audio demo (the playground's other media-in-Document-PiP demo).
- MANUAL_SMOKE step 8 is stale: `#/dashboard` has no "floating in PiP" header pill. The tracker shows its
  level (`active`) and placement (`pip`). "📺 Floating in PiP" exists only in the map demo on `/`.
- MANUAL_SMOKE step 9 reads as if clicking Dashboard re-docks the tracker. In the code the tracker stays in
  PiP while the window is open (`placement = isOpen ? 'pip' : …`, PipProvider.tsx:151) and the anchor shows
  its placeholder; it docks when the window closes. PG14 tests that.
- MANUAL_SMOKE's closing note says the PiP window comes from `context.newPage()`. It comes from the opener's
  `popup` event (lib/pip.ts `openPip`).
- A tab switch is simulated in the page (lib/activation.ts): Playwright can't hide a tab. Every Playwright
  call grants user activation, so PG8, PG9 and PG11 prove "works when activation is present", not "works
  after a real click". PG10 waits 6.5 s with no page calls so activation has really expired.
- Media: the playground's `video-demo.mp4` is H.264/AAC, so PG1–PG3, PG9–PG11 declare `h264`.
- Network: OSM tiles and the CodeSandbox badge are stubbed (lib/network.ts); Monaco still loads from
  cdn.jsdelivr.net on every playground page load.
- Not automated here: MANUAL_SMOKE part C (packaging) → packaging.md (PK), Phase 2.

## Corrections

<!-- Dated lines from the user's corrections. They override what the code suggests. -->
