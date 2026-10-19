/**
 * flows/auto-pip.md (AP): createAutoPip / useAutoPip. A tab switch is simulated in the page
 * (lib/activation.ts); every Playwright call grants activation, so AP1 proves "works while
 * activation is live" and AP2 waits 6.5 s untouched so it has really expired.
 */
import { test, expect } from '../../lib/fixtures';
import { needs } from '../../lib/capabilities';
import { simulateTabSwitch, restoreVisibility, tabSwitchAfterQuiet } from '../../lib/activation';
import { contract, expectLogged, logEntries, LOG, NAMES, routeFor } from '../../lib/contract';
import { expectSteady, pipRequests, recordPipRequests } from '../../lib/pip';

const autoEntries = async (page: import('@playwright/test').Page) => (await logEntries(page)).filter((e) => e.startsWith('auto:'));

test.describe('auto-pip', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    needs(testInfo, 'docPip', 'userActivation');
    await recordPipRequests(page);
    await page.goto(routeFor('auto-pip'));
  });

  test('AP1 armed, then the tab is hidden while activation is live: the window opens, reported as a gesture @smoke @docpip', async ({ page }) => {
    const c = contract(page);
    await page.getByRole('checkbox', { name: NAMES.autoPip }).check();

    const popup = page.waitForEvent('popup');
    await simulateTabSwitch(page, 'hidden');
    const pip = await popup;

    await expect(c.contentIn(pip).getByRole('heading', { name: NAMES.heading })).toBeVisible();
    await expect(c.status).toHaveText(NAMES.status.open);
    await expectLogged(page, LOG.autoOk('gesture'));
  });

  test('AP2 armed, untouched for 6.5 s, then hidden: blocked with NotAllowedError and hadActivation false; nothing opens @docpip @slow', async ({ page, context }) => {
    const c = contract(page);
    await page.getByRole('checkbox', { name: NAMES.autoPip }).check();
    let windows = 0;
    context.on('page', () => windows++);

    await tabSwitchAfterQuiet(page);

    await expectLogged(page, LOG.autoBlocked('NotAllowedError', false));
    await expect(c.status).toHaveText(NAMES.status.closed);
    expect(windows).toBe(0);
  });

  test('AP3 the `when` guard: hiding the tab again while already open makes no second attempt @docpip', async ({ page }) => {
    await page.getByRole('checkbox', { name: NAMES.autoPip }).check();
    const popup = page.waitForEvent('popup');
    await simulateTabSwitch(page, 'hidden');
    await popup;
    await expectLogged(page, LOG.autoOk('gesture'));

    expect(await pipRequests(page)).toHaveLength(1);

    await restoreVisibility(page);
    await simulateTabSwitch(page, 'hidden');

    // A second attempt has no positive signal to wait for: createAutoPip logs only after enter()
    // settles (an already-open instance resolves at once, a new requestWindow takes a few hundred
    // ms). So hold the negative for 1.5 s: longer than a PiP window takes to open here.
    await expectSteady(async () => ({ auto: await autoEntries(page), requests: (await pipRequests(page)).length }), {
      auto: [LOG.autoOk('gesture')],
      requests: 1,
    }, { ms: 1_500, message: 'no second auto-PiP attempt' });
  });

  test('AP4 not armed (enabled false): hiding the tab does nothing @docpip', async ({ page, context }) => {
    const c = contract(page);
    let windows = 0;
    context.on('page', () => windows++);

    await simulateTabSwitch(page, 'hidden');

    // Nothing to wait for when nothing should happen: hold the negative for 1.5 s (a PiP window
    // opens well within that; see AP1). Activation is live the whole time, so an armed listener
    // WOULD succeed.
    await expectSteady(async () => ({ auto: await autoEntries(page), requests: (await pipRequests(page)).length, windows }), {
      auto: [],
      requests: 0,
      windows: 0,
    }, { ms: 1_500, message: 'no auto-PiP attempt while not armed' });
    await expect(c.status).toHaveText(NAMES.status.closed);
  });
});
