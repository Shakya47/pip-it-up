# E2E tests

Real-browser tests for `@pip-it-up/core` and `@pip-it-up/react`, built on Playwright: real Document PiP
windows, real clicks and keystrokes, in Chrome, Firefox and WebKit (Edge in CI). Every framework binding
implements one shared DOM contract, so a new binding gets the whole suite for free.

## Testing with a short prompt

Tell an agent (Claude Code, Antigravity) `test lifecycle`, `test sizing on firefox`, `test smoke`,
`check parity` or `test all`. Each area has a scenario list in [`flows/`](flows/README.md), which the
agent writes from the code; you only correct it. The full brief is the `pip-e2e` skill
(`.agents/skills/pip-e2e/SKILL.md`, the same file at `.claude/skills/pip-e2e/SKILL.md`), so prompts stay
short. [`TEST_PLAN.md`](TEST_PLAN.md) is the checklist of what's done and what's next, including the
open app bugs the suite found.

## First run

1. `pnpm install`. The targets import the packages from `dist/`; every local run builds them first
   (turbo, cached, `playwright.config.ts`), so a run never tests stale code.
2. Browsers: Google Chrome is used as installed. For Firefox and WebKit:
   `pnpm --filter @pip-it-up/e2e exec playwright install firefox webkit` (~180 MB).
3. `pnpm e2e`

Set `E2E_SKIP_BUILD=1` to skip that build (e.g. while `pnpm --filter "./packages/*" dev` rebuilds on save).

## Commands (repo root)

| Command | What it does |
| --- | --- |
| `pnpm e2e` | Everything, headless, every local project |
| `pnpm e2e --project='vanilla-*'` | One target in every browser (`<target>-<browser>` projects) |
| `pnpm e2e --project='*-firefox'` | Every target in one browser |
| `pnpm e2e tests/contract/sizing.spec.ts` | Spec files matching a path |
| `pnpm e2e -g "SZ5"` | Tests whose title matches (titles start with the flow row id) |
| `pnpm e2e:headed` / `pnpm e2e:ui` | Watch the browsers / Playwright UI mode |
| `pnpm e2e:report` | Open the last HTML report |
| `pnpm e2e:server [target]` | Start the targets' dev servers, output timestamped into `logs/<target>.log` |
| `pnpm e2e:session <target> [path] [--browser=firefox]` | A headed browser on a target to explore by hand or by agent |
| `pnpm e2e:bug-report <area>` | A markdown bug report with evidence from the last run, in `reports/` |
| `node apps/e2e/scripts/flow-status.mjs [area]` | Merge the last run into the flow Status cells (partial runs update only the projects they ran) |
| `E2E_TARGETS=vanilla,react pnpm e2e` | Only these targets: their projects AND their dev servers (default: all) |
| `E2E_KNOWN_BUGS=1 pnpm e2e` | Run the way CI does (known app bugs as expected failures) |
| `E2E_TARBALL=1 pnpm e2e --project=tarball` | PK5: the packed tarballs in a clean npm app outside the workspace |
| `node apps/e2e/scripts/safari.mjs` | Real Safari via safaridriver (run `sudo safaridriver --enable` once) |

## How it works

- **Targets** (`lib/targets.json`): `playground` (:5173, the real demo app), `vanilla` (:5181,
  `apps/e2e-vanilla`: the contract on `createPip`), `react` (:5182, `apps/e2e-react`: the contract on
  `<PipWrapper>` in StrictMode, plus React-only and route-persistent pages), `next` (:5183,
  `apps/e2e-next`: Next.js, the same contract client-only plus server-rendered pages for SSR checks).
- **The contract** (`apps/e2e-contract`): scenario routes `/#/<scenario>?<PipOptions query>`, the
  accessible names every target renders (`NAMES`), and the lifecycle log entries (`LOG`). Specs in
  `tests/contract` import the same module, so labels can't drift between targets and tests.
- **Capabilities** (`lib/capabilities.ts`): what each browser can do, declared, never detected. A test
  says what it needs (`needs(testInfo, 'docPip')`) and is skipped where it can't run;
  `tests/capabilities.spec.ts` fails if a browser stops matching its declaration.
- **Activation** (`lib/activation.ts`): every Playwright call grants user activation, and Playwright
  can't hide a tab or freeze a page, so tab switches and freezes are simulated in the page, and
  "blocked without a gesture" tests wait out the activation window without touching the page.
- **Watchdog** (`lib/watchdog.ts`): watches every page of a test's context, PiP windows included. A test
  fails on uncaught errors, console errors, and pip-it-up's own warnings unless it allows them.
- **Known bugs** (`lib/known-bugs.ts`): app bugs the suite found. Locally they fail; in CI they run as
  expected failures, so CI goes red on a new failure or when a listed bug gets fixed.
- **Flows** (`flows/*.md`): one scenario table per area with per-project statuses, notes and possible bugs.
- **CI** (`.github/workflows/e2e.yml`): on PRs, vanilla in every browser plus react, playground and
  packaging in Chrome; on `main` and on demand (Actions → E2E → Run workflow), the full matrix. Reports and traces are
  uploaded when a job fails.

```ts
import { test, expect } from '../../lib/fixtures';
import { needs } from '../../lib/capabilities';
import { openPip, markNode, expectNodeIn } from '../../lib/pip';
import { contract, routeFor, NAMES } from '../../lib/contract';

test('LC1 "Open PiP" moves the same node into a real PiP window @docpip', async ({ page }, testInfo) => {
  needs(testInfo, 'docPip');
  await page.goto(routeFor('basic'));
  const c = contract(page);
  await markNode(c.content, 'content');

  const pip = await openPip(page, c.open);

  await expectNodeIn(page, 'content', 'pip');
  await expect(c.contentIn(pip).getByRole('heading', { name: NAMES.heading })).toBeVisible();
});
```

## Adding a framework binding

Create `apps/e2e-<framework>` implementing the contract, add it to `lib/targets.json` and the config's
target list, and run `check parity`. The skill has the checklist.

## Troubleshooting

- **A test uses stale library code**: every local run rebuilds the packages before serving; a dev server you
  started earlier (reused) serves the rebuilt `dist/` too. With `E2E_SKIP_BUILD=1`, rebuild yourself or keep
  `pnpm --filter "./packages/*" dev` running.
- **"Chromium distribution 'chrome' is not found"**: install Google Chrome, or run with
  `E2E_CHROMIUM=1 pnpm e2e --project='*-chromium'` after `playwright install chromium`.
- **A port is already in use**: something else serves 5173/5181/5182/5183. Locally it's reused; stop it if
  it isn't the right app.
- **Files named "`<name> 2.<ext>`" appear**: iCloud Drive conflict copies (the repo lives in a synced
  `~/Documents`). They're not part of the suite.
