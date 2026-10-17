import { expect, type Page } from '@playwright/test';
import { NAMES } from '@pip-it-up/e2e-contract';

export { NAMES, LOG, routeFor } from '@pip-it-up/e2e-contract';

/**
 * Locators for the e2e DOM contract (apps/e2e-contract). The same calls work on every target.
 * `pip` is the Document PiP window's page, when one is open.
 */
export function contract(page: Page, which: 'A' | 'B' = 'A') {
  const n = (name: string) => (which === 'B' ? NAMES.b(name) : name);
  const content = (p: Page) => p.getByRole('region', { name: n(NAMES.content), exact: true });
  return {
    open: page.getByRole('button', { name: n(NAMES.open), exact: true }),
    close: page.getByRole('button', { name: n(NAMES.close), exact: true }),
    status: page.getByRole('status').nth(which === 'B' ? 1 : 0),
    content: content(page),
    contentIn: content,
    below: page.getByText(NAMES.below, { exact: true }),
    log: page.getByRole('log', { name: NAMES.log }),
  };
}

/** The "Events" log, as text entries in order. */
export const logEntries = (page: Page) =>
  page.getByRole('log', { name: NAMES.log }).getByRole('listitem').allTextContents();

/** Wait until the log holds exactly `expected`, in order. */
export async function expectLog(page: Page, expected: string[]) {
  await expect.poll(() => logEntries(page), { message: 'the Events log' }).toEqual(expected);
}

/** Wait until the log contains `entry` (anywhere). */
export async function expectLogged(page: Page, entry: string) {
  await expect.poll(() => logEntries(page), { message: `the Events log should contain "${entry}"` }).toContain(entry);
}

/** Size of a PiP window's viewport. */
export const innerSize = (pip: Page) => pip.evaluate(() => ({ width: innerWidth, height: innerHeight }));

/**
 * Log entries without the bridge's `key:` / `pointer:` lines: just what the lifecycle callbacks wrote.
 * `reject:<name>` (an open()/toggle() rejection onError never saw) is deliberately KEPT, here and in
 * `expectLog`: an exact-log assertion must fail when a failure bypasses onError. A test that expects
 * one lists it (`LOG.reject(name)`).
 */
export const lifecycleEntries = async (page: Page) =>
  (await logEntries(page)).filter((e) => !e.startsWith('key:') && !e.startsWith('pointer:'));

/** Wait until the lifecycle entries (see `lifecycleEntries`) are exactly `expected`, in order. */
export async function expectLifecycle(page: Page, expected: string[]) {
  await expect.poll(() => lifecycleEntries(page), { message: 'the lifecycle entries of the Events log' }).toEqual(expected);
}
