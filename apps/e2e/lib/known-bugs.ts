import type { TestInfo } from '@playwright/test';
import type { BrowserName } from './capabilities';
import type { TargetName } from './targets';

/**
 * Known app bugs: tests that fail today because of a bug in the LIBRARY (never a test bug), each
 * with its flow row and TEST_PLAN.md entry.
 *
 * Only in CI (or with E2E_KNOWN_BUGS=1), a matching test is marked `test.fail()`: it must still
 * fail. So CI stays green while the bug exists, turns red on any NEW failure, and also turns red
 * when a listed bug gets FIXED ("expected to fail, but passed") — then delete the entry and mark
 * the flow row `pass`. Local runs ignore this list and show the real failures.
 *
 * Keep entries exact: an id plus the targets and browsers it fails on (from a real run; chromium
 * family browsers are grouped because they share the engine). Never add a flaky or test-side
 * failure here; fix the test instead.
 */
/** `flaky`: the bug shows only sometimes on these browsers, so CI SKIPS the row there (with the reason) instead of expecting a failure. */
type KnownBug = { id: string; targets: TargetName[]; browsers: BrowserName[]; bug: string; flaky?: boolean };

const CHROMIUM: BrowserName[] = ['chrome', 'msedge', 'chromium'];
const DOC_PIP: BrowserName[] = [...CHROMIUM, 'firefox'];
const ALL: BrowserName[] = [...DOC_PIP, 'webkit'];

export const KNOWN_BUGS: KnownBug[] = [
  // Not a pip-it-up bug: Monaco resolves focus against its main window only (dom.getActiveDocument),
  // so its shortcuts don't fire inside a PiP window. Docs claim otherwise (flows/media-editors.md).
  { id: 'ME2', targets: ['playground'], browsers: DOC_PIP, bug: 'Monaco limitation: its shortcuts ignore a PiP window' },
];

export const knownBugsEnabled = () => !!(process.env.CI || process.env.E2E_KNOWN_BUGS);

/** Mark this test as an expected failure if it's a listed known bug for this project (CI only). */
export function markKnownBug(testInfo: TestInfo) {
  if (!knownBugsEnabled()) return;
  const id = testInfo.title.match(/^([A-Z]+\d+)\b/)?.[1];
  const meta = testInfo.project.metadata as { target?: TargetName; browser?: BrowserName };
  if (!id || !meta.target || !meta.browser) return;
  const hit = KNOWN_BUGS.find((b) => b.id === id && b.targets.includes(meta.target!) && b.browsers.includes(meta.browser!));
  if (hit?.flaky) testInfo.skip(true, `known flaky bug: ${hit.bug} (lib/known-bugs.ts)`);
  else if (hit) testInfo.fail(true, `known bug: ${hit.bug} (lib/known-bugs.ts)`);
}
