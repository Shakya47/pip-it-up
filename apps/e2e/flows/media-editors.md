# Media and editors

What: third-party widgets whose internal state the DOM move must not lose: video and audio playheads, canvas bitmaps, Leaflet, Monaco, Tiptap.
Code: examples/playground/src/demos (MonacoDemo, MapDemo, BasicDemo, ScribbleDemo, VideoDemo, AudioDemo), packages/react/src/SwitchingPortal.tsx
Spec: apps/e2e/tests/playground/media-editors.spec.ts; the rest lives in playground.md
Last run: 2026-09-27 · matrix (chrome, firefox, webkit; msedge is CI-only)

## Editors

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| ME1 | Monaco demo: type a line, pop out, type in PiP | The same editor node is in PiP with the typed text in its model; it's laid out (>50 px tall); typing in PiP edits the model | playground | docpip | fail playground-chrome 2026-09-29: see Notes; pass 2026-09-29 · playground-firefox |
| ME2 | Monaco demo: type a line, pop out, press Cmd/Ctrl+Z inside PiP (up to 4×) | Undo goes back past the pop-out to the original text | playground | docpip | fail playground-firefox 2026-09-29: see Notes; pass 2026-09-29 · playground-chrome |
| ME4 | Monaco demo: type a line, pop out, click a control inside PiP that runs `editor.trigger('pip', 'undo', null)` (up to 4×) | Back to the original text: the undo history survived; the documented workaround for ME2 works | playground | docpip | fail playground-chrome 2026-09-29: see Notes; pass 2026-09-29 · playground-firefox |
| ME3 | Leaflet map demo: pan, zoom, drag the marker, pop out, close | Center, zoom and marker position survive both moves | playground | docpip | todo (see Notes) |

## Covered elsewhere

- Tiptap caret after `updateRoot()` and undo past the pop-out: playground.md PG6, PG7.
- Canvas bitmap and undo: playground.md PG4; the bitmap in every framework: live-state.md LS2.
- Caret, undo and typed values on plain editable content in every framework: editing.md ED1–ED3.
- Video and audio playheads (V12): playground.md PG1–PG3, video.md VP1, route-persistent.md RP6/RP7.

## Notes

- **Not a pip-it-up bug (ME2), 2026-09-28: a Monaco limitation.** Monaco's `getActiveDocument()` (monaco-editor esm/vs/base/browser/dom.js) returns `mainWindow.document` while only one window is registered with it, so inside a PiP window its focus context is false and keybindings (undo, …) don't fire; typing works because it's the native textarea. **Docs to fix** (ask first): docs/recipes/monaco.md and the playground MonacoDemo comment claim undo survives. Kept as a known limitation in lib/known-bugs.ts. Was: **possible bug, confirmed behaviour 2026-09-27:** in the opener, Cmd/Ctrl+Z undoes; inside PiP, typing works but ControlOrMeta+Z, Meta+Z and Control+Z all do nothing, with the editor's textarea focused. Likely cause: Monaco's focus tracking reads the opener's `document`, so its `textInputFocus` context is false and the undo keybinding doesn't fire. The playground demo's comment and docs/recipes/monaco.md say undo survives the move.
- Monaco loads from cdn.jsdelivr.net, so ME1/ME2 are `@network`. The demo's editor is controlled (`value`), so typing uses a 25 ms delay; fast typing races its onChange → setState → value round trip.
- ME3: MapDemo keeps its state in a module-level object and re-creates the map, and reading Leaflet's state from a test needs its DOM classes (`.leaflet-*`), which the rules forbid. Options: expose the map on `window` in the demo (a playground change, ask first) or accept reading `.leaflet-marker-icon` positions.

## Corrections

<!-- Dated lines from the user's corrections. They override what the code suggests. -->
