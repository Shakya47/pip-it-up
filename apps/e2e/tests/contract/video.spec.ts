/**
 * flows/video.md (VP): media inside Document PiP (V12), and core's automatic video fallback: when
 * Document PiP is unavailable (or `forceFallback`), content holding exactly ONE <video> enters
 * classic video PiP instead. Videos are canvas.captureStream() (no codec needed).
 */
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../lib/fixtures';
import { needs, needsMissing } from '../../lib/capabilities';
import { openPip, closePipLikeOS, consoleMessage, expectPlaying, play } from '../../lib/pip';
import { contract, expectLog, expectLifecycle, expectLogged, logEntries, LOG, NAMES, routeFor } from '../../lib/contract';
import { simulateTabSwitch, tabSwitchAfterQuiet } from '../../lib/activation';

const inVideoPip = (video: Locator) => video.evaluate((v) => v.ownerDocument.pictureInPictureElement === v);
const anyVideoPip = (page: Page) => page.evaluate(() => document.pictureInPictureElement !== null);
/** Core's `fallback: 'none'` warning (fallback.ts): logged only once open() has given up on every PiP path. */
const NONE_FALLBACK = /pip-it-up: Document Picture-in-Picture is not supported/;

test.describe('video', () => {
  test('VP1 a playing <video> keeps playing through Document PiP open and close (V12) @smoke @docpip', async ({ page }, testInfo) => {
    needs(testInfo, 'docPip');
    await page.goto(routeFor('video'));
    const c = contract(page);
    const t = await play(c.content.getByLabel(NAMES.video));

    const pip = await openPip(page, c.open);
    const inPip = await expectPlaying(c.contentIn(pip).getByLabel(NAMES.video), t);
    await closePipLikeOS(pip);

    await expectPlaying(c.content.getByLabel(NAMES.video), inPip);
  });

  test('VP2 forceFallback with a single <video>: it enters video PiP instead, and the instance reports open @video', async ({ page, context }, testInfo) => {
    needs(testInfo, 'videoPip');
    await page.goto(routeFor('video', { forceFallback: true }));
    const c = contract(page);
    const video = c.content.getByLabel(NAMES.video);
    await play(video);
    let windows = 0;
    context.on('page', () => windows++);

    await c.open.click();

    await expect.poll(() => inVideoPip(video)).toBe(true);
    await expect(c.status).toHaveText(NAMES.status.open);
    await expectLog(page, [LOG.open]);
    expect(windows).toBe(0);
  });

  test('VP3 closing the instance exits video PiP @video', async ({ page }, testInfo) => {
    needs(testInfo, 'videoPip');
    await page.goto(routeFor('video', { forceFallback: true }));
    const c = contract(page);
    const video = c.content.getByLabel(NAMES.video);
    await play(video);
    await c.open.click();
    await expect.poll(() => inVideoPip(video)).toBe(true);

    await c.close.click();

    await expect.poll(() => anyVideoPip(page)).toBe(false);
    await expect(c.status).toHaveText(NAMES.status.closed);
    await expectLifecycle(page, [LOG.open, LOG.close]);
  });

  test('VP4 leaving video PiP from the browser side closes the instance (leavepictureinpicture) @video', async ({ page }, testInfo) => {
    needs(testInfo, 'videoPip');
    await page.goto(routeFor('video', { forceFallback: true }));
    const c = contract(page);
    const video = c.content.getByLabel(NAMES.video);
    await play(video);
    await c.open.click();
    await expect.poll(() => inVideoPip(video)).toBe(true);

    await page.evaluate(() => document.exitPictureInPicture());

    await expect(c.status).toHaveText(NAMES.status.closed);
    await expectLifecycle(page, [LOG.open, LOG.close]);
  });

  test('VP5 disableVideoPip: no video PiP; with fallback none nothing opens @video', async ({ page, context, watchdog }, testInfo) => {
    needs(testInfo, 'videoPip');
    watchdog.allow(/pip-it-up: Document Picture-in-Picture is not supported/);
    await page.goto(routeFor('video', { forceFallback: true, disableVideoPip: true }));
    const c = contract(page);
    await play(c.content.getByLabel(NAMES.video));
    let windows = 0;
    context.on('page', () => windows++);

    const gaveUp = consoleMessage(page, NONE_FALLBACK);

    await c.open.click();

    // Positive signal first: open() reached the 'none' fallback (it would never get there after
    // entering video PiP), THEN the state is read.
    await gaveUp;
    await expect(c.status).toHaveText(NAMES.status.closed);
    expect(await anyVideoPip(page)).toBe(false);
    expect(windows).toBe(0);
  });

  test('VP6 two <video>s: no automatic video fallback (it needs exactly one) @video', async ({ page, watchdog }, testInfo) => {
    needs(testInfo, 'videoPip');
    watchdog.allow(/pip-it-up: Document Picture-in-Picture is not supported/);
    await page.goto(routeFor('multi-video', { forceFallback: true }));
    const c = contract(page);
    await play(c.content.getByLabel(NAMES.video));
    const gaveUp = consoleMessage(page, NONE_FALLBACK);

    await c.open.click();

    await gaveUp;
    await expect(c.status).toHaveText(NAMES.status.closed);
    expect(await anyVideoPip(page)).toBe(false);
  });

  // Since 2026-09-29 (core A2): with fallback 'none' there is nothing left to fall through to, so
  // a rejected video PiP request is a failed open: open() rejects and onError gets the browser's
  // error (Playwright WebKit: NotSupportedError, lib/capabilities.ts). It used to warn and resolve.
  test('VP7 no Document PiP and a video PiP that rejects: open() fails, onError gets the video error; nothing opens @nopip', async ({ page }, testInfo) => {
    needsMissing(testInfo, 'docPip', 'videoPip');
    await page.goto(routeFor('video'));
    const c = contract(page);
    await play(c.content.getByLabel(NAMES.video));

    await c.open.click();

    // Exact log: reported through onError once, and no `reject:` (onError did run).
    await expectLog(page, [LOG.error('NotSupportedError')]);
    await expect(c.status).toHaveText(NAMES.status.closed);
    expect(await anyVideoPip(page)).toBe(false);
  });

  // `video-api`: core's enterVideoPip / exitVideoPip (vanilla) and useVideoPip (react) on a video
  // outside the content — the playground's "Native Video PiP" demo.
  test.describe('direct video PiP API', () => {
    test.beforeEach(async ({ page }, testInfo) => {
      needs(testInfo, 'videoPip', 'userActivation');
      await page.goto(routeFor('video-api'));
      await expectPlaying(page.getByLabel(NAMES.standaloneVideo));
    });
    const standalone = (page: Page) => page.getByLabel(NAMES.standaloneVideo);

    test('VP8 "Enter video PiP" puts the standalone video in PiP; the status follows the element events @video', async ({ page }) => {
      await page.getByRole('button', { name: NAMES.enterVideo }).click();

      await expect.poll(() => inVideoPip(standalone(page))).toBe(true);
      await expect(page.getByText(NAMES.videoStatus(true))).toBeVisible();
    });

    test('VP9 "Exit video PiP" leaves it; the status goes back to off @video', async ({ page }) => {
      await page.getByRole('button', { name: NAMES.enterVideo }).click();
      await expect(page.getByText(NAMES.videoStatus(true))).toBeVisible();

      await page.getByRole('button', { name: NAMES.exitVideo }).click();

      await expect.poll(() => anyVideoPip(page)).toBe(false);
      await expect(page.getByText(NAMES.videoStatus(false))).toBeVisible();
    });

    test('VP10 leaving video PiP from the browser side (its own close) updates the status too @video', async ({ page }) => {
      await page.getByRole('button', { name: NAMES.enterVideo }).click();
      await expect(page.getByText(NAMES.videoStatus(true))).toBeVisible();

      await page.evaluate(() => document.exitPictureInPicture());

      await expect(page.getByText(NAMES.videoStatus(false))).toBeVisible();
    });

    test('VP11 video auto-PiP: armed, the tab is hidden while activation is live — the video enters PiP, reported as a gesture @video', async ({ page }) => {
      await page.getByRole('checkbox', { name: NAMES.autoVideo }).check();

      await simulateTabSwitch(page, 'hidden');

      await expect.poll(() => inVideoPip(standalone(page))).toBe(true);
      await expectLogged(page, LOG.autoOk('gesture'));
    });

    test('VP12 video auto-PiP: untouched for 6.5 s, then hidden — blocked, and reported as blocked (not as a success) @video @slow', async ({ page, watchdog }) => {
      watchdog.allow(/\[useVideoPip\]/);
      await page.getByRole('checkbox', { name: NAMES.autoVideo }).check();

      await tabSwitchAfterQuiet(page);

      await expectLogged(page, LOG.autoBlocked('NotAllowedError', false));
      expect(await anyVideoPip(page)).toBe(false);
      expect((await logEntries(page)).some((e) => e.startsWith('auto:ok'))).toBe(false);
    });
  });
});
