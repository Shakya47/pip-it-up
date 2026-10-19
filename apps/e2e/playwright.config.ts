import { spawnSync } from 'node:child_process';
import { defineConfig, type Project } from '@playwright/test';
import { REPO_ROOT, TARGETS, targetURL, type TargetName } from './lib/targets';
import type { BrowserName } from './lib/capabilities';
import type { ProjectMeta } from './lib/fixtures';

/**
 * Projects are `<target>-<browser>`, plus `packaging` (no browser).
 *
 * `viewport: null` on every project: with Playwright's default viewport a PiP window requested
 * at 400×300 reports innerWidth × innerHeight 1280×720. Don't spread `devices[...]` presets in:
 * `deviceScaleFactor` and `isMobile` can't be combined with a null viewport.
 */
const BROWSERS: Record<BrowserName, Project['use']> = {
  chrome: { browserName: 'chromium', channel: 'chrome' },
  msedge: { browserName: 'chromium', channel: 'msedge' },
  // Chrome for Testing in new headless. NOT plain `chromium`: the default headless shell opens
  // Document PiP windows at 800×600 whatever size is requested.
  chromium: { browserName: 'chromium', channel: 'chromium' },
  firefox: { browserName: 'firefox' },
  webkit: { browserName: 'webkit' },
};

function project(target: TargetName, browser: BrowserName): Project {
  const t = TARGETS[target];
  const metadata: ProjectMeta = { target, browser };
  return {
    name: `${target}-${browser}`,
    testMatch: t.tests,
    metadata,
    use: { ...BROWSERS[browser], baseURL: targetURL(t), viewport: null },
  };
}

/**
 * Browsers in the matrix. chrome, firefox and webkit always; msedge in CI (the runner installs it
 * with `playwright install msedge`) or locally with E2E_EDGE=1 once Edge is installed; chromium
 * (Chrome for Testing, a separate download) only with E2E_CHROMIUM=1.
 * Filter with `--project=<target>-<browser>`, e.g. `pnpm e2e --project=vanilla-firefox`.
 */
const MATRIX_BROWSERS: BrowserName[] = [
  'chrome',
  ...(process.env.CI || process.env.E2E_EDGE ? (['msedge'] as const) : []),
  'firefox',
  'webkit',
  ...(process.env.E2E_CHROMIUM ? (['chromium'] as const) : []),
];

/**
 * Targets this run serves and tests: `E2E_TARGETS=vanilla,react` (default: every target in
 * lib/targets.json). It limits BOTH the `<target>-<browser>` projects and the dev servers, so a
 * vanilla-only CI job doesn't start (and wait for) Next.js. `--project` still filters within it.
 */
const ALL_TARGETS = Object.keys(TARGETS) as TargetName[];
const SELECTED_TARGETS: TargetName[] = (() => {
  const names = (process.env.E2E_TARGETS ?? '').split(',').map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) return ALL_TARGETS;
  const unknown = names.filter((n) => !ALL_TARGETS.includes(n as TargetName));
  if (unknown.length) throw new Error(`E2E_TARGETS: unknown target(s) ${unknown.join(', ')}. Known: ${ALL_TARGETS.join(', ')}`);
  return names as TargetName[];
})();

/**
 * Locally, build the packages before anything is served: the targets import @pip-it-up/* from
 * dist/, and a stale dist (or a reused dev server on it) would test old code. turbo caches the
 * build, so an unchanged tree costs about a second. Runs once, in the runner process: workers
 * (TEST_WORKER_INDEX) and nested loads inherit E2E_PACKAGES_BUILT. CI builds in its own step
 * first. Opt out with E2E_SKIP_BUILD=1 (e.g. while `pnpm --filter "./packages/*" dev` runs).
 */
if (!process.env.CI && !process.env.E2E_SKIP_BUILD && !process.env.E2E_PACKAGES_BUILT && !process.env.TEST_WORKER_INDEX) {
  console.log('[e2e] building the packages (turbo, cached) so the targets serve current code');
  const built = spawnSync('pnpm', ['exec', 'turbo', 'run', 'build', '--filter=./packages/*', '--output-logs=errors-only'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
  if (built.status !== 0) throw new Error(`[e2e] building the packages failed (exit ${built.status}); fix the build or set E2E_SKIP_BUILD=1`);
  process.env.E2E_PACKAGES_BUILT = '1';
}

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 4,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  // Never auto-open the report: it blocks agents and CI. results.json feeds
  // `pnpm e2e:bug-report <area>` (scripts/bug-report.mjs).
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    actionTimeout: 10_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    ...MATRIX_BROWSERS.flatMap((browser) => SELECTED_TARGETS.map((target) => project(target, browser))),
    // MANUAL_SMOKE C: packs the packages and inspects the tarballs. No browser.
    { name: 'packaging', testMatch: 'packaging.spec.ts' },
    // PK5: packed tarballs installed with npm into a temp app outside the workspace (slow, ~40 MB
    // from npm). Only with E2E_TARBALL=1; full CI runs (push to main, manual) set it.
    ...(process.env.E2E_TARBALL
      ? [{ name: 'tarball', testMatch: 'tarball.spec.ts', use: { browserName: 'chromium' as const, channel: 'chrome', viewport: null } }]
      : []),
  ],
  // One dev server per SELECTED target (E2E_TARGETS), each with timestamped output in
  // logs/<target>.log. Locally a server that is already running (`pnpm e2e:server`, or your own
  // `pnpm dev`) is reused; it serves the dist/ just rebuilt above. `--no-build`: the build ran
  // once above, rather than once per server in parallel.
  webServer: SELECTED_TARGETS.map((name) => TARGETS[name]).map((t) => ({
    command: `node apps/e2e/scripts/dev-server.mjs ${t.name} --no-build`,
    cwd: REPO_ROOT,
    url: targetURL(t),
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Let dev-server.mjs stop Vite and flush its log; Playwright SIGKILLs the group after 5 s.
    gracefulShutdown: { signal: 'SIGTERM' as const, timeout: 5_000 },
  })),
});
