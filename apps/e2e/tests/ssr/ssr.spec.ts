/**
 * flows/ssr.md (SS): server rendering and hydration on the Next.js target (App Router). Design
 * spec V20: the server renders no portal markup, and hydration logs zero mismatch warnings. The
 * watchdog already fails a test on any console error (React reports hydration mismatches there);
 * the hydration rows also look for the words explicitly.
 */
import type { Page } from '@playwright/test';
import { test, expect, onlyTargets } from '../../lib/fixtures';
import { needs } from '../../lib/capabilities';
import { openPip, closePipLikeOS, markNode, expectNodeIn } from '../../lib/pip';

function collectHydrationNoise(page: Page) {
  const noise: string[] = [];
  // Warnings and errors only: Next's dev build marks `console.timeStamp('Hydrated')`, which Firefox reports.
  page.on('console', (m) => {
    if ((m.type() === 'error' || m.type() === 'warning') && /hydrat|did not match|server rendered/i.test(m.text())) {
      noise.push(`${m.type()}: ${m.text()}`);
    }
  });
  return noise;
}

test.describe('SSR', () => {
  test.beforeEach(async ({}, testInfo) => onlyTargets(testInfo, 'next'));

  test('SS1 /ssr: the server HTML holds the page but no portal markup (V20) @smoke', async ({ request }) => {
    const html = await (await request.get('/ssr')).text();

    expect(html).toContain('Server HTML');
    expect(html).toContain('Content below');
    expect(html).not.toContain('data-pip-shuttle');
    expect(html).not.toContain('SSR content');
  });

  test('SS2 /ssr hydrates with no mismatch warnings and renders the wrapped content @smoke', async ({ page }) => {
    const noise = collectHydrationNoise(page);
    await page.goto('/ssr');

    await expect(page.getByRole('status')).toHaveText('Hydrated');
    const region = page.getByRole('region', { name: 'SSR content' });
    await region.getByRole('button', { name: 'Count: 0' }).click();
    await expect(region.getByRole('button', { name: 'Count: 1' })).toBeVisible();
    expect(noise).toEqual([]);
  });

  test('SS3 /ssr after hydration a real PiP window opens with the same node and state @docpip', async ({ page }, testInfo) => {
    needs(testInfo, 'docPip');
    await page.goto('/ssr');
    await expect(page.getByRole('status')).toHaveText('Hydrated');
    const region = page.getByRole('region', { name: 'SSR content' });
    await region.getByRole('button', { name: 'Count: 0' }).click();
    await markNode(region, 'ssr-region');

    const pip = await openPip(page, region.getByRole('button', { name: '↗ Pop out' }));

    await expectNodeIn(page, 'ssr-region', 'pip');
    await expect(pip.getByRole('button', { name: 'Count: 1' })).toBeVisible();
    await closePipLikeOS(pip);
    await expectNodeIn(page, 'ssr-region', 'opener');
  });

  test('SS4 /ssr-persist: the server HTML has the anchor box but no portal markup (V20)', async ({ request }) => {
    const html = await (await request.get('/ssr-persist')).text();

    expect(html).toContain('data-pip-anchor="widget"');
    expect(html).not.toContain('data-pip-shuttle');
    expect(html).not.toContain('Persistent widget');
  });

  test('SS5 /ssr-persist hydrates clean, docks the widget, and pops it out @docpip', async ({ page }, testInfo) => {
    needs(testInfo, 'docPip');
    const noise = collectHydrationNoise(page);
    await page.goto('/ssr-persist');
    await expect(page.getByRole('status')).toHaveText('Hydrated');
    const widget = page.getByRole('region', { name: 'Persistent widget' });
    await expect(widget.getByText('Placement: anchor')).toBeVisible();

    const pip = await openPip(page, page.getByRole('button', { name: '↗ Pop out' }));

    await expect(pip.getByText('Placement: pip')).toBeVisible();
    await expect(page.getByText('Widget is away')).toBeVisible();
    expect(noise).toEqual([]);
  });
});
