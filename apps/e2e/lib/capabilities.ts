import { test, type TestInfo } from '@playwright/test';

/**
 * What each browser can do, DECLARED rather than detected.
 *
 * Tests never branch on runtime feature detection: if a browser silently lost Document PiP, a
 * detecting test would skip itself and stay green. Instead a test states what it needs
 * (`needs(testInfo, 'docPip')`), and is skipped only where this table says the capability is
 * missing. `tests/capabilities.spec.ts` checks every live browser still matches its row, so a
 * change in either direction (a regression, or Safari shipping Document PiP) fails loudly.
 *
 * Verified 2026-09-27 on macOS 26.5 with Playwright 1.63 (see flows/capabilities.md):
 * - chrome: Google Chrome 153 (`channel: 'chrome'`, new headless).
 * - firefox: Playwright's Firefox 155. Document PiP ships in Firefox 151+, video PiP in 153+.
 * - webkit: Playwright's WebKit 26.6. `requestPictureInPicture` exists and
 *   `pictureInPictureEnabled` is true, but every request rejects with NotSupportedError, headless
 *   and headed; `webkitSetPresentationMode('picture-in-picture')` stays `inline`. Real Safari
 *   has video PiP; this build does not. So webkit covers the "no PiP" fallback paths only.
 * - msedge: expected to match chrome; not verified locally (Edge isn't installed).
 *
 * Never add Playwright's default headless shell (plain `chromium` without a channel): it opens
 * Document PiP windows at 800×600 whatever size is requested.
 */
export type Capability = 'docPip' | 'videoPip' | 'moveBefore' | 'h264' | 'userActivation';

export type BrowserName = 'chrome' | 'msedge' | 'chromium' | 'firefox' | 'webkit';

export const CAPABILITIES: Record<BrowserName, Record<Capability, boolean>> = {
  chrome: { docPip: true, videoPip: true, moveBefore: true, h264: true, userActivation: true },
  msedge: { docPip: true, videoPip: true, moveBefore: true, h264: true, userActivation: true },
  chromium: { docPip: true, videoPip: true, moveBefore: true, h264: true, userActivation: true },
  firefox: { docPip: true, videoPip: true, moveBefore: true, h264: true, userActivation: true },
  webkit: { docPip: false, videoPip: false, moveBefore: false, h264: true, userActivation: true },
};

export const browserOf = (testInfo: TestInfo): BrowserName =>
  (testInfo.project.metadata as { browser: BrowserName }).browser;

export const has = (testInfo: TestInfo, capability: Capability) =>
  CAPABILITIES[browserOf(testInfo)][capability];

/** Skip this test where the declared capabilities say the browser can't run it. */
export function needs(testInfo: TestInfo, ...capabilities: Capability[]) {
  const browser = browserOf(testInfo);
  const missing = capabilities.filter((c) => !CAPABILITIES[browser][c]);
  test.skip(missing.length > 0, `${browser} has no ${missing.join(', ')} (lib/capabilities.ts)`);
}

/** Run this test ONLY where the browser lacks these capabilities (fallback paths: flows `Needs: nopip`). */
export function needsMissing(testInfo: TestInfo, ...capabilities: Capability[]) {
  const browser = browserOf(testInfo);
  const present = capabilities.filter((c) => CAPABILITIES[browser][c]);
  test.skip(present.length > 0, `${browser} has ${present.join(', ')}; this test covers browsers without it`);
}
