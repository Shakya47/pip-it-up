---
name: pip-e2e
description: Test pip-it-up (@pip-it-up/core, @pip-it-up/react and future bindings) end to end in real browsers with real Picture-in-Picture windows. Use for short requests like "test lifecycle", "test sizing on firefox", "test auto-pip for vue", "test smoke", "test all", "test matrix", "write scenarios for bridges", "map all flows", "check parity", corrections like "AP3 passed but it's broken", "fix bugs from <report>", and whenever verifying a change, reproducing a bug, adding a binding target, or writing Playwright specs under apps/e2e.
---

# pip-it-up E2E testing

The user gives short requests. This file is the full brief, so don't ask for a longer prompt. Run every
command from the repo root. Reply short: lead with the answer, then a table. No walls of text.

**Read `specs/MAINTENANCE_GUIDE.md` §1–13 before you fix anything** (it's local-only, gitignored; if it's
missing, say so), plus the security checklist in `CONTRIBUTING.md`. They are the architecture contract: no
`await` between the gesture and `requestWindow()` (§1), deferred Strict Mode teardown (§2), one immortal
shuttle moved natively (§9), tri-state compare-and-clear handles (§10), the attached inert garage (§11),
anti-CLS reservation (§12), synchronous repatriation with no `flushSync` (§13), `isTrusted` filters on
forwarded events, `appendChild` never `adoptNode`. A fix that works but breaks a rule is not a fix.

## Requests and what to do

The user never writes scenarios by hand. You write them from the code, and the user corrects them.

| Request | Do |
| --- | --- |
| `test <area>` (e.g. "test lifecycle") | The **area loop** below on the area's default projects |
| `test <area> on <browser>` / `test <browser>` | The area loop (or every area) on `--project='*-<browser>'` only |
| `test <area> for <target>` (e.g. "for vue") | The area loop on `--project='<target>-*'` only |
| `test smoke` | The playground smoke: `pnpm e2e --project=playground-chrome tests/playground/smoke` (flows/playground.md) |
| `test all` / `test matrix` | Every flow file, one at a time, on every project (`pnpm e2e`). Report after each file; next time resume from the first unfinished file |
| `write scenarios for <area>` | Create or refresh `apps/e2e/flows/<area>.md` from the code ("Creating a flow file"). No tests. Reply with the rows for review |
| `map all flows` | The same for every area. One line per area in the reply |
| `check parity` | Run `tests/contract` on every target (`--project='vanilla-*' --project='react-*' ...`), reply with a table: contract row × target, pass/fail/skip, and every row where targets disagree |
| A correction ("AP3 is wrong: …", "AP3 passed but it's broken", "AP3 failed but that's fine") | See "Corrections", then re-run that row |
| `add these to <area>` + a list | Append each as a `todo` row, then run the area loop |
| `fix bugs from <report>` | **Only when asked.** See "Fixing from a bug report" |
| `add a <framework> target` | See "Adding a binding target" |

### Default projects per area

Projects are `<target>-<browser>`: targets `vanilla`, `react`, `next`, `playground` (plus new bindings);
browsers `chrome`, `firefox`, `webkit` locally (`msedge` in CI or with `E2E_EDGE=1`; `chromium` with
`E2E_CHROMIUM=1`). Browser differences live in core, so:

| Area kind | Default projects |
| --- | --- |
| Contract areas (tests/contract: lifecycle, modes, styles, sizing, bridges, focus-scroll, video, fallbacks, auto-pip; editing ED, live-state LS, registry RG all in `usecases.spec.ts`) | `--project='vanilla-*' --project=react-chrome --project=next-chrome` (+ each other binding in chrome) |
| React areas (tests/react: react, route-persistent) | `--project='react-*'` |
| Playground (smoke, media-editors) | `--project=playground-chrome` |
| SSR | `--project='next-*'` (tests/ssr) |
| Capabilities | `--project='vanilla-*'` |
| Safari (real) | `node apps/e2e/scripts/safari.mjs`: rows SF1–SF7 (flows/safari.md; SF6/SF7 are video-api on vanilla and react). Not Playwright; needs `sudo safaridriver --enable` once |
| Packaging PK5 (tarball consumer) | `E2E_TARBALL=1 pnpm e2e --project=tarball` (npm-installs ~40 MB into a temp dir; ask first) |
| Packaging | `--project=packaging` |

The flow index (`apps/e2e/flows/README.md`) maps each area to its file, id prefix and spec.

### The area loop

0. **Packages built?** Targets import `@pip-it-up/*` from `dist/`. The root `pnpm e2e`, `e2e:ui`,
   `e2e:headed` and `e2e:server` build them first (turbo build of `./packages/*`, cached: once in the
   Playwright runner via `playwright.config.ts`, or in `scripts/dev-server.mjs`); `E2E_SKIP_BUILD=1`
   skips that (e.g. while `pnpm --filter "./packages/*" dev` runs). Run `pnpm e2e:build` by hand only
   when something bypasses both. Servers: `pnpm e2e:server` in the background (all targets,
   timestamped logs in `apps/e2e/logs/<target>.log`), or let Playwright start them (only the targets in
   `E2E_TARGETS`, default all). If a port (5173 playground, 5181 vanilla, 5182 react, 5183 next) is
   taken by something you didn't start, say so: tests would reuse it and no server logs would be captured.
1. **Find the flow file** (match the area loosely; see the index). No file → write its scenarios first.
2. **Catch up with the code.** `git log --since="<Last run>" --oneline -- <the file's Code paths>` and
   uncommitted changes there. Add a `todo` row for any new behaviour; reset changed rows to
   `todo — retest: <what changed> <date>`.
3. **Run what exists:** `pnpm e2e <spec path> <default projects>`, then `pnpm e2e:bug-report <area>` at
   once (the next run wipes `test-results/`).
4. **Cover the `todo` rows.** Explore live first when unsure (`pnpm e2e:session <target> /#/<route>`,
   add `--browser=firefox`), then write the test in the area's spec. Titles start with the row id:
   `test('LC3 "Close from inside" closes it the same way @docpip', …)`. Work one `## <Group>` at a
   time and save the flow file after each.
5. **Fix red tests.** Test bug (locator, timing, a browser's legitimate behaviour): fix the test. App
   bug: leave it failing, mark the row `fail <projects> <date>: <one line>`, add the evidence to Notes,
   and add an entry to `apps/e2e/lib/known-bugs.ts` (so CI runs it as an expected failure;
   `flaky: true` when it fails only sometimes, which makes CI skip it there). Never
   weaken an assertion, add a sleep that hides the race, or fake an interaction to get green.
6. **Update the flow file:** `node apps/e2e/scripts/flow-status.mjs <area>` rewrites Status cells from
   the run (it keeps each failure's reason up to the first `;`; write it by hand the first time), then
   `Last run`, new rows, and Notes. Before adding a row, search the other flow files for the same
   behaviour; reference it instead of duplicating.
7. **Bug report:** after the final full run, `pnpm e2e:bug-report <area> --replace`, then fill each
   failure's Classification, Suspected cause, Suggested fix, Invariants, Parallel paths, Docs to update.
8. **Reply honestly** (below): the report path and a table `id | project | pass/fail/skip | one line | trace (fails)`.

Vague rows are normal. Pick the most reasonable reading, test it, state the assumption.

### Reporting results

- Take every number from the report header, not from memory. List **every** failed, flaky and skipped
  test, and every row still `fail`, before any passes. Never write "all passed" for an area with a fail.
- A report is built from a **full run of the area's spec** on its default projects after your last edit.
  A `-g` run is for debugging. A test that failed and then passed with no change is **flaky**: say so.
- List every test you changed and why ("Tests changed during this run"). A loosened match, a new
  `watchdog.allow`, a skip: the user must see it.
- A `pass` means the test asserts **every part** of the row's Expect. Otherwise leave it
  `todo — partial: <what is unasserted>`.
- Per-browser results matter: a row can pass in Chrome and fail in WebKit. Say which projects.

### Bug reports

`pnpm e2e:bug-report <area>` turns `apps/e2e/test-results/results.json` into
`apps/e2e/reports/<area>-<date-time>.md` (failures grouped by project) plus evidence per failure: trace,
screenshots, video, page snapshot, the watchdog report, the target's dev-server log for the test's
window, and trace dumps (errors, failed requests, console, actions). Replace every placeholder; for
**Invariants**, name the MAINTENANCE_GUIDE sections and CONTRIBUTING checklist rows the fix touches.
Browser differences are not bugs by themselves: check `lib/capabilities.ts` first. Reports are
gitignored; never commit them.

### Fixing from a bug report

Only when the user asks. Read `specs/MAINTENANCE_GUIDE.md` in full and CONTRIBUTING's checklist. Then per
"app bug": check the cause against the code and the fix against the guide (the report's fix is a hint);
fix every parallel path (core vs React; vanilla move mode vs React's shuttle; each browser); add or update
unit tests (`pnpm test`); `pnpm typecheck && pnpm lint && pnpm test && pnpm build`; re-run the repro,
then the whole area on its default projects; remove the entry from `lib/known-bugs.ts` and mark the row
`pass`; write `**Fixed**: <date>, <files>, <guide sections followed>` under the failure; fix any doc
sentence the fix made false (README, docs/recipes, MANUAL_SMOKE). If it changes a published package, add
a changeset. List every file you changed. Never commit.

### Creating a flow file

Copy `apps/e2e/flows/_template.md`. Fill it from the CODE, not the specs: `packages/core/src`,
`packages/<binding>/src`, the demos in `examples/playground/src`, recent `git log`. Specs describe
things that were never built (`lockAspectRatio`, a `modal` fallback): write only what exists, and note
spec drift under Notes. One behaviour per row; columns `ID | Scenario | Expect | Targets | Needs | Status`.
Targets: `all` (every contract target), one target, `ext-persist`, or `none`. Needs: `docpip`,
`videopip`, `nopip` (only where Document PiP is missing), `any`. IDs use the file's prefix and are never
reused. Keep ids and `## Corrections` when refreshing. Add new files to `flows/README.md`.

### Corrections

- **Wrong expectation** ("that's intended"): change the row's Expect and the test, re-run.
- **False pass** ("passed but it's broken"): tighten the test until it fails for the right reason; `fail`.
- **False fail** ("failed but that's fine"): fix the test, not the library; re-run until reliable.

Log each as a dated line under `## Corrections`. Corrections beat the code: never drop them on refresh.

### Statuses

`todo` · `todo — retest: <what changed> <date>` · `new` (written, not yet green on its default projects) ·
`pass <date> · <projects>` · `fail <projects> <date>: <why>` · `skipped: <why>`. Details and duplicate
handling: `apps/e2e/flows/README.md`.

## Environment

- Targets (lib/targets.json): `playground` :5173 (the real app, React 19, StrictMode), `vanilla` :5181
  (the DOM contract on `createPip`), `react` :5182 (the contract on `<PipWrapper>`, plus `#/react-*` and
  `#/persist/*` pages), `next` :5183 (Next.js App Router: the React contract client-only at `/`, and
  server-rendered `/ssr`, `/ssr-persist` for tests/ssr). Every contract target serves `/#/<scenario>?<PipOptions query>` and renders the
  same DOM (apps/e2e-contract/src/index.ts: `NAMES`, `LOG`, `routeFor`).
- Network: OSM tiles and the CodeSandbox badge are stubbed; Monaco loads from cdn.jsdelivr.net
  (`@network` tests).
- Browsers: Google Chrome (`channel: 'chrome'`), Playwright's Firefox and WebKit (`playwright install
  firefox webkit` — ask before downloading), Edge only in CI unless installed. Real Safari only through
  `scripts/safari.mjs` (safaridriver); Playwright's WebKit is not Safari (no working video PiP).

## Commands

```bash
pnpm e2e                                          # everything, every local project
pnpm e2e tests/contract/lifecycle.spec.ts --project='vanilla-*' --project=react-chrome
pnpm e2e -g "LC3" --project=vanilla-firefox       # one row, one project
E2E_TARGETS=vanilla pnpm e2e --project='vanilla-*' # start only the vanilla dev server (comma list)
pnpm e2e:headed …                                 # watch
pnpm e2e:ui                                       # Playwright UI mode
pnpm e2e:server [target]                          # dev servers with timestamped logs
pnpm e2e:session vanilla "/#/basic?mode=clone" --browser=firefox   # explore by hand or agent (CDP :9222 on Chromium)
pnpm e2e:bug-report <area> [--replace]
node apps/e2e/scripts/flow-status.mjs [area]      # flow Status cells from the last run
E2E_KNOWN_BUGS=1 pnpm e2e                         # run as CI does: listed bugs are expected failures
pnpm --filter @pip-it-up/e2e exec playwright show-trace <trace.zip>
```

## Writing tests

- Import `test`, `expect` (and `needsExtension`, `onlyTargets`) from `lib/fixtures`; capabilities from
  `lib/capabilities` (`needs`, `needsMissing`, `has`); PiP helpers from `lib/pip` (`openPip`,
  `closePipLikeOS`, `clickClosingPip`/`pressClosingPip`, `markNode`/`expectNodeIn`, `documentTop`,
  `play`/`expectPlaying`, `recordPipRequests`, `expectSteady` for negatives held over time); contract
  locators from `lib/contract` (`contract(page)`, `expectLog`, `expectLifecycle`, `routeFor`);
  activation from `lib/activation`.
- Log entries are `LOG` in apps/e2e-contract. `reject:<name>` means open()/toggle() rejected WITHOUT
  onError reporting it: never expected, so an exact `expectLog` catches it.
- **The PiP window is the opener's `popup` event** (`openPip`), never `context.newPage()`. `pip.close()`
  stands in for the OS close button (fires `pagehide`); the library's own close paths are different
  code: test both.
- **`viewport: null` on every project** (the config does it). With Playwright's default viewport a PiP
  window reports 1280×720 whatever was requested. Never spread `devices[...]` in.
- **Every Playwright call grants user activation** (Chrome, Firefox, WebKit, ~5 s), read-only ones and
  `expect` polls included; `goto` doesn't. A "blocked without a gesture" test must schedule the trigger
  with a page timer ≥ 6 s and sleep in Node with NO page calls (`tabSwitchAfterQuiet`, `quietWait`);
  that is the only sanctioned sleep. A "works with a gesture" test proves only "works while activation
  is live".
- **Playwright can't hide a tab or freeze a page.** Use `simulateTabSwitch` / `restoreVisibility`
  (overrides `visibilityState`/`hidden`, dispatches `visibilitychange`) and `simulateFreeze` (dispatches
  `freeze`/`resume` at the document, non-bubbling, exactly as Chromium does).
- **Never feature-detect in a test.** Declare what it needs (`needs(testInfo, 'docPip')`); webkit has no
  Document PiP, no `moveBefore`, and a video-PiP API that always rejects. `tests/capabilities.spec.ts`
  keeps the declarations honest. Branching an expectation on a DECLARED capability (`has(...)`) is fine.
- Document PiP is blocked in iframes: Storybook and Vitest browser mode can't open real windows.
- Assert real outcomes: the same DOM node (`markNode` + `expectNodeIn`), `currentTime` rising and not
  paused (`expectPlaying`), canvas pixels, `documentTop` for layout shift, what `requestWindow` was
  asked for (`recordPipRequests`) separately from what the window manager granted (±24 px; headless
  caps sizes to a small virtual screen).
- Locate by role, label, placeholder or text; scope playground demos by their `<h2>` (several share
  "↗ Pop out"). No CSS class selectors. The garage is `aria-hidden`: read parked content through
  `[data-pip-shuttle="<id>"]`. If an element has no accessible name, report it as an app fix.
- Every assertion runs unconditionally: no `if (box) expect(...)`, no early `return`.
- A hash-only `page.goto` doesn't reload the page: one route per test (targets read the route once).
- Timings on dev servers: measure and report, never assert.
- The watchdog fails a test on uncaught errors (opener AND PiP window), console errors, and pip-it-up
  warnings (`[pip-it-up]`, `[PipWrapper]`, `[useVideoPip]`, `pip-it-up:` …). Allow an expected one with
  the narrowest pattern: `watchdog.allow(/\[pip-it-up\] ERR_DESTROYED: open\(\) called/)`.

## Adding a binding target

1. `apps/e2e-<framework>` (a workspace under `apps/*`, private, a `serve` script, not `dev`) implementing
   the DOM contract from `@pip-it-up/e2e-contract` for every scenario, in its DOM order, plus
   `window.__contract`. Call `applyHarness(route)` at load and log failures through `rejectionLog`.
2. Add it to `apps/e2e/lib/targets.json` (next free port from 5184, `tests: ["contract/**/*.spec.ts"]`,
   `extensions` it implements), the `TargetName` type, and the target list in `playwright.config.ts`.
3. Ask before: `pnpm install` (lockfile), `.changeset/config.json` ignore, `.github/dependabot.yml`,
   `.github/workflows/e2e.yml` (add its `<target>-chrome` project to the chrome job's `pnpm e2e`
   filter and its name to that job's and the `browsers` job's `E2E_TARGETS`).
4. `check parity`, and publish the parity table in the reply.

## Rules

- **Never `git commit` or `git push`** unless the user asks in so many words. Stop at the working tree.
- Don't change library code (`packages/`) to make a test pass. An app bug stays a failing test plus a
  note (and a `known-bugs.ts` entry). Fix only when asked.
- New e2e code goes in `apps/e2e*`. Before editing anything else (root `package.json`, `turbo.json`,
  `pnpm-workspace.yaml`, `.gitignore`, `.changeset/`, `.github/`, `packages/`, `examples/playground`,
  `apps/storybook`, README or docs), say what and why and wait for an OK. Don't add test-only hooks to
  the playground: ask.
- Ask before any install that rewrites `pnpm-lock.yaml` and before downloading browsers (say which and
  roughly how big).
- Leave alone: `.agile/`, `.specter/`, `.local-pack/`, and untracked "`name 2`" duplicates (iCloud sync
  conflict copies: `~/Documents` is synced). Mention them; don't delete them.
- Don't start two full-suite runs at once (they share fixed ports).
- Never `pkill -f dev-server.mjs`: other repos (nexus) run a script with the same name. Stop servers by
  PID or by their full pip-it-up path.
- End every piece of work with a list of every file you created or modified.
