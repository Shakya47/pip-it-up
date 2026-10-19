/**
 * MANUAL_SMOKE part B, automated: the route-persistent page `#/dashboard` (PipProvider +
 * PipAnchor, the `tracker` and `video` registry entries). Titles carry flows/playground.md ids.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../../lib/fixtures';
import { needs } from '../../lib/capabilities';
import { openPip, closePipLikeOS, markNode, expectNodeIn, documentTop } from '../../lib/pip';
import { trackerSeconds } from './helpers';

const BELOW = 'Content below the anchors. It stays put when a widget pops out.';

const routes = (page: Page) => page.getByRole('navigation', { name: 'Routes' });
const go = async (page: Page, route: 'Dashboard' | 'Reports' | 'Settings') => {
  await routes(page).getByRole('button', { name: route }).click();
  await expect(page.getByRole('heading', { level: 2, name: route })).toBeVisible();
};
/** The Live Tracker card: the innermost element holding both its heading and its MM:SS readout. */
const tracker = (scope: Page) =>
  scope
    .locator('div')
    .filter({ has: scope.getByRole('heading', { name: 'Live Tracker' }) })
    .filter({ has: scope.getByText(/^\d{2}:\d{2}$/) })
    .last();

test.describe('B. Route-persistent page', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    needs(testInfo, 'docPip');
    await page.goto('/#/dashboard');
    await expect(page.getByRole('heading', { level: 1, name: 'Route-Persistent PiP' })).toBeVisible();
    await expect(tracker(page).getByText('anchor', { exact: true })).toBeVisible();
    await markNode(tracker(page).getByText(/^\d{2}:\d{2}$/), 'timer');
  });

  test('PG13 the tracker keeps floating and counting in PiP after navigating to Reports @smoke @docpip', async ({ page }) => {
    const pip = await openPip(page, page.getByRole('button', { name: '↗ Pop out' }));
    await expectNodeIn(page, 'timer', 'pip');
    await expect(pip.getByText('pip', { exact: true })).toBeVisible();
    await expect(pip.getByText('active', { exact: true })).toBeVisible();

    await go(page, 'Reports');
    const before = await trackerSeconds(pip);

    expect(pip.isClosed()).toBe(false);
    await expect.poll(() => trackerSeconds(pip), { timeout: 5_000 }).toBeGreaterThan(before);
    await expect(pip.getByText('pip', { exact: true })).toBeVisible();
    await expect(pip.getByText('active', { exact: true })).toBeVisible();
    await expectNodeIn(page, 'timer', 'pip');
  });

  test('PG14 back on Dashboard the tracker re-docks with its time and nothing below jumps @smoke @docpip', async ({ page }) => {
    const below = page.getByText(BELOW);
    const docked = await documentTop(below);

    const pip = await openPip(page, page.getByRole('button', { name: '↗ Pop out' }));
    expect(await documentTop(below)).toBeCloseTo(docked, 0);
    await go(page, 'Reports');
    await go(page, 'Dashboard');
    // While the window still floats, the anchor holds its place with a placeholder.
    await expect(page.getByText('📺 Tracker is in PiP')).toBeVisible();
    expect(await documentTop(below)).toBeCloseTo(docked, 0);
    await expect.poll(() => trackerSeconds(pip)).toBeGreaterThanOrEqual(2);
    const inPip = await trackerSeconds(pip);

    await closePipLikeOS(pip);

    await expectNodeIn(page, 'timer', 'opener');
    await expect(tracker(page).getByText('anchor', { exact: true })).toBeVisible();
    expect(await trackerSeconds(page)).toBeGreaterThanOrEqual(inPip);
    await expect.poll(() => documentTop(below)).toBeCloseTo(docked, 0);
  });

  test('PG15 closing PiP while on another route re-docks the tracker on return, no button press @smoke @docpip', async ({ page }) => {
    const pip = await openPip(page, page.getByRole('button', { name: '↗ Pop out' }));
    await go(page, 'Reports');
    await expect.poll(() => trackerSeconds(pip)).toBeGreaterThanOrEqual(1);
    const inPip = await trackerSeconds(pip);

    await closePipLikeOS(pip);
    await go(page, 'Dashboard');

    await expectNodeIn(page, 'timer', 'opener');
    await expect(tracker(page).getByText('anchor', { exact: true })).toBeVisible();
    expect(await trackerSeconds(page)).toBeGreaterThanOrEqual(inPip);
    await expect(page.getByText('📺 Tracker is in PiP')).toHaveCount(0);
  });
});
