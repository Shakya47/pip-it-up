/**
 * flows/focus-scroll.md (FS): restoreScroll / restoreFocus (default on). Core snapshots, at open,
 * the scroll offsets inside the content and the opener's focused input with its selection, and
 * restores them on close (focus-scroll.ts).
 */
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../lib/fixtures';
import { needs } from '../../lib/capabilities';
import { openPip, closePipLikeOS } from '../../lib/pip';
import { contract, NAMES, routeFor } from '../../lib/contract';

const scrollTop = (l: Locator) => l.evaluate((el) => el.scrollTop);
const focusState = (notes: Locator) =>
  notes.evaluate((el: HTMLInputElement) => ({
    focused: el.ownerDocument.activeElement === el && el.ownerDocument === document,
    selection: [el.selectionStart, el.selectionEnd],
  }));

/** Scroll the box to 300 px and focus Notes with "ab|cd|ef" selected, then open and close. */
async function roundTrip(page: Page, params: Record<string, string | boolean> = {}) {
  await page.goto(routeFor('basic', params));
  const c = contract(page);
  const box = c.content.getByRole('region', { name: NAMES.scrollBox });
  const notes = c.content.getByRole('textbox', { name: NAMES.notes });
  await box.evaluate((el) => (el.scrollTop = 300));
  await notes.fill('abcdef');
  await notes.evaluate((el: HTMLInputElement) => el.setSelectionRange(2, 4));
  expect(await scrollTop(box)).toBe(300);

  // Open with the keyboard so focus stays in Notes until the window opens (a click would move it).
  await notes.focus();
  const [pip] = await Promise.all([page.waitForEvent('popup'), c.open.evaluate((b: HTMLButtonElement) => b.click())]);
  await expect(c.status).toHaveText(NAMES.status.open);
  await closePipLikeOS(pip);
  await expect(c.status).toHaveText(NAMES.status.closed);
  return { box, notes };
}

test.describe('focus and scroll', () => {
  test.beforeEach(async ({}, testInfo) => needs(testInfo, 'docPip'));

  test('FS1 restoreScroll (default): a scrolled box inside the content is back at its offset after closing @docpip', async ({ page }) => {
    const { box } = await roundTrip(page);

    await expect.poll(() => scrollTop(box)).toBe(300);
  });

  test('FS2 restoreFocus (default): the input focused before opening is focused again after closing, selection intact @docpip', async ({ page }) => {
    const { notes } = await roundTrip(page);

    await expect.poll(() => focusState(notes)).toEqual({ focused: true, selection: [2, 4] });
  });

  test('FS3 restoreScroll=false: the offset is not restored @docpip', async ({ page }) => {
    const { box } = await roundTrip(page, { restoreScroll: false });

    expect(await scrollTop(box)).not.toBe(300);
  });

  test('FS4 restoreFocus=false: focus is not put back on the input @docpip', async ({ page }) => {
    const { notes } = await roundTrip(page, { restoreFocus: false });

    expect((await focusState(notes)).focused).toBe(false);
  });
});
