/**
 * flows/lifecycle.md (LC): open, close, callbacks, the isOpening lock, one window per tab,
 * activation, destroy. Runs on every contract target.
 */
import { test, expect, onlyTargets } from '../../lib/fixtures';
import { needs } from '../../lib/capabilities';
import { openPip, closePipLikeOS, clickClosingPip, markNode, expectNodeIn, expectSteady } from '../../lib/pip';
import { quietWait, QUIET_TRIGGER_MS } from '../../lib/activation';
import { contract, expectLifecycle, expectLog, expectLogged, innerSize, logEntries, LOG, NAMES, routeFor } from '../../lib/contract';

test.describe('lifecycle', () => {
  test.beforeEach(async ({}, testInfo) => needs(testInfo, 'docPip'));

  test('LC1 "Open PiP" opens a window holding the same content node; callbacks run open → ready @smoke @docpip', async ({ page }) => {
    await page.goto(routeFor('basic'));
    const c = contract(page);
    await markNode(c.content, 'content');

    const pip = await openPip(page, c.open);

    await expectNodeIn(page, 'content', 'pip');
    await expect(c.contentIn(pip).getByRole('heading', { name: NAMES.heading })).toBeVisible();
    await expect(c.status).toHaveText(NAMES.status.open);
    await expect(c.close).toBeVisible();
    await expectLog(page, [LOG.open, LOG.ready]);
  });

  test('LC2 "Close PiP" in the opener closes the window and returns the same node @smoke @docpip', async ({ page }) => {
    await page.goto(routeFor('basic'));
    const c = contract(page);
    await markNode(c.content, 'content');
    const pip = await openPip(page, c.open);
    const closed = pip.waitForEvent('close');

    await c.close.click();

    await closed;
    await expectNodeIn(page, 'content', 'opener');
    await expect(c.status).toHaveText(NAMES.status.closed);
    await expect(c.open).toBeVisible();
    await expectLog(page, [LOG.open, LOG.ready, LOG.close]);
  });

  test('LC3 "Close from inside" (instance.close() from the PiP window) closes it the same way @docpip', async ({ page }) => {
    await page.goto(routeFor('basic'));
    const c = contract(page);
    await markNode(c.content, 'content');
    const pip = await openPip(page, c.open);

    await clickClosingPip(pip, c.contentIn(pip).getByRole('button', { name: NAMES.closeInside }));

    await expectNodeIn(page, 'content', 'opener');
    await expect(c.status).toHaveText(NAMES.status.closed);
    await expectLifecycle(page, [LOG.open, LOG.ready, LOG.close]);
  });

  test('LC4 closing the window from the OS (pagehide) returns the same node and fires onClose @smoke @docpip', async ({ page }) => {
    await page.goto(routeFor('basic'));
    const c = contract(page);
    await markNode(c.content, 'content');
    const pip = await openPip(page, c.open);

    await closePipLikeOS(pip);

    await expectNodeIn(page, 'content', 'opener');
    await expect(c.status).toHaveText(NAMES.status.closed);
    await expectLog(page, [LOG.open, LOG.ready, LOG.close]);
  });

  test('LC5 two clicks in the same task open exactly one window (isOpening lock) @docpip', async ({ page, context }) => {
    await page.goto(routeFor('basic'));
    const c = contract(page);
    const pages: string[] = [];
    context.on('page', (p) => pages.push(p.url()));

    // Both clicks land before requestWindow() can resolve, so the second hits the lock. (A real
    // double click is two tasks: Firefox resolves the first open in between, and the second
    // click then toggles the window closed, which is correct.)
    await c.open.evaluate((b: HTMLButtonElement) => {
      b.click();
      b.click();
    });

    await expect(c.status).toHaveText(NAMES.status.open);
    await expect.poll(() => logEntries(page)).toEqual([LOG.open, LOG.ready]);
    // The poll stops at the first match; a second open (or a toggle-close) would land after it.
    // Hold for 1 s, longer than a PiP window takes to open.
    await expectSteady(async () => ({ log: await logEntries(page), pages: pages.length }), { log: [LOG.open, LOG.ready], pages: 1 }, {
      ms: 1_000,
      message: 'exactly one window, opened once',
    });
    await expect(c.status).toHaveText(NAMES.status.open);
  });

  test('LC6 a second open gets the same window size as the first (MAINTENANCE §8) @docpip', async ({ page }) => {
    await page.goto(routeFor('basic', { contentWidth: 420, contentHeight: 300 }));
    const c = contract(page);
    const first = await openPip(page, c.open);
    const firstSize = await innerSize(first);
    await closePipLikeOS(first);
    await expect(c.status).toHaveText(NAMES.status.closed);

    const second = await openPip(page, c.open);

    expect(await innerSize(second)).toEqual(firstSize);
  });

  test('LC7 component state survives the round trip: count set before, changed inside, kept after (V11) @smoke @docpip', async ({ page }) => {
    await page.goto(routeFor('basic'));
    const c = contract(page);
    await c.content.getByRole('button', { name: NAMES.increment }).click();
    await c.content.getByRole('button', { name: NAMES.increment }).click();
    const pip = await openPip(page, c.open);
    const inPip = c.contentIn(pip);
    await expect(inPip.getByText(NAMES.count(2), { exact: true })).toBeVisible();

    await inPip.getByRole('button', { name: NAMES.increment }).click();
    await expect(inPip.getByText(NAMES.count(3), { exact: true })).toBeVisible();
    await closePipLikeOS(pip);

    await expect(c.content.getByText(NAMES.count(3), { exact: true })).toBeVisible();
  });

  test('LC8 opening a second instance replaces the first window: the first closes and gets its content back @docpip', async ({ page }) => {
    await page.goto(routeFor('two-instances'));
    const a = contract(page, 'A');
    const b = contract(page, 'B');
    await markNode(a.content, 'a');
    const pipA = await openPip(page, a.open);
    const closedA = pipA.waitForEvent('close');

    const pipB = await openPip(page, b.open);

    await closedA;
    await expect(a.status).toHaveText(NAMES.status.closed);
    await expect(b.status).toHaveText(NAMES.status.open);
    await expectNodeIn(page, 'a', 'opener');
    await expect(b.contentIn(pipB).getByRole('heading', { name: NAMES.heading })).toBeVisible();
    await expectLogged(page, LOG.close);
    await expectLogged(page, LOG.b(LOG.open));
  });

  test('LC9 onBeforeOpen returning false cancels the open @docpip', async ({ page, context }) => {
    await page.goto(routeFor('basic', { beforeOpen: 'deny' }));
    const c = contract(page);
    let windows = 0;
    context.on('page', () => windows++);

    await c.open.click();

    await expectLog(page, [LOG.beforeOpen]);
    await expect(c.status).toHaveText(NAMES.status.closed);
    expect(windows).toBe(0);
  });

  test('LC10 onBeforeOpen returning true opens as usual, after it ran @docpip', async ({ page }) => {
    await page.goto(routeFor('basic', { beforeOpen: 'allow' }));
    const c = contract(page);

    await openPip(page, c.open);

    await expectLog(page, [LOG.beforeOpen, LOG.open, LOG.ready]);
  });

  test('LC11 an open with no user activation is refused gracefully: onError gets NotAllowedError, nothing opens @docpip @slow', async ({ page, context }) => {
    await page.goto(routeFor('basic'));
    const c = contract(page);
    let windows = 0;
    context.on('page', () => windows++);

    await page.evaluate((delay) => {
      setTimeout(() => void (window as unknown as { __contract: { toggle(): unknown } }).__contract.toggle(), delay);
    }, QUIET_TRIGGER_MS);
    await quietWait(QUIET_TRIGGER_MS + 1_000);

    await expectLog(page, [LOG.error('NotAllowedError')]);
    await expect(c.status).toHaveText(NAMES.status.closed);
    expect(windows).toBe(0);
  });

  test('LC12 after destroy(), open() is inert and warns ERR_DESTROYED @docpip', async ({ page, context, watchdog }, testInfo) => {
    onlyTargets(testInfo, 'vanilla');
    watchdog.allow(/\[pip-it-up\] ERR_DESTROYED: open\(\) called on a destroyed instance/);
    const warnings: string[] = [];
    page.on('console', (m) => m.type() === 'warning' && warnings.push(m.text()));
    await page.goto(routeFor('basic'));
    const c = contract(page);
    let windows = 0;
    context.on('page', () => windows++);
    await page.evaluate(() => (window as unknown as { __contract: { destroy(): void } }).__contract.destroy());

    await c.open.click();

    await expect.poll(() => warnings.some((w) => w.includes('ERR_DESTROYED'))).toBe(true);
    await expect(c.status).toHaveText(NAMES.status.closed);
    expect(windows).toBe(0);
    expect(await logEntries(page)).toEqual([]);
  });

  test('LC13 inside an iframe (the playground\'s IframeGuard case) open() is refused: onError gets the error and no window opens @docpip', async ({ page, context }) => {
    await page.goto(routeFor('basic'));
    const src = page.url();
    let windows = 0;
    context.on('page', () => windows++);
    // Same-origin host page with the target in an iframe; Document PiP needs a top-level context.
    await page.setContent(`<iframe title="embedded target" src="${src}" width="900" height="700"></iframe>`);
    const frame = page.frameLocator('iframe[title="embedded target"]');
    await expect(frame.getByRole('button', { name: NAMES.open, exact: true })).toBeVisible();

    await frame.getByRole('button', { name: NAMES.open, exact: true }).click();

    await expect(frame.getByRole('log', { name: NAMES.log }).getByRole('listitem').first()).toHaveText(/^error:/);
    await expect(frame.getByRole('status').first()).toHaveText(NAMES.status.closed);
    expect(windows).toBe(0);
  });
});
