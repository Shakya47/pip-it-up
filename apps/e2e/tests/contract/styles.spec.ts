/**
 * flows/styles.md (ST): style copying into the PiP document, `sync` (default) vs `once`, plus
 * html/body attribute sync. The contract ships `.contract-heading` rules (CONTRACT_CSS).
 */
import type { Locator } from '@playwright/test';
import { test, expect } from '../../lib/fixtures';
import { needs } from '../../lib/capabilities';
import { openPip } from '../../lib/pip';
import { contract, NAMES, routeFor } from '../../lib/contract';

const GREEN = 'rgb(0, 102, 51)';
const RED = 'rgb(200, 30, 30)';
const color = (l: Locator) => l.evaluate((el) => getComputedStyle(el).color);
const decoration = (l: Locator) => l.evaluate((el) => getComputedStyle(el).textDecorationLine);

test.describe('styles', () => {
  test.beforeEach(async ({}, testInfo) => needs(testInfo, 'docPip'));

  test('ST1 the page\'s stylesheets are copied: the heading has the same color in PiP @smoke @docpip', async ({ page }) => {
    await page.goto(routeFor('styles'));
    const c = contract(page);
    expect(await color(c.content.getByRole('heading', { name: NAMES.heading }))).toBe(GREEN);

    const pip = await openPip(page, c.open);

    expect(await color(c.contentIn(pip).getByRole('heading', { name: NAMES.heading }))).toBe(GREEN);
  });

  test('ST2 copyStyles=sync: toggling the theme class on <html> after opening restyles the PiP window @docpip', async ({ page }) => {
    await page.goto(routeFor('styles'));
    const c = contract(page);
    const pip = await openPip(page, c.open);
    const heading = c.contentIn(pip).getByRole('heading', { name: NAMES.heading });

    await page.getByRole('button', { name: NAMES.themeToggle }).click();

    await expect.poll(() => color(heading)).toBe(RED);
    await expect(pip.locator('html')).toHaveClass(/theme-dark/);
    await expect(pip.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('ST3 copyStyles=sync: a <style> added to the page after opening reaches the PiP window @docpip', async ({ page }) => {
    await page.goto(routeFor('styles'));
    const c = contract(page);
    const pip = await openPip(page, c.open);
    const heading = c.contentIn(pip).getByRole('heading', { name: NAMES.heading });
    expect(await decoration(heading)).toBe('none');

    await page.getByRole('button', { name: NAMES.addStyle }).click();

    await expect.poll(() => decoration(heading)).toBe('underline');
  });

  test('ST4 copyStyles=once: later theme and style changes do NOT reach the PiP window @docpip', async ({ page }) => {
    await page.goto(routeFor('styles', { copyStyles: 'once' }));
    const c = contract(page);
    const pip = await openPip(page, c.open);
    const heading = c.contentIn(pip).getByRole('heading', { name: NAMES.heading });
    expect(await color(heading)).toBe(GREEN);

    await page.getByRole('button', { name: NAMES.themeToggle }).click();
    await page.getByRole('button', { name: NAMES.addStyle }).click();
    // The page itself did change; then give a sync (if one wrongly existed) two animation frames.
    await expect(page.locator('html')).toHaveClass(/theme-dark/);
    await expect(page.locator('style#contract-added')).toHaveCount(1);
    await pip.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

    expect(await color(heading)).toBe(GREEN);
    expect(await decoration(heading)).toBe('none');
    await expect(pip.locator('html')).not.toHaveClass(/theme-dark/);
  });
});
