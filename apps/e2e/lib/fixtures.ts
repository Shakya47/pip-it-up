import { test as base, type TestInfo } from '@playwright/test';
import { DEFAULT_WATCHDOG, Watchdog, originOf, type WatchdogOptions } from './watchdog';
import { attachServerLog } from './server-log';
import { stubExternal } from './network';
import { TARGETS, targetURL, type Extension, type Target, type TargetName } from './targets';
import { browserOf, type BrowserName } from './capabilities';
import { markKnownBug } from './known-bugs';

export { expect } from '@playwright/test';

/** Skip unless this project's target implements the contract extension (flows `Targets: ext-persist`). */
export function needsExtension(testInfo: TestInfo, extension: Extension) {
  const meta = testInfo.project.metadata as ProjectMeta;
  base.skip(!TARGETS[meta.target].extensions.includes(extension), `${meta.target} doesn't implement @ext-${extension}`);
}

/** Skip unless this project runs one of these targets (flows `Targets: vanilla`, `react`, ...). */
export function onlyTargets(testInfo: TestInfo, ...targets: TargetName[]) {
  const meta = testInfo.project.metadata as ProjectMeta;
  base.skip(!targets.includes(meta.target), `row is for ${targets.join(', ')} only`);
}

/** Project metadata every project sets in playwright.config.ts. */
export type ProjectMeta = { target: TargetName; browser: BrowserName };

type Fixtures = {
  /** The app this project drives (from project metadata). */
  target: Target;
  /** The browser this project runs (from project metadata); read capabilities via lib/capabilities. */
  browserKind: BrowserName;
  /** Per-test watchdog over the whole context, PiP windows included. Auto. */
  watchdog: Watchdog;
  /** Override per file with `test.use({ watchdogOptions: { ...DEFAULT_WATCHDOG, ... } })`. */
  watchdogOptions: WatchdogOptions;
};

export const test = base.extend<Fixtures>({
  watchdogOptions: [DEFAULT_WATCHDOG, { option: true }],

  target: async ({}, use, testInfo) => {
    const meta = testInfo.project.metadata as ProjectMeta;
    await use(TARGETS[meta.target]);
  },

  browserKind: async ({}, use, testInfo) => {
    await use(browserOf(testInfo));
  },

  context: async ({ context }, use) => {
    await stubExternal(context);
    await use(context);
  },

  watchdog: [
    async ({ context, target, watchdogOptions }, use, testInfo) => {
      markKnownBug(testInfo);
      const startedAt = Date.now();
      const origins = new Set(Object.values(TARGETS).flatMap((t) => [originOf(targetURL(t)), `http://127.0.0.1:${t.port}`]));
      const watchdog = new Watchdog(watchdogOptions, origins);
      watchdog.watch(context);
      await use(watchdog);
      await attachServerLog(testInfo, target.name, startedAt);
      await watchdog.finish(testInfo);
    },
    { auto: true },
  ],
});
