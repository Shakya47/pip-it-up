/**
 * flows/fallbacks.md (FB): what happens without Document PiP (forced here with `forceFallback`,
 * and natively on browsers without it): `none`, `new-tab` (URL validation, noopener, the
 * `<base href>` case from SEC-201), and a custom function with its cleanup.
 */
import type { BrowserContext } from '@playwright/test';
import { test, expect } from '../../lib/fixtures';
import { contract, expectLog, logEntries, LOG, NAMES, routeFor } from '../../lib/contract';

const NOT_SUPPORTED = /pip-it-up: Document Picture-in-Picture is not supported/;

function countPages(context: BrowserContext) {
  const pages: string[] = [];
  context.on('page', (p) => pages.push(p.url()));
  return pages;
}

test.describe('fallbacks', () => {
  test('FB1 default fallback: nothing opens, no onError, and core warns that PiP is unsupported @fallback', async ({ page, context, watchdog }) => {
    watchdog.allow(NOT_SUPPORTED);
    const warnings: string[] = [];
    page.on('console', (m) => m.type() === 'warning' && warnings.push(m.text()));
    await page.goto(routeFor('basic', { forceFallback: true }));
    const c = contract(page);
    const pages = countPages(context);

    await c.open.click();

    await expect.poll(() => warnings.some((w) => NOT_SUPPORTED.test(w))).toBe(true);
    await expect(c.status).toHaveText(NAMES.status.closed);
    expect(await logEntries(page)).toEqual([]);
    expect(pages).toEqual([]);
  });

  test('FB2 fallback=new-tab opens fallbackUrl (resolved on this origin) in a new tab with no opener @smoke @fallback', async ({ page, context }, testInfo) => {
    await page.goto(routeFor('basic', { forceFallback: true, fallback: 'new-tab', fallbackUrl: '/standalone' }));
    const c = contract(page);
    const origin = new URL(page.url()).origin;

    const [tab] = await Promise.all([context.waitForEvent('page'), c.open.click()]);
    await tab.waitForLoadState('domcontentloaded');

    expect(tab.url()).toBe(`${origin}/standalone`);
    expect(await tab.evaluate(() => window.opener)).toBeNull();
    await expect(c.status).toHaveText(NAMES.status.open);
    await expectLog(page, [LOG.open]);
    testInfo.annotations.push({ type: 'note', description: 'window.open(parsed.href, "_blank", "noopener,noreferrer")' });
  });

  // Since 2026-09-29 (core: ERR_INVALID_FALLBACK) an unusable fallbackUrl is a failed open, not a
  // warning: open() rejects and onError gets a PipError (name `PipError`), so the log shows exactly
  // `error:PipError` (no `reject:`, because onError reported it). The URL is checked before
  // anything opens, so nothing opens and the instance never reports open.
  test('FB3 fallback=new-tab refuses a javascript: URL: onError gets PipError (ERR_INVALID_FALLBACK); no tab opens @fallback', async ({ page, context }) => {
    await page.goto(routeFor('basic', { forceFallback: true, fallback: 'new-tab', fallbackUrl: 'javascript:alert(1)' }));
    const c = contract(page);
    const pages = countPages(context);

    await c.open.click();

    await expectLog(page, [LOG.error('PipError')]);
    await expect(c.status).toHaveText(NAMES.status.closed);
    expect(pages).toEqual([]);
  });

  test('FB4 fallback=new-tab without fallbackUrl: onError gets PipError (ERR_INVALID_FALLBACK); nothing opens @fallback', async ({ page, context }) => {
    await page.goto(routeFor('basic', { forceFallback: true, fallback: 'new-tab' }));
    const c = contract(page);
    const pages = countPages(context);

    await c.open.click();

    await expectLog(page, [LOG.error('PipError')]);
    await expect(c.status).toHaveText(NAMES.status.closed);
    expect(pages).toEqual([]);
  });

  test('FB5 a <base href> pointing elsewhere cannot redirect the fallback tab: it opens on this origin (SEC-201) @fallback', async ({ page, context }) => {
    await page.goto(routeFor('basic', { forceFallback: true, fallback: 'new-tab', fallbackUrl: '/standalone' }));
    const c = contract(page);
    await expect(c.open).toBeVisible();
    const origin = new URL(page.url()).origin;
    await context.route('https://example.com/**', (route) => route.fulfill({ status: 200, body: 'wrong origin' }));
    // Inserted after the page rendered (at load it would also redirect Next's router and chunks).
    // The fallback resolves fallbackUrl at click time, so this still exercises SEC-201.
    await page.evaluate(() => {
      const base = document.createElement('base');
      base.href = 'https://example.com/';
      document.head.prepend(base);
    });
    expect(await page.evaluate(() => new URL('/standalone', document.baseURI).origin)).toBe('https://example.com');

    const [tab] = await Promise.all([context.waitForEvent('page'), c.open.click()]);

    await expect.poll(() => tab.url()).toBe(`${origin}/standalone`);
  });

  test('FB6 a custom fallback function runs on open, and its returned cleanup runs on close @fallback', async ({ page }) => {
    await page.goto(routeFor('basic', { forceFallback: true, fallback: 'custom' }));
    const c = contract(page);

    await c.open.click();
    await expect(c.status).toHaveText(NAMES.status.open);
    await expectLog(page, [LOG.fallbackCustom, LOG.open]);

    await c.close.click();

    await expect(c.status).toHaveText(NAMES.status.closed);
    await expectLog(page, [LOG.fallbackCustom, LOG.open, LOG.fallbackCleanup, LOG.close]);
  });
});
