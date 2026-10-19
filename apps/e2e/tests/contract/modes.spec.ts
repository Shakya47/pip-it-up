/**
 * flows/modes.md (MO): core's DOM modes. `move` / `clone` / `portal` are core options, so these
 * rows run on the vanilla target; bindings always use `portal` and move the DOM themselves
 * (their node identity is LC1/LC2; the React clone guard is react.md RX10).
 */
import { test, expect, onlyTargets } from '../../lib/fixtures';
import { needs } from '../../lib/capabilities';
import { openPip, closePipLikeOS, markNode, expectNodeIn } from '../../lib/pip';
import { contract, NAMES, routeFor } from '../../lib/contract';

test.describe('modes', () => {
  test.beforeEach(async ({}, testInfo) => {
    needs(testInfo, 'docPip');
    onlyTargets(testInfo, 'vanilla');
  });

  test('MO1 mode=move (default): the same node goes to PiP and back; the origin keeps its box while it is away @docpip', async ({ page }) => {
    await page.goto(routeFor('basic', { mode: 'move' }));
    const c = contract(page);
    await markNode(c.content, 'content');
    const origin = page.locator('[data-origin="A"]');
    const before = await origin.boundingBox();

    const pip = await openPip(page, c.open);

    await expectNodeIn(page, 'content', 'pip');
    expect(await c.content.count()).toBe(0);
    const reserved = await origin.boundingBox();
    expect(reserved?.height).toBeCloseTo(before!.height, 0);
    await closePipLikeOS(pip);
    await expectNodeIn(page, 'content', 'opener');
  });

  test('MO2 mode=clone: PiP shows a copy, the original stays in the page, and the copy is inert; closing removes it @docpip', async ({ page }) => {
    await page.goto(routeFor('basic', { mode: 'clone' }));
    const c = contract(page);
    await markNode(c.content, 'content');

    const pip = await openPip(page, c.open);

    await expectNodeIn(page, 'content', 'opener');
    await expect(c.content).toBeVisible();
    const copy = c.contentIn(pip);
    await expect(copy.getByRole('heading', { name: NAMES.heading })).toBeVisible();
    // cloneNode(true) copies markup, not addEventListener listeners (documented in dom-modes.ts).
    await copy.getByRole('button', { name: NAMES.increment }).click();
    await expect(copy.getByText(NAMES.count(0), { exact: true })).toBeVisible();
    await expect(c.content.getByText(NAMES.count(0), { exact: true })).toBeVisible();

    // Keep a handle on the copy (from the opener), to prove teardown removed it from the PiP document.
    await page.evaluate(() => {
      const w = window as unknown as { documentPictureInPicture: { window: Window }; __e2eCopy?: Element | null };
      w.__e2eCopy = w.documentPictureInPicture.window.document.querySelector('[data-e2e-node="content"]');
    });
    expect(await page.evaluate(() => (window as unknown as { __e2eCopy?: Element | null }).__e2eCopy?.isConnected)).toBe(true);

    await c.close.click();
    await expect(c.status).toHaveText(NAMES.status.closed);
    await expect(c.content).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __e2eCopy?: Element | null }).__e2eCopy?.isConnected), { message: 'the copy is removed' }).toBe(false);
    await expect(page.locator('[data-e2e-node="content"]')).toHaveCount(1);
    await expectNodeIn(page, 'content', 'opener');
  });

  test('MO3 mode=portal: core opens the window but leaves the DOM alone (a binding renders into it) @docpip', async ({ page }) => {
    await page.goto(routeFor('basic', { mode: 'portal' }));
    const c = contract(page);
    await markNode(c.content, 'content');

    const pip = await openPip(page, c.open);

    await expect(c.status).toHaveText(NAMES.status.open);
    await expectNodeIn(page, 'content', 'opener');
    await expect(c.contentIn(pip)).toHaveCount(0);
  });
});
