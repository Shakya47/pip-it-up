/**
 * flows/sizing.md (SZ): the size core requests (auto-size from the content box, clamped to
 * 300–1600 × 200–1200; explicit width/height), fixedSize, reserveSpace, centerInPip, pipBodyStyles.
 * What the library ASKS for is asserted exactly (lib/pip.ts recordPipRequests); what the window
 * manager grants is checked loosely, since Chrome trims a few px.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../../lib/fixtures';
import { needs } from '../../lib/capabilities';
import { openPip, closePipLikeOS, documentTop, recordPipRequests, pipRequests } from '../../lib/pip';
import { contract, innerSize, NAMES, routeFor } from '../../lib/contract';

const lastRequest = async (page: Page) => (await pipRequests(page)).at(-1);
const bodyStyle = (pip: Page) =>
  pip.evaluate(() => {
    const s = getComputedStyle(document.body);
    return { display: s.display, alignItems: s.alignItems, justifyContent: s.justifyContent, margin: s.margin, overflow: s.overflow };
  });

test.describe('sizing', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    needs(testInfo, 'docPip');
    await recordPipRequests(page);
  });

  test('SZ1 with no width/height the window is sized to the content box @docpip', async ({ page }) => {
    // Kept small: headless Chrome caps PiP windows to a fraction of its (small) virtual screen.
    await page.goto(routeFor('basic', { contentWidth: 380, contentHeight: 280 }));
    const pip = await openPip(page, contract(page).open);

    expect(await lastRequest(page)).toMatchObject({ width: 380, height: 280 });
    const granted = await innerSize(pip);
    expect(Math.abs(granted.width - 380)).toBeLessThanOrEqual(24);
    expect(Math.abs(granted.height - 280)).toBeLessThanOrEqual(24);
  });

  test('SZ2 a tiny content box is clamped up to 300×200 @docpip', async ({ page }) => {
    await page.goto(routeFor('basic', { contentWidth: 120, contentHeight: 80 }));
    await openPip(page, contract(page).open);

    expect(await lastRequest(page)).toMatchObject({ width: 300, height: 200 });
  });

  test('SZ3 a huge content box is clamped down to 1600×1200 @docpip', async ({ page }) => {
    await page.goto(routeFor('basic', { contentWidth: 2400, contentHeight: 1800 }));
    await openPip(page, contract(page).open);

    expect(await lastRequest(page)).toMatchObject({ width: 1600, height: 1200 });
  });

  test('SZ4 explicit width/height are requested as given, and granted (±24 px) @docpip', async ({ page }) => {
    await page.goto(routeFor('basic', { width: 420, height: 320 }));
    const pip = await openPip(page, contract(page).open);

    expect(await lastRequest(page)).toMatchObject({ width: 420, height: 320 });
    const granted = await innerSize(pip);
    expect(Math.abs(granted.width - 420)).toBeLessThanOrEqual(24);
    expect(Math.abs(granted.height - 320)).toBeLessThanOrEqual(24);
  });

  // Decided 2026-09-28 (flows/sizing.md Corrections): fixedSize locks the document; it doesn't
  // resize the window back (browsers block resizeTo() without a user gesture).
  test('SZ5 fixedSize locks html/body to the size, and the lock holds when the window is resized @docpip', async ({ page }) => {
    await page.goto(routeFor('basic', { width: 420, height: 320, fixedSize: true }));
    const pip = await openPip(page, contract(page).open);
    const lock = () =>
      pip.evaluate(() => ({
        html: [document.documentElement.style.width, document.documentElement.style.height, document.documentElement.style.overflow],
        body: [document.body.style.width, document.body.style.height, document.body.style.overflow],
      }));
    const locked = { html: ['420px', '320px', 'hidden'], body: ['420px', '320px', 'hidden'] };
    expect(await lock()).toEqual(locked);

    const widthBefore = await pip.evaluate(() => innerWidth);
    // The evaluate grants the user activation Chrome requires for resizeTo() in a PiP window.
    await pip.evaluate(() => resizeTo(640, 520));
    // The lock is only tested if the window really got bigger. Where the window manager ignores
    // resizeTo() (seen on Firefox, flows/sizing.md Notes) there is nothing to hold against: skip,
    // with the reason, rather than pass on an unchanged window.
    const resized = await expect
      .poll(() => pip.evaluate(() => innerWidth), { timeout: 3_000 })
      .toBeGreaterThan(widthBefore + 50)
      .then(() => true, () => false);
    test.skip(!resized, `resizeTo() left the PiP window at ${widthBefore}px wide here, so the lock can't be checked against a resize`);

    expect(await lock()).toEqual(locked);
    expect(await pip.evaluate(() => Math.round(document.body.getBoundingClientRect().width))).toBe(420);
  });

  test('SZ6 reserveSpace (default): the content below stays put on open and after close @smoke @docpip', async ({ page }) => {
    await page.goto(routeFor('basic'));
    const c = contract(page);
    const top = await documentTop(c.below);

    const pip = await openPip(page, c.open);
    expect(await documentTop(c.below)).toBeCloseTo(top, 0);
    await closePipLikeOS(pip);

    await expect(c.status).toHaveText(NAMES.status.closed);
    await expect.poll(() => documentTop(c.below)).toBeCloseTo(top, 0);
  });

  test('SZ7 reserveSpace=false: the page is allowed to collapse, so the content below moves up @docpip', async ({ page }) => {
    await page.goto(routeFor('basic', { reserveSpace: false }));
    const c = contract(page);
    const top = await documentTop(c.below);

    await openPip(page, c.open);

    await expect.poll(() => documentTop(c.below)).toBeLessThan(top - 50);
  });

  test('SZ8 centerInPip centers the content with a flex body @docpip', async ({ page }) => {
    await page.goto(routeFor('basic', { centerInPip: true }));
    const pip = await openPip(page, contract(page).open);

    expect(await bodyStyle(pip)).toMatchObject({ display: 'flex', alignItems: 'center', justifyContent: 'center' });
  });

  test('SZ9 the default PiP body styles reset the margin to 0 @docpip', async ({ page }) => {
    await page.goto(routeFor('basic'));
    const pip = await openPip(page, contract(page).open);

    expect((await bodyStyle(pip)).margin).toBe('0px');
  });

  test('SZ11 pipBodyStyles=false leaves the PiP body with the browser default margin @docpip', async ({ page }) => {
    await page.goto(routeFor('basic', { pipBodyStyles: false }));
    const pip = await openPip(page, contract(page).open);

    expect((await bodyStyle(pip)).margin).toBe('8px');
  });

  test('SZ10 disallowReturnToOpener is passed through to requestWindow @docpip', async ({ page }) => {
    await page.goto(routeFor('basic', { disallowReturnToOpener: true }));
    await openPip(page, contract(page).open);

    expect(await lastRequest(page)).toMatchObject({ disallowReturnToOpener: true });
  });
});
