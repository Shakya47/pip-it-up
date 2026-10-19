# E2E test plan

A checklist any agent (Claude Code, Antigravity) can pick items from. Tick an item only when its tests run
green on the projects it names, or fail with an app-bug note in its flow file. Flow rows live in
[`flows/`](flows/README.md); each item below names the file it fills.

Rules that apply to every item: locate by role, label, placeholder or text (no CSS classes); every assertion
unconditional; no `waitForTimeout` except the Node-side quiet wait in activation-expiry tests (a negative that
has no end signal is held with `expectSteady` from `lib/pip.ts`, with a comment why); assert real
outcomes (same DOM node, `currentTime` rising, canvas pixels, bounding boxes); never change library code to
make a test pass. See `lib/activation.ts` for why tab switches and freezes are simulated.

## Phase 1: suite + playground smoke (Chrome) ✅ 2026-09-27

- [x] Scaffold `apps/e2e`: config, fixtures, watchdog, activation, capabilities, network stubs, PiP helpers
- [x] Scripts: `dev-server.mjs` (timestamped logs per target), `bug-report.mjs`, `session.mjs`
- [x] MANUAL_SMOKE A → `tests/playground/smoke-a.spec.ts` (PG1–PG12)
- [x] MANUAL_SMOKE B → `tests/playground/smoke-b.spec.ts` (PG13–PG15)
- [x] `flows/README.md`, `flows/_template.md`, `flows/playground.md`
- [x] Root scripts (`e2e`, `e2e:ui`, `e2e:headed`, `e2e:report`, `e2e:server`, `e2e:bug-report`, `e2e:session`)
      (local runs build the packages first: `playwright.config.ts`, turbo-cached; `E2E_SKIP_BUILD=1` opts out)

## Phase 2: contract + targets (Chrome) ✅ 2026-09-27

- [x] `apps/e2e-contract`: scenario ids, hash routes, accessible names, log entries, query-string → `PipOptions` parser
- [x] `apps/e2e-vanilla` (createPip directly, port 5181) and `apps/e2e-react` (React 19, StrictMode, port 5182)
      rendering the same DOM contract; react adds `#/react-*` pages and `#/persist/*` (`@ext-persist`)
- [x] Flow files from the code: lifecycle, modes, styles, sizing, bridges, focus-scroll, video, fallbacks,
      auto-pip, route-persistent, react, capabilities, packaging, media-editors
- [x] `tests/contract/*.spec.ts` on both targets; `tests/react/*.spec.ts`; `tests/capabilities.spec.ts`;
      `tests/packaging.spec.ts`; `tests/playground/media-editors.spec.ts`
- [ ] `todo` rows: ST5 (Tailwind parity), ST6 (CSP + Trusted Types route), RP14, RP15 (unblocked: RP13 fixed), ME3 (Leaflet).
      PK5 is done (Phase 6)
- [ ] Optional: a React 18 twin target for the peer range

## Phase 3: browser matrix ✅ 2026-09-27

- [x] Projects `<target>-<browser>` for chrome, firefox, webkit; msedge in CI (or `E2E_EDGE=1`); chromium
      (Chrome for Testing) with `E2E_CHROMIUM=1`
- [x] Ran everything per browser, twice (identical), 2026-09-27: 293 passed, 43 failed (the app bugs of that
      date, since fixed: see the table below), 142 skipped (declared). Counts are historical; re-run for current ones
- [x] Fixed test bugs: PG2 (responsive font-size), LC5 (a double click is two tasks), LC3 (Firefox click on a
      closing window); per-browser statuses written by `scripts/flow-status.mjs`
- [ ] msedge: first run in CI (not installed locally)

## Phase 4: CI

- [x] `E2E_TARGETS=<target,...>` (playwright.config.ts) limits both the projects and the dev servers, so a
      vanilla-only job doesn't start the other targets
- [x] `.github/workflows/e2e.yml`: PRs and pushes to `main` run Chrome only (vanilla + react + next + playground +
      packaging); `workflow_dispatch` adds the full Chrome set + tarball, Edge, Firefox, WebKit and real Safari
      (changed 2026-10-19 after the first GitHub run, see "First CI run" below); SHA-pinned, `contents: read`,
      browser cache only for firefox/webkit; bug report + traces uploaded on failure
- [x] `lib/known-bugs.ts`: in CI, listed app bugs run as `test.fail()` (green while the bug exists; red on a new
      failure or when a bug is fixed). Verified locally with E2E_KNOWN_BUGS=1: 332 expected, 0 unexpected
- [x] Changesets `ignore` and `dependabot.yml` entries for the 4 new packages
- [ ] First CI run: confirm Linux matches macOS (headless Chrome sizes, H.264 in Firefox/WebKit), msedge; then
      decide whether to make `e2e (chrome)` a required check

## Phase 5: skill + docs ✅ 2026-09-27

- [x] `pip-e2e` skill, identical at `.agents/skills/pip-e2e/SKILL.md` and `.claude/skills/pip-e2e/SKILL.md`
      (root `.gitignore` now ignores `.claude/*` except `.claude/skills/`)
- [x] `apps/e2e/README.md`

## Phase 6: later

- [ ] One `apps/e2e-<framework>` per new binding (Vue, Svelte, Angular) + a parity table: no bindings exist
      yet (packages/ has core and react); the skill has the checklist
- [x] Real Safari: `scripts/safari.mjs` (zero-dependency WebDriver over safaridriver), flows/safari.md SF1–SF7
- [x] Ran it 2026-09-27 on Safari 26.5.2: SF1–SF4 pass (real video PiP works via the automatic fallback), SF5 fails (RX8 confirmed); stable over 3 runs
- [x] Next.js SSR target `apps/e2e-next` (:5183): contract client-only at `/` (parity with react), SSR pages
      for SS1–SS5 (flows/ssr.md)
- [x] Packed-tarball consumer smoke (PK5): `tests/tarball.spec.ts`, project `tarball` with `E2E_TARBALL=1`
- [x] CI: next-chrome in the chrome job; `--project=tarball` with `E2E_TARBALL=1` in manual runs; an
      `e2e (safari)` job on macos-latest for manual runs (one retry per row; the runner's `KNOWN_BUGS` is empty
      since SF5/RX8 was fixed 2026-09-28);
      changesets ignore + dependabot entry for `@pip-it-up/e2e-next`
- [x] First CI run (Linux), 2026-10-19: Chrome had one real failure, LC13 on Next (the test rewrote a page
      that was still hydrating; fixed). Firefox: every test that opens a Document PiP window failed (BC3 is the
      canary). WebKit: only VP7 failed. Linux Firefox and WebKit were NOT investigated: they run on demand
      only. To put them in CI, reproduce under Linux first (Docker image `mcr.microsoft.com/playwright`),
      then make `lib/capabilities.ts` per-platform.
- [ ] First manual full run (Actions → E2E → Run workflow): Safari job and tarball on GitHub's runners

## Open app bugs found by the suite

Found by the suite; the Kind column says which are fixed (library fixes were made on request, never to make a
test pass). Details and evidence in each flow file's Notes.

| Found | Rows | Bug | Kind |
| --- | --- | --- | --- |
| 2026-09-27 | PG10, PG11 | `useVideoPip.enter` swallows errors, so `useAutoPip` reports blocked video PiP as "Entered PiP (browser)." | **fixed 2026-09-28** |
| 2026-09-27 | AP2 | `open()` resolves (calls onError) instead of rejecting when `onError` is set, so `createAutoPip` reports a blocked attempt as ok | **fixed 2026-09-28** |
| 2026-09-27 | LC6 | Move mode resets the content's (and origin's) inline width/height to `''` on close, wiping the app's own size | **fixed 2026-09-28** |
| 2026-09-27 | FS1, FS2 | Vanilla move mode restores scroll/focus BEFORE moving content back (LIFO disposers), so neither is restored | **fixed 2026-09-28** |
| 2026-09-27 | SZ5 | fixedSize snap-back uses `resizeTo()`: blocked without activation in Chrome, and it sets the outer size | **fixed 2026-09-28** |
| 2026-09-27 | SZ1–SZ3 | PipWrapper auto-size measures its full-width wrapper div, not the content | **fixed 2026-09-28** |
| 2026-09-27 | SZ7 | PipWrapper still reserves space (placeholder) with `reserveSpace={false}` | **fixed 2026-09-28** |
| 2026-09-27 | RP9 | PipProvider listens for `freeze`/`resume` on window; Chromium fires them on document without bubbling | **fixed 2026-09-28** |
| 2026-09-27 | RP10 | Route change detaches the shuttle with its anchor before parking it: iframes reload even with moveBefore | **fixed 2026-09-28** |
| 2026-09-27 | RP2 | Anchor reservation 5 px short | not a bug: the header glyph moved the anchor; test fixed 2026-09-28 |
| 2026-09-27 | RP12 | The lease keeps the instance but not the React subtree across commits | decided 2026-09-28: intended; document it in the React README (test now expects a fresh widget) |
| 2026-09-27 | RP13 | `isDevEnv()` needs `process`, which browsers don't have: dev diagnostics never run | **fixed 2026-09-28** |
| 2026-09-27 | RX11 | PipWrapper `mode="clone"` falls back silently; MAINTENANCE §3 promises a warning | **fixed 2026-09-28** |
| 2026-09-27 | ME2 | Monaco undo does nothing inside PiP | Monaco limitation (focus read from its main window); docs to fix |
| 2026-09-27 | SS5 | Server-rendered PipProvider: anchors never dock (the claim made during hydration is dropped) | **fixed 2026-09-28** |
| 2026-09-28 | SF4 | Video fallback called `onOpen` twice in Safari (late `enterpictureinpicture`) | **fixed 2026-09-28** |
| 2026-09-27 | RX8, SF5 | WebKit and real Safari: `renderUnsupported` never shows (video PiP API counts as "supported"); the trigger renders and does nothing | **fixed 2026-09-28** |
| 2026-09-28 | RX13 | `usePip()` under Strict Mode: the simulated unmount destroyed its instance, so the first `open()` failed with `ERR_DESTROYED` | **fixed 2026-09-28** |
| 2026-09-28 | RX13, RX14 | `usePip()` moves the node (no portal), so React `onClick` inside it doesn't fire while in PiP | **fixed 2026-09-28** (event bridge) |

## Playground use-case coverage (2026-09-28)

Every demo in `examples/playground` maps to rows that run in both packages (vanilla = core, react) unless
the feature is React-only:

| Playground demo | Rows |
| --- | --- |
| Tiptap editor | ED1–ED3 (all), PG6–PG7 (playground) |
| Monaco | ME1, ME2 (known limitation), ME4 |
| Leaflet map | ME3 todo (third-party widget; playground only) |
| Tailwind / styles | ST rows |
| Scribble canvas | LS2 (all), LS3 clone snapshot (core), PG4 |
| Portal / BuildProgress shared state | LS1 |
| Keyboard (Cmd+S) | BR1–BR3, BR7 |
| Decoupled trigger, global shortcut, navigation cleanup | RG1–RG3, RX5 |
| Fixed size | SZ5 |
| Video / Audio | VP1–VP12, PG rows |
| Iframe guard | LC13 |
| Route-persistent | RP1–RP18 (React-only) |
| Controlled, triggers, usePip, placeholder | RX1–RX14 (React-only) |
