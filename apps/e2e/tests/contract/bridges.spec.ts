/**
 * flows/bridges.md (BR): keyboard and pointer events from the PiP window are re-dispatched on the
 * opener, only when trusted (SEC-202, SEC-203), with the `pipItUpBridged` marker on pointer events.
 * The targets log what the opener RECEIVED: `key:<type>:<key>` for untrusted (forwarded) key
 * events on window, `pointer:<type>` for events carrying the marker (contract LOG).
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../../lib/fixtures';
import { needs } from '../../lib/capabilities';
import { openPip } from '../../lib/pip';
import { contract, logEntries, expectLogged, LOG, NAMES, routeFor } from '../../lib/contract';

const bridged = async (page: Page, prefix: 'key:' | 'pointer:') => (await logEntries(page)).filter((e) => e.startsWith(prefix));

/** Let any (wrongly) forwarded event land: a round trip through both windows' event loops. */
const settle = async (page: Page, pip: Page) => {
  await pip.evaluate(() => new Promise((r) => setTimeout(r, 0)));
  await page.evaluate(() => new Promise((r) => setTimeout(r, 0)));
};

test.describe('bridges', () => {
  test.beforeEach(async ({}, testInfo) => needs(testInfo, 'docPip'));

  test('BR1 a real keystroke in PiP reaches the opener window as keydown + keyup @smoke @docpip', async ({ page }) => {
    await page.goto(routeFor('basic'));
    const c = contract(page);
    const pip = await openPip(page, c.open);

    await c.contentIn(pip).getByRole('textbox', { name: NAMES.notes }).press('KeyQ');

    await expectLogged(page, LOG.key('keydown', 'q'));
    await expectLogged(page, LOG.key('keyup', 'q'));
  });

  test('BR2 a synthetic KeyboardEvent dispatched inside PiP is NOT forwarded (isTrusted filter) @docpip', async ({ page }) => {
    await page.goto(routeFor('basic'));
    const c = contract(page);
    const pip = await openPip(page, c.open);

    await pip.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true }));
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true }));
    });
    await settle(page, pip);

    expect(await bridged(page, 'key:')).toEqual([]);
  });

  test('BR3 forwardKeyboardEvents=false: keystrokes in PiP stay in PiP @docpip', async ({ page }) => {
    await page.goto(routeFor('basic', { forwardKeyboardEvents: false }));
    const c = contract(page);
    const pip = await openPip(page, c.open);
    const notes = c.contentIn(pip).getByRole('textbox', { name: NAMES.notes });

    await notes.press('KeyQ');
    await expect(notes).toHaveValue('q');
    await settle(page, pip);

    expect(await bridged(page, 'key:')).toEqual([]);
  });

  test('BR4 a real click in PiP reaches the opener as pointerdown, pointerup and click, marked pipItUpBridged @docpip', async ({ page }) => {
    await page.goto(routeFor('basic'));
    const c = contract(page);
    const pip = await openPip(page, c.open);

    await c.contentIn(pip).getByRole('heading', { name: NAMES.heading }).click();

    await expect.poll(() => bridged(page, 'pointer:')).toEqual([LOG.pointer('pointerdown'), LOG.pointer('pointerup'), LOG.pointer('click')]);
  });

  test('BR5 a synthetic pointer event dispatched inside PiP is NOT forwarded @docpip', async ({ page }) => {
    await page.goto(routeFor('basic'));
    const c = contract(page);
    const pip = await openPip(page, c.open);

    await pip.evaluate(() => {
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await settle(page, pip);

    expect(await bridged(page, 'pointer:')).toEqual([]);
  });

  test('BR6 forwardPointerEvents=false: clicks in PiP are not bridged @docpip', async ({ page }) => {
    await page.goto(routeFor('basic', { forwardPointerEvents: false }));
    const c = contract(page);
    const pip = await openPip(page, c.open);
    const inPip = c.contentIn(pip);

    await inPip.getByRole('button', { name: NAMES.increment }).click();
    await expect(inPip.getByText(NAMES.count(1), { exact: true })).toBeVisible();
    await settle(page, pip);

    expect(await bridged(page, 'pointer:')).toEqual([]);
  });

  test('BR7 when the opener cancels a forwarded key (preventDefault, like a Cmd+S save handler), the original key in PiP is cancelled too @docpip', async ({ page }) => {
    await page.goto(routeFor('basic'));
    const c = contract(page);
    const pip = await openPip(page, c.open);
    // Registered after the bridge, so it runs after the bridge re-dispatched and read the result.
    await pip.evaluate(() => {
      const w = window as unknown as { __prevented: Record<string, boolean> };
      w.__prevented = {};
      window.addEventListener('keydown', (e) => (w.__prevented[e.key] = e.defaultPrevented));
    });
    await c.contentIn(pip).getByRole('heading', { name: NAMES.heading }).click();

    await pip.keyboard.press('ControlOrMeta+k');
    await pip.keyboard.press('ControlOrMeta+j');

    await expect
      .poll(() => pip.evaluate(() => (window as unknown as { __prevented: Record<string, boolean> }).__prevented))
      .toMatchObject({ k: true, j: false });
  });
});
