/**
 * flows/route-persistent.md (RP): <PipProvider> + <PipAnchor> on the react target's
 * `#/persist/<home|away>` page (contract extension @ext-persist). Only "Home" renders anchors.
 * Design spec §7 ids in brackets.
 */
import type { Page } from '@playwright/test';
import { test, expect, needsExtension } from '../../lib/fixtures';
import { has, needs } from '../../lib/capabilities';
import { openPip, closePipLikeOS, markNode, expectNodeIn, nodeWhereabouts, documentTop, expectPlaying, expectSteady } from '../../lib/pip';
import { simulateTabSwitch, restoreVisibility, simulateFreeze } from '../../lib/activation';
import { NAMES } from '../../lib/contract';

const tracker = (p: Page) => p.getByRole('region', { name: 'Tracker' });
const seconds = async (p: Page) => Number((await tracker(p).getByText(/^Seconds: \d+$/).textContent())?.split(': ')[1]);
const loads = async (p: Page) => Number((await p.getByText(/^Frame loads: \d+$/).textContent())?.split(': ')[1]);
const go = async (page: Page, route: 'Home' | 'Away') => {
  await page.getByRole('navigation', { name: 'Routes' }).getByRole('button', { name: route }).click();
  await expect(page.getByRole('heading', { level: 1, name: route })).toBeVisible();
};
const garage = (page: Page) => page.locator('[data-pip-garage]');
const shuttle = (page: Page, id: string) => page.locator(`[data-pip-shuttle="${id}"]`);
/** The tracker while parked: the garage is aria-hidden, so role locators can't see into it. */
const parked = (page: Page) => shuttle(page, 'tracker');

test.describe('route-persistent', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    needsExtension(testInfo, 'persist');
  });

  async function home(page: Page, query = '') {
    await page.goto(`/#/persist/home${query ? `?${query}` : ''}`);
    await expect(tracker(page).getByText('Placement: anchor')).toBeVisible();
    await markNode(tracker(page), 'tracker');
  }

  test('RP1 on Home the tracker is docked in its anchor, active @smoke @ext-persist', async ({ page }) => {
    await home(page);

    await expect(tracker(page).getByText('Level: active')).toBeVisible();
    await expect.poll(() => seconds(page)).toBeGreaterThanOrEqual(1);
  });

  test('RP2 popping out leaves a placeholder of the same size: the content below does not move relative to the anchor (V15) @docpip @ext-persist', async ({ page }, testInfo) => {
    needs(testInfo, 'docPip');
    await home(page);
    const anchor = page.locator('[data-pip-anchor="tracker"]');
    const below = page.getByText(NAMES.below, { exact: true });
    // Relative to the anchor: the header's trigger label changes ("↗ Pop out" → "⊠ Close") and its
    // glyph's font can change the header's height; that isn't the anchor's reservation.
    const gap = async () => (await documentTop(below)) - (await documentTop(anchor));
    const before = { gap: await gap(), height: (await anchor.boundingBox())!.height };

    const pip = await openPip(page, page.getByRole('button', { name: '↗ Pop out' }));

    await expect(tracker(pip).getByText('Placement: pip')).toBeVisible();
    await expect(page.getByText('Tracker is away')).toBeVisible();
    expect((await anchor.boundingBox())!.height).toBeCloseTo(before.height, 0);
    expect(await gap()).toBeCloseTo(before.gap, 0);
  });

  test('RP3 in PiP the tracker survives Away and back; closing re-docks the same node with its count (V10, V13) @smoke @docpip @ext-persist', async ({ page }, testInfo) => {
    needs(testInfo, 'docPip');
    await home(page);
    const pip = await openPip(page, page.getByRole('button', { name: '↗ Pop out' }));
    await go(page, 'Away');
    await expect.poll(() => seconds(pip)).toBeGreaterThanOrEqual(2);
    await go(page, 'Home');
    await expect(tracker(pip).getByText('Placement: pip')).toBeVisible();
    const inPip = await seconds(pip);

    await closePipLikeOS(pip);

    await expectNodeIn(page, 'tracker', 'opener');
    await expect(tracker(page).getByText('Placement: anchor')).toBeVisible();
    expect(await seconds(page)).toBeGreaterThanOrEqual(inPip);
  });

  test('RP4 with no anchor and no window the subtree parks in the attached, inert, hidden garage (V14) @ext-persist', async ({ page }) => {
    await home(page);

    await go(page, 'Away');

    await expect(parked(page).getByText('Placement: garage')).toBeAttached();
    const g = garage(page);
    await expect(g).toHaveCount(1);
    await expect(g).toHaveAttribute('inert', '');
    await expect(g).toHaveAttribute('aria-hidden', 'true');
    expect(await g.evaluate((el) => [el.parentElement === document.body, getComputedStyle(el).contentVisibility])).toEqual([true, 'hidden']);
    await expect(shuttle(page, 'tracker')).toHaveCount(1);
    expect(await shuttle(page, 'tracker').evaluate((el) => el.parentElement?.hasAttribute('data-pip-garage'))).toBe(true);
    // Hidden from the accessibility tree, and not focusable.
    await expect(page.getByRole('textbox', { name: 'Tracker notes' })).toHaveCount(0);
    const focused = await page.locator('input[aria-label="Tracker notes"]').evaluate((el: HTMLInputElement) => {
      el.focus();
      return document.activeElement === el;
    });
    expect(focused).toBe(false);
    await expectNodeIn(page, 'tracker', 'opener');
  });

  test('RP5 parked in the garage the tracker is dormant; back on Home it is active and kept its count @ext-persist', async ({ page }) => {
    await home(page);
    await expect.poll(() => seconds(page)).toBeGreaterThanOrEqual(1);
    const before = await seconds(page);

    await go(page, 'Away');
    await expect(parked(page).getByText('Level: dormant')).toBeAttached();
    await go(page, 'Home');

    await expect(tracker(page).getByText('Level: active')).toBeVisible();
    expect(await seconds(page)).toBeGreaterThanOrEqual(before);
    await expectNodeIn(page, 'tracker', 'opener');
  });

  test('RP6 dormantMedia=pause (default): a playing video pauses when parked and resumes on return @video @ext-persist', async ({ page }) => {
    await home(page);
    const video = page.getByLabel('Player video');
    await expectPlaying(video);

    await go(page, 'Away');
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
    await go(page, 'Home');

    await expectPlaying(video);
  });

  test('RP7 dormantMedia=keep: a parked video keeps playing @video @ext-persist', async ({ page }) => {
    await home(page, 'dormantMedia=keep');
    const video = page.getByLabel('Player video');
    const t = await expectPlaying(video);

    await go(page, 'Away');

    await expectPlaying(video, t);
  });

  test('RP8 hiding the tab makes a docked tracker "background"; showing it makes it "active" again @ext-persist', async ({ page }) => {
    await home(page);

    await simulateTabSwitch(page, 'hidden');
    await expect(tracker(page).getByText('Level: background')).toBeAttached();
    await restoreVisibility(page);

    await expect(tracker(page).getByText('Level: active')).toBeVisible();
  });

  test('RP9 a Page Lifecycle freeze (dispatched at the document, as Chromium does) makes the tracker "frozen" (V18) @ext-persist', async ({ page }) => {
    await home(page);

    await simulateFreeze(page, 'freeze');
    await expect(tracker(page).getByText('Level: frozen')).toBeVisible();
    await simulateFreeze(page, 'resume');

    await expect(tracker(page).getByText('Level: active')).toBeVisible();
  });

  test('RP10 Home → Away → Home moves the shuttle within the page; with moveBefore its iframe does not reload @ext-persist', async ({ page }, testInfo) => {
    await home(page);
    await expect.poll(() => loads(page)).toBeGreaterThanOrEqual(1);
    const before = await loads(page);
    // Tag the frame's current document: a reload replaces it (synchronously on re-insertion), so
    // a missing tag proves a reload even before the `load` counter catches up.
    const frame = page.locator('iframe[title="Tracker frame"]');
    const tagged = () => frame.evaluate((f: HTMLIFrameElement) => (f.contentWindow as unknown as { __e2eTag?: boolean } | null)?.__e2eTag === true);
    await frame.evaluate((f: HTMLIFrameElement) => {
      (f.contentWindow as unknown as { __e2eTag: boolean }).__e2eTag = true;
    });

    await go(page, 'Away');
    await go(page, 'Home');
    await expectNodeIn(page, 'tracker', 'opener');

    // Declared per browser (lib/capabilities.ts): appendChild (no moveBefore) reloads iframes.
    if (has(testInfo, 'moveBefore')) {
      // The `load` counter increments a little after a reload, so hold it for 1 s (a srcdoc frame
      // reloads in well under that); the tag must survive the whole time too.
      await expectSteady(async () => ({ tagged: await tagged(), loads: await loads(page) }), { tagged: true, loads: before }, {
        ms: 1_000,
        message: 'the iframe keeps its document (no reload)',
      });
    } else {
      await expect.poll(() => loads(page)).toBeGreaterThan(before);
      expect(await tagged()).toBe(false);
    }
  });

  test('RP11 removing an id from the registry closes its PiP window, and after gcGraceMs its shuttle is gone @docpip @ext-persist', async ({ page }, testInfo) => {
    needs(testInfo, 'docPip');
    await home(page, 'gcGraceMs=300');
    const pip = await openPip(page, page.getByRole('button', { name: '↗ Pop out' }));
    const closed = pip.waitForEvent('close');

    await page.getByRole('button', { name: 'Remove tracker from registry' }).click();

    await closed;
    await expect(shuttle(page, 'tracker')).toHaveCount(0, { timeout: 5_000 });
  });

  // Decided 2026-09-28 (flows/route-persistent.md Corrections): removing a key means the widget is
  // gone, so re-adding it mounts a FRESH widget; the lease only protects a same-commit rebuild.
  test('RP12 an id removed and re-added (separate renders) comes back as a fresh widget in its anchor @ext-persist', async ({ page }) => {
    await home(page, 'gcGraceMs=5000');
    await expect.poll(() => seconds(page)).toBeGreaterThanOrEqual(3);
    const before = await seconds(page);

    await page.getByRole('button', { name: 'Remove tracker from registry' }).click();
    await expect(page.getByRole('button', { name: 'Restore tracker to registry' })).toBeVisible();
    await page.getByRole('button', { name: 'Restore tracker to registry' }).click();

    await expect(tracker(page).getByText('Placement: anchor')).toBeVisible();
    expect(await nodeWhereabouts(page, 'tracker')).toBe('missing');
    expect(await seconds(page)).toBeLessThan(before);
  });

  test('RP13 an anchor whose id is not in the registry throws ERR_UNKNOWN_ID in development @ext-persist', async ({ page, watchdog }) => {
    watchdog.allow(/ERR_UNKNOWN_ID/);
    watchdog.allow(/The above error occurred|React will try to recreate|error boundary/i);
    await page.goto('/#/persist/home?unknownAnchor=1');

    await expect(page.getByRole('alert')).toContainText('[pip-it-up] ERR_UNKNOWN_ID');
  });

  test('RP16 useAdaptiveInterval slows down in the background (15 s period): the count stops while hidden and resumes when visible @ext-persist', async ({ page }) => {
    await home(page);
    await expect.poll(() => seconds(page)).toBeGreaterThanOrEqual(1);

    await simulateTabSwitch(page, 'hidden');
    await expect(tracker(page).getByText('Level: background')).toBeAttached();
    const hiddenAt = await seconds(page);
    // Two active periods (2 × 1 s) pass; the background period (15 s) doesn't.
    await page.evaluate(() => new Promise((r) => setTimeout(r, 2_500)));
    expect(await seconds(page)).toBe(hiddenAt);

    await restoreVisibility(page);
    await expect.poll(() => seconds(page)).toBeGreaterThan(hiddenAt);
  });

  test('RP17 useRevealEffect runs again each time the widget comes back out of the garage @ext-persist', async ({ page }) => {
    await home(page);
    const reveals = async () => Number((await tracker(page).getByText(/^Reveals: \d+$/).textContent())?.split(': ')[1]);
    const before = await reveals();

    await go(page, 'Away');
    await go(page, 'Home');
    await expect.poll(reveals).toBe(before + 1);

    // "Each time": a second round trip runs it again.
    await go(page, 'Away');
    await go(page, 'Home');
    await expect.poll(reveals).toBe(before + 2);
  });

  test('RP18 useActiveEffect runs only while active: cleaned up in the background, running again when visible @ext-persist', async ({ page }) => {
    await home(page);
    await expect(tracker(page).getByText('Active effect: running')).toBeVisible();

    await simulateTabSwitch(page, 'hidden');
    await expect(tracker(page).getByText('Active effect: stopped')).toBeAttached();
    await restoreVisibility(page);

    await expect(tracker(page).getByText('Active effect: running')).toBeVisible();
  });
});
