/**
 * flows/react.md (RX): @pip-it-up/react specifics on the react target (React 19, StrictMode):
 * controlled mode, <PipTrigger> (labels, hideInPip, pipId, asChild, orphan id, renderUnsupported),
 * isInsidePip, Strict Mode survival, and the clone-mode guard.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../../lib/fixtures';
import { needs, needsMissing } from '../../lib/capabilities';
import { openPip, closePipLikeOS, markNode, expectNodeIn } from '../../lib/pip';
import { contract, logEntries, LOG, NAMES, routeFor } from '../../lib/contract';

const openChanges = async (page: Page) => (await logEntries(page)).filter((e) => e.startsWith('open-change:'));

test.describe('controlled mode', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    needs(testInfo, 'docPip');
    await page.goto('/#/react-controlled');
  });

  test('RX1 open={true} from a checkbox opens the window; onOpenChange(true) @docpip', async ({ page }) => {
    const [pip] = await Promise.all([page.waitForEvent('popup'), page.getByRole('checkbox', { name: 'Open (controlled)' }).check()]);

    await expect(pip.getByRole('heading', { name: 'Controlled content' })).toBeVisible();
    await expect.poll(() => openChanges(page)).toEqual(['open-change:true']);
  });

  test('RX2 closing the window from the OS reports onOpenChange(false), so the parent state follows @docpip', async ({ page }) => {
    const box = page.getByRole('checkbox', { name: 'Open (controlled)' });
    const [pip] = await Promise.all([page.waitForEvent('popup'), box.check()]);

    await closePipLikeOS(pip);

    await expect(box).not.toBeChecked();
    await expect.poll(() => openChanges(page)).toEqual(['open-change:true', 'open-change:false']);
  });

  test('RX3 open={false} closes the window @docpip', async ({ page }) => {
    const box = page.getByRole('checkbox', { name: 'Open (controlled)' });
    const [pip] = await Promise.all([page.waitForEvent('popup'), box.check()]);
    const closed = pip.waitForEvent('close');

    await box.uncheck();

    await closed;
    await expect(page.getByRole('heading', { name: 'Controlled content' })).toBeVisible();
  });
});

test.describe('PipTrigger', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/react-trigger');
  });

  test('RX4 the colocated trigger reads "↗ Pop out", opens its wrapper, and is hidden inside PiP (hideInPip) @docpip', async ({ page }, testInfo) => {
    needs(testInfo, 'docPip');
    const region = page.getByRole('region', { name: 'Trigger content' });
    const pip = await openPip(page, region.getByRole('button', { name: '↗ Pop out' }));

    const inPip = pip.getByRole('region', { name: 'Trigger content' });
    await expect(inPip.getByRole('heading', { name: 'Trigger content' })).toBeVisible();
    await expect(inPip.getByRole('button')).toHaveCount(0);
  });

  test('RX5 a decoupled trigger (pipId) opens and closes a wrapper elsewhere, flipping its label and aria-pressed @docpip', async ({ page }, testInfo) => {
    needs(testInfo, 'docPip');
    const pip = await openPip(page, page.getByRole('button', { name: 'Open remotely' }));
    const remote = page.getByRole('button', { name: 'Close remotely' });
    await expect(remote).toHaveAttribute('aria-pressed', 'true');
    const closed = pip.waitForEvent('close');

    await remote.click();

    await closed;
    await expect(page.getByRole('button', { name: 'Open remotely' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('RX6 asChild puts the trigger behaviour on the child link @docpip', async ({ page }, testInfo) => {
    needs(testInfo, 'docPip');
    const link = page.getByRole('link', { name: 'Custom link trigger' });

    const pip = await openPip(page, link);

    await expect(pip.getByRole('heading', { name: 'Trigger content' })).toBeVisible();
    await expect(link).toHaveAttribute('aria-pressed', 'true');
  });

  test('RX7 a trigger whose pipId nobody registered renders disabled @any', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Orphan trigger' })).toBeDisabled();
  });

  test('RX8 without Document PiP, a trigger with renderUnsupported shows it instead of a button that does nothing @nopip', async ({ page }, testInfo) => {
    needsMissing(testInfo, 'docPip');
    const region = page.getByRole('region', { name: 'Unsupported content' });

    await expect(region.getByText('PiP unavailable')).toBeVisible();
    await expect(region.getByRole('button', { name: 'Open unsupported demo' })).toHaveCount(0);
  });
});

test.describe('context and Strict Mode', () => {
  test.beforeEach(async ({}, testInfo) => needs(testInfo, 'docPip'));

  test('RX9 isInsidePip is false in the page and true once the subtree renders in PiP @docpip', async ({ page }) => {
    await page.goto(routeFor('basic'));
    const c = contract(page);
    await expect(c.content.getByText(NAMES.insidePip(false))).toBeVisible();

    const pip = await openPip(page, c.open);

    await expect(c.contentIn(pip).getByText(NAMES.insidePip(true))).toBeVisible();
  });

  test('RX10 under StrictMode, open() reaches requestWindow with no ERR_DESTROYED; close and reopen work (MAINTENANCE §2) @smoke @docpip', async ({ page }) => {
    // The watchdog fails the test on any [pip-it-up] warning, ERR_DESTROYED included.
    await page.goto(routeFor('basic'));
    const c = contract(page);
    const first = await openPip(page, c.open);
    await closePipLikeOS(first);
    await expect(c.status).toHaveText(NAMES.status.closed);

    const second = await openPip(page, c.open);

    await expect(c.contentIn(second).getByRole('heading', { name: NAMES.heading })).toBeVisible();
    expect((await logEntries(page)).filter((e) => e === LOG.open)).toHaveLength(2);
  });

  test('RX11 mode="clone" on <PipWrapper> warns and falls back to portal mode, moving the same node (MAINTENANCE §3) @docpip', async ({ page, watchdog }) => {
    watchdog.allow(/clone/i);
    const warnings: string[] = [];
    page.on('console', (m) => m.type() === 'warning' && warnings.push(m.text()));
    await page.goto('/#/react-clone-mode');
    const region = page.getByRole('region', { name: 'Clone mode content' });
    await markNode(region, 'clone-region');

    await openPip(page, region.getByRole('button', { name: '↗ Pop out' }));

    await expectNodeIn(page, 'clone-region', 'pip');
    expect(warnings.some((w) => /clone/i.test(w))).toBe(true);
  });

  test('RX12 the default placeholder\'s "Restore" button closes the window and brings the content back @docpip', async ({ page }) => {
    await page.goto('/#/react-trigger');
    const region = page.getByRole('region', { name: 'Trigger content' });
    await markNode(region, 'trigger-region');
    const pip = await openPip(page, region.getByRole('button', { name: '↗ Pop out' }));
    const closed = pip.waitForEvent('close');

    await page.getByRole('button', { name: 'Restore content from Picture-in-Picture' }).first().click();

    await closed;
    await expectNodeIn(page, 'trigger-region', 'opener');
  });

  test('RX13 usePip(): refs + open()/close() move the same node into PiP and back, with its state; page-driven renders reach it there @docpip', async ({ page }) => {
    await page.goto('/#/react-usepip');
    const region = page.getByRole('region', { name: 'usePip content' });
    await region.getByRole('button', { name: 'Count: 0' }).click();
    await markNode(region, 'usepip-region');

    const pip = await openPip(page, page.getByRole('button', { name: 'Open with usePip' }));

    await expectNodeIn(page, 'usepip-region', 'pip');
    await expect(page.getByRole('status')).toHaveText('usePip: open');
    await page.getByRole('button', { name: '+1 from page' }).click();
    await expect(pip.getByRole('button', { name: 'Count: 2' })).toBeVisible();
    const closed = pip.waitForEvent('close');
    await page.getByRole('button', { name: 'Close with usePip' }).click();
    await closed;
    await expectNodeIn(page, 'usepip-region', 'opener');
    await expect(page.getByRole('status')).toHaveText('usePip: closed');
    await expect(region.getByRole('button', { name: 'Count: 2' })).toBeVisible();
  });

  test('RX14 usePip(): React handlers keep working inside PiP (moved node, bridged events): onClick, controlled onChange, preventDefault, onAnimationEnd @docpip', async ({ page }) => {
    await page.goto('/#/react-usepip');
    const pip = await openPip(page, page.getByRole('button', { name: 'Open with usePip' }));
    const inPip = pip.getByRole('region', { name: 'usePip content' });

    await inPip.getByRole('button', { name: 'Count: 0' }).click();
    await inPip.getByRole('textbox', { name: 'Controlled' }).pressSequentially('abc');
    await inPip.getByRole('link', { name: 'Prevented link' }).click();
    await inPip.getByRole('heading', { name: 'usePip content' }).evaluate((h) => {
      const w = h.ownerDocument.defaultView as Window & typeof globalThis;
      h.dispatchEvent(new w.AnimationEvent('animationend', { bubbles: true, animationName: 'x' }));
    });

    await expect(inPip.getByRole('button', { name: 'Count: 1' })).toBeVisible();
    await expect(inPip.getByRole('textbox', { name: 'Controlled' })).toHaveValue('ABC');
    await expect.poll(() => logEntries(page)).toContain('link-click');
    expect(await pip.evaluate(() => location.hash)).toBe('');
    await expect.poll(() => logEntries(page)).toContain('animation-end');
    // One handler run per click: the bridge doesn't double-fire.
    expect((await logEntries(page)).filter((e) => e === 'link-click')).toHaveLength(1);
  });
});
