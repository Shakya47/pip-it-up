/**
 * The playground's use cases, as contract rows (vanilla = @pip-it-up/core, react = @pip-it-up/react):
 * flows/editing.md (ED: the rich-text editor demo), flows/live-state.md (LS: shared tree / live
 * updates, the scribble canvas), flows/registry.md (RG: decoupled trigger, global shortcut,
 * navigation cleanup from the core README).
 */
import type { Locator, Page } from '@playwright/test';
import { test, expect, onlyTargets } from '../../lib/fixtures';
import { needs } from '../../lib/capabilities';
import { openPip, closePipLikeOS, pressClosingPip, markNode, expectNodeIn } from '../../lib/pip';
import { contract, expectLifecycle, NAMES, LOG, routeFor } from '../../lib/contract';

const richNotes = (scope: Page | Locator) => scope.getByRole('textbox', { name: NAMES.richNotes });

/** Right edge of character `index` of an element's first text node, relative to the element's box. */
const afterChar = (el: Locator, index: number) =>
  el.evaluate((node, i) => {
    const text = node.ownerDocument.createTreeWalker(node, NodeFilter.SHOW_TEXT).nextNode() as Text;
    const range = node.ownerDocument.createRange();
    range.setStart(text, i - 1);
    range.setEnd(text, i);
    const r = range.getBoundingClientRect();
    const box = node.getBoundingClientRect();
    return { x: r.right - box.left, y: r.top - box.top + r.height / 2 };
  }, index);

/** Is there ink on the canvas around (fx, fy), fractions of its size? */
const inkAt = (canvas: Locator, fx: number, fy: number) =>
  canvas.evaluate((c: HTMLCanvasElement, [x, y]) => {
    const d = c.getContext('2d')!.getImageData(Math.round(c.width * x) - 4, Math.round(c.height * y) - 4, 9, 9).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
    return false;
  }, [fx, fy]);

async function stroke(page: Page, canvas: Locator, y: number) {
  await canvas.scrollIntoViewIfNeeded();
  const b = (await canvas.boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.2, b.y + b.height * y);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.8, b.y + b.height * y, { steps: 10 });
  await page.mouse.up();
}

test.describe('editing (ED)', () => {
  test.beforeEach(async ({}, testInfo) => needs(testInfo, 'docPip'));

  test('ED1 a click in the middle of editable text inside PiP puts the caret there @docpip', async ({ page }) => {
    await page.goto(routeFor('basic'));
    const c = contract(page);
    const pip = await openPip(page, c.open);
    const notes = richNotes(c.contentIn(pip));

    // A locator click at an offset: Playwright scrolls it into view (the window can scroll sideways).
    await notes.click({ position: await afterChar(notes, 5) }); // "alpha|"
    await pip.keyboard.type('-beta');

    await expect(notes).toHaveText('alpha-beta omega');
  });

  test('ED2 native undo (Cmd/Ctrl+Z) works for editable text inside PiP @docpip', async ({ page }) => {
    await page.goto(routeFor('basic'));
    const c = contract(page);
    const pip = await openPip(page, c.open);
    const notes = richNotes(c.contentIn(pip));
    await notes.click();
    await pip.keyboard.press('End');
    await pip.keyboard.type('!');
    await expect(notes).toHaveText('alpha omega!');

    await pip.keyboard.press('ControlOrMeta+z');

    await expect(notes).toHaveText(NAMES.richNotesText);
  });

  test('ED3 an input keeps what was typed before the pop-out, and typing continues inside PiP @docpip', async ({ page }) => {
    await page.goto(routeFor('basic'));
    const c = contract(page);
    await c.content.getByRole('textbox', { name: NAMES.notes }).fill('before');

    const pip = await openPip(page, c.open);
    const notes = c.contentIn(pip).getByRole('textbox', { name: NAMES.notes });
    await expect(notes).toHaveValue('before');
    await notes.click();
    await pip.keyboard.press('End');
    await pip.keyboard.type(' after');

    await expect(notes).toHaveValue('before after');
    await closePipLikeOS(pip);
    await expect(c.content.getByRole('textbox', { name: NAMES.notes })).toHaveValue('before after');
  });
});

test.describe('live state (LS)', () => {
  test.beforeEach(async ({}, testInfo) => needs(testInfo, 'docPip'));

  test('LS1 updates made OUTSIDE the content while it is in PiP show up in the PiP window (shared tree) @smoke @docpip', async ({ page }) => {
    await page.goto(routeFor('basic'));
    const c = contract(page);
    await page.getByRole('button', { name: NAMES.incrementOutside }).click();
    const pip = await openPip(page, c.open);
    await expect(c.contentIn(pip).getByText(NAMES.externalCount(1))).toBeVisible();

    await page.getByRole('button', { name: NAMES.incrementOutside }).click();
    await page.getByRole('button', { name: NAMES.incrementOutside }).click();

    await expect(c.contentIn(pip).getByText(NAMES.externalCount(3))).toBeVisible();
    await closePipLikeOS(pip);
    await expect(c.content.getByText(NAMES.externalCount(3))).toBeVisible();
  });

  test('LS2 a canvas keeps its bitmap through the move, can be drawn on inside PiP, and keeps both strokes after closing @docpip', async ({ page }) => {
    await page.goto(routeFor('canvas'));
    const c = contract(page);
    const canvas = c.content.getByLabel(NAMES.sketch);
    await markNode(canvas, 'sketch');
    await stroke(page, canvas, 0.3);
    expect(await inkAt(canvas, 0.5, 0.3)).toBe(true);

    const pip = await openPip(page, c.open);
    await expectNodeIn(page, 'sketch', 'pip');
    const inPip = c.contentIn(pip).getByLabel(NAMES.sketch);
    expect(await inkAt(inPip, 0.5, 0.3)).toBe(true);
    await stroke(pip, inPip, 0.7);
    expect(await inkAt(inPip, 0.5, 0.7)).toBe(true);
    await closePipLikeOS(pip);

    await expectNodeIn(page, 'sketch', 'opener');
    expect(await inkAt(canvas, 0.5, 0.3)).toBe(true);
    expect(await inkAt(canvas, 0.5, 0.7)).toBe(true);
  });

  test('LS3 mode=clone is a snapshot: the copy misses later outside updates and the canvas bitmap (README: clone vs move) @docpip', async ({ page }, testInfo) => {
    onlyTargets(testInfo, 'vanilla');
    await page.goto(routeFor('canvas', { mode: 'clone' }));
    const c = contract(page);
    const canvas = c.content.getByLabel(NAMES.sketch);
    await stroke(page, canvas, 0.5);
    expect(await inkAt(canvas, 0.5, 0.5)).toBe(true);

    const pip = await openPip(page, c.open);
    await page.getByRole('button', { name: NAMES.incrementOutside }).click();

    await expect(c.content.getByText(NAMES.externalCount(1))).toBeVisible();
    await expect(c.contentIn(pip).getByText(NAMES.externalCount(0))).toBeVisible();
    expect(await inkAt(c.contentIn(pip).getByLabel(NAMES.sketch), 0.5, 0.5)).toBe(false);
  });
});

test.describe('registry (RG)', () => {
  test.beforeEach(async ({}, testInfo) => needs(testInfo, 'docPip'));

  test('RG1 a global shortcut (Alt+P) in the page opens the instance through getPip() @docpip', async ({ page }) => {
    await page.goto(routeFor('basic'));
    const c = contract(page);
    await page.getByRole('heading', { level: 2 }).first().click(); // focus the page, not a control

    const [pip] = await Promise.all([page.waitForEvent('popup'), page.keyboard.press('Alt+KeyP')]);

    await expect(c.contentIn(pip).getByRole('heading', { name: NAMES.heading })).toBeVisible();
    await expect(c.status).toHaveText(NAMES.status.open);
  });

  test('RG2 the same shortcut pressed INSIDE the PiP window reaches the page (keyboard bridge) and closes it @docpip', async ({ page }) => {
    await page.goto(routeFor('basic'));
    const c = contract(page);
    const pip = await openPip(page, c.open);
    await c.contentIn(pip).getByRole('heading', { name: NAMES.heading }).click();

    await pressClosingPip(pip, 'Alt+KeyP');

    await expect(c.status).toHaveText(NAMES.status.closed);
  });

  test('RG3 "Close via registry" (navigation cleanup: getPip(id)?.close()) closes the window @docpip', async ({ page }) => {
    await page.goto(routeFor('basic'));
    const c = contract(page);
    const pip = await openPip(page, c.open);
    const closed = pip.waitForEvent('close');

    await page.getByRole('button', { name: NAMES.closeViaRegistry }).click();

    await closed;
    await expectLifecycle(page, [LOG.open, LOG.ready, LOG.close]);
  });
});
