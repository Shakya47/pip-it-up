# Flows

One file per area of pip-it-up: its scenarios, grouped under `## <Group>` headings, plus the status of
each from the last run, per browser. Agents write the scenarios from the code, test them and keep them
current. You only review results and correct them. The format is borrowed from nexus's `apps/e2e/flows`.

Short prompts drive everything (the `pip-e2e` skill, Phase 5, will hold the full brief):

| Say | What happens |
| --- | --- |
| `test <area>` | Runs `<area>.md` on its default projects: existing tests, new tests for `todo` rows, then updates the file |
| `test <area> on firefox` / `test firefox` | The same, filtered to one browser |
| `test <area> for vue` | The same, filtered to one target |
| `test smoke` | The playground smoke (`playground.md`, MANUAL_SMOKE A and B) |
| `test all` / `test matrix` | Everything, file by file, every project; resumes where it stopped |
| `write scenarios for <area>` / `map all flows` | Writes or refreshes scenarios from the code, no tests yet |
| `check parity` | Contract results per target, as a table |
| "AP3 is wrong: ..." / "AP3 passed but it's broken" / "AP3 failed but that's fine" | Fixes the row and its test, logs it under `## Corrections`, re-runs |
| `fix bugs from <report>` | Only when asked: fixes app bugs from a `reports/*.md` file |

Corrections are kept permanently, so an agent doesn't repeat a mistake when it refreshes scenarios later.

## Index

| Area | File | IDs | Covers | Spec |
| --- | --- | --- | --- | --- |
| Lifecycle | [lifecycle.md](lifecycle.md) | LC | Open/close paths, callback order, isOpening lock, one window per tab, onBeforeOpen, no-activation, destroy | tests/contract/lifecycle |
| Modes | [modes.md](modes.md) | MO | Core `move` / `clone` / `portal` | tests/contract/modes |
| Styles | [styles.md](styles.md) | ST | Stylesheet copy, `sync` vs `once`, html/body attribute sync | tests/contract/styles |
| Sizing | [sizing.md](sizing.md) | SZ | Requested size (auto, clamps, explicit), fixedSize, reserveSpace, centerInPip, pipBodyStyles | tests/contract/sizing |
| Bridges | [bridges.md](bridges.md) | BR | Keyboard and pointer forwarding, isTrusted filter, marker, opt-outs | tests/contract/bridges |
| Focus and scroll | [focus-scroll.md](focus-scroll.md) | FS | restoreScroll / restoreFocus | tests/contract/focus-scroll |
| Video | [video.md](video.md) | VP | Media in Document PiP (V12), automatic video fallback, enterVideoPip/useVideoPip and video auto-PiP | tests/contract/video |
| Fallbacks | [fallbacks.md](fallbacks.md) | FB | `none`, `new-tab` (validation, noopener, `<base href>`), custom | tests/contract/fallbacks |
| Auto-PiP | [auto-pip.md](auto-pip.md) | AP | Tab-switch PiP, expired activation, `when`, `enabled` | tests/contract/auto-pip |
| Route-persistent | [route-persistent.md](route-persistent.md) | RP | PipProvider/PipAnchor placements, garage, dormancy, dormantMedia, lease, error codes (`@ext-persist`) | tests/react/persist |
| React | [react.md](react.md) | RX | Controlled mode, PipTrigger, isInsidePip, Strict Mode, clone guard, placeholder Restore, usePip | tests/react/react |
| Editing | [editing.md](editing.md) | ED | Caret by click, native undo, typed values across the move (Tiptap demo, all frameworks) | tests/contract/usecases |
| Live state | [live-state.md](live-state.md) | LS | Outside updates reach PiP, canvas bitmap travels, clone is a snapshot | tests/contract/usecases |
| Registry | [registry.md](registry.md) | RG | `getPip(id)`: global shortcut, bridged shortcut, navigation cleanup | tests/contract/usecases |
| Media and editors | [media-editors.md](media-editors.md) | ME | Monaco, Leaflet (and pointers to the Tiptap/canvas/media rows) | tests/playground/media-editors |
| Playground | [playground.md](playground.md) | PG | MANUAL_SMOKE A (playground `/`) and B (`#/dashboard`), one row per behaviour | tests/playground/smoke-a, smoke-b |
| SSR | [ssr.md](ssr.md) | SS | Next.js server rendering and hydration of PipWrapper and PipProvider (V20) | tests/ssr |
| Safari (real) | [safari.md](safari.md) | SF | Real Safari via safaridriver: video PiP, fallbacks, renderUnsupported | scripts/safari.mjs |
| Capabilities | [capabilities.md](capabilities.md) | BC | Per-browser canary against lib/capabilities.ts | tests/capabilities |
| Packaging | [packaging.md](packaging.md) | PK | MANUAL_SMOKE C: packed tarballs | tests/packaging |

## Reading a flow file

- **Targets**: which apps run the row. `all` (every contract target: vanilla, react, later vue, svelte,
  angular), a single target (`vanilla`, `react`, `playground`), `ext-persist` (targets that implement the
  route-persistent extension), or `none` (no browser: packaging).
- **Needs**: what the browser must support, from `lib/capabilities.ts`: `docpip` (Document PiP),
  `videopip` (video PiP), `nopip` (runs only where Document PiP is missing: fallback paths), or `any`.
  A row is skipped, never "passed", where its need isn't met. Tests read the DECLARED capabilities and
  never feature-detect at runtime, which would hide a regression.
- **Notes** say where the code lives, assumptions made, **possible bugs** read from the code (the
  testing agent confirms or rules them out), per-browser expectations, and gaps.
- IDs never change or get reused. New rows take the next free number. Test titles start with the id
  (`PG3 ...`), so results and bug reports map back to rows.

## Status conventions

Status is per browser, because the same row can pass in Chrome and fail in WebKit:

- `pass 2026-09-27 · vanilla-chrome react-chrome`: passed on those projects (`<target>-<browser>`) on that
  date. A row whose Targets is a single target may list just browsers: `pass 2026-09-27 · chrome firefox`.
- `fail vanilla-chrome 2026-09-27: <why>`: an app bug stays a failing test plus this note; don't change
  library code to make it pass. Mixed: `fail webkit 2026-09-27: <why>; pass 2026-09-27 · chrome`.
- Every `fail` row that is an app bug also has an entry in `lib/known-bugs.ts`, so CI runs it as an
  expected failure. When the bug is fixed, CI goes red ("expected to fail, but passed"): delete the entry.
- `skipped: <why>`: a browser (or Playwright) can't check it, e.g. "no real tab switch in Playwright".
- `todo`: no test yet. `new`: a test was just written and hasn't had a clean run on every default project.
- `flaky <projects> <date>: passed on retry`: failed, then passed on a retry (CI). Not a pass: find the cause.
- After a run, `node apps/e2e/scripts/flow-status.mjs [area]` merges `test-results/results.json` into the
  Status cells: projects the run touched get their new outcome, the others keep theirs (so a
  `--project=vanilla-firefox` run can't drop the chrome passes), a skip never replaces an earlier pass/fail,
  and each failure keeps its hand-written reason up to the first `;`. A `todo`/`new`/`retest` cell starts
  over. Review the diff; write the reason by hand the first time a row fails.
- A `pass <date>` only counts if it is dated after the last change to the code the row covers **and** to
  its test. When either changes, reset the row to `todo — retest: <what changed> <date>`, e.g.
  `todo — retest: auto-pip.ts changed 2026-10-02`. The test already exists: run and heal it, don't
  write a second one.
- Duplicate rows: keep the older (canonical) row, move anything the duplicate expected that the
  canonical row lacked into its Expect, then delete the duplicate row and its test. Add a Notes line to
  both files, e.g. "LC14 removed 2026-10-01: duplicate of lifecycle.md LC3". The removed ID is never
  reused.
