/**
 * MANUAL_SMOKE part A, automated: the playground `/`. One test per behaviour, titled with its
 * flows/playground.md row id. Every test also enforces step 7 ("no console errors") through the
 * watchdog, which fails on uncaught errors, console errors and pip-it-up warnings.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../../lib/fixtures';
import { needs } from '../../lib/capabilities';
import { openPip, closePipLikeOS, markNode, expectNodeIn, documentTop, expectPlaying, play } from '../../lib/pip';
import { simulateTabSwitch, tabSwitchAfterQuiet } from '../../lib/activation';
import { demo, editorIn, drawLine, inkAt, isInVideoPip } from './helpers';

/**
 * Style-sync fingerprint. Not font-size: the playground's root size is responsive (18px above
 * 1024px wide, 16px below, index.css), so it legitimately differs in the narrower PiP window.
 */
const typography = (el: Element) => {
  const s = getComputedStyle(el);
  return { color: s.color, fontWeight: s.fontWeight, fontFamily: s.fontFamily };
};

/** Audio demo: start playback, remember the node and the layout, pop it out (PG2, PG3). */
async function popOutPlayingAudio(page: Page) {
  const card = demo(page, /Audio Stream Continuity/);
  const audio = card.locator('audio');
  const below = demo(page, /Scribble Canvas Board/);
  await markNode(audio, 'audio');
  const style = await card.getByRole('heading', { name: 'Audio Player' }).evaluate(typography);
  const belowTop = await documentTop(below);
  const playedTo = await play(audio);
  const pip = await openPip(page, card.getByRole('button', { name: '↗ Pop out' }));
  return { card, below, style, belowTop, playedTo, pip };
}

test.describe('A. Playground', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Pip-it-up Playground' })).toBeVisible();
  });

  test('PG1 video demo: Pop out video enters video PiP and keeps playing, nothing below moves @smoke @video', async ({ page }, testInfo) => {
    needs(testInfo, 'videoPip', 'h264');
    const card = demo(page, /Native Video PiP/);
    const video = card.locator('video');
    const below = demo(page, /Audio Stream Continuity/);
    const playedTo = await play(video);
    const belowTop = await documentTop(below);

    await card.getByRole('button', { name: '↗ Pop out video' }).click();

    await expect.poll(() => isInVideoPip(video)).toBe(true);
    await expect(card.getByRole('button', { name: '⊠ Exit PiP' })).toBeVisible();
    await expectPlaying(video, playedTo);
    expect(await documentTop(below)).toBeCloseTo(belowTop, 0);
  });

  test('PG2 audio demo: Document PiP opens styled, audio keeps playing, nothing below moves @smoke @docpip', async ({ page }, testInfo) => {
    needs(testInfo, 'docPip', 'h264');
    const { card, below, style, belowTop, playedTo, pip } = await popOutPlayingAudio(page);

    await expectNodeIn(page, 'audio', 'pip');
    await expectPlaying(pip.locator('audio'), playedTo);
    expect(await pip.getByRole('heading', { name: 'Audio Player' }).evaluate(typography)).toEqual(style);
    await expect(card.getByRole('button', { name: 'Restore content from Picture-in-Picture' })).toBeVisible();
    expect(await documentTop(below)).toBeCloseTo(belowTop, 0);
  });

  test('PG3 closing the PiP window from the OS returns the same, still-playing content @smoke @docpip', async ({ page }, testInfo) => {
    needs(testInfo, 'docPip', 'h264');
    const { card, below, belowTop, pip } = await popOutPlayingAudio(page);
    const inPip = await expectPlaying(pip.locator('audio'));

    await closePipLikeOS(pip);

    await expectNodeIn(page, 'audio', 'opener');
    await expectPlaying(card.locator('audio'), inPip);
    await expect(card.getByRole('button', { name: '↗ Pop out' })).toBeVisible();
    expect(await documentTop(below)).toBeCloseTo(belowTop, 0);
  });

  test('PG4 scribble: strokes from before and during PiP survive closing, and undo still works @smoke @docpip', async ({ page }, testInfo) => {
    needs(testInfo, 'docPip');
    const card = demo(page, /Scribble Canvas Board/);
    const canvas = card.locator('canvas');
    await markNode(canvas, 'canvas');
    await drawLine(page, canvas, 0.25, 0.2, 0.8);
    expect(await inkAt(canvas, 0.5, 0.25)).toBe(true);

    const pip = await openPip(page, card.getByRole('button', { name: '↗ Pop out' }));
    await expectNodeIn(page, 'canvas', 'pip');
    const pipCanvas = pip.locator('canvas');
    expect(await inkAt(pipCanvas, 0.5, 0.25)).toBe(true);
    await drawLine(pip, pipCanvas, 0.75, 0.2, 0.8);
    expect(await inkAt(pipCanvas, 0.5, 0.75)).toBe(true);

    await closePipLikeOS(pip);
    await expectNodeIn(page, 'canvas', 'opener');
    expect(await inkAt(canvas, 0.5, 0.25)).toBe(true);
    expect(await inkAt(canvas, 0.5, 0.75)).toBe(true);

    await card.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => inkAt(canvas, 0.5, 0.75)).toBe(false);
    expect(await inkAt(canvas, 0.5, 0.25)).toBe(true);
  });

  test('PG5 keyboard bridge: Cmd/Ctrl+S pressed inside PiP fires the opener save handler @smoke @docpip', async ({ page }, testInfo) => {
    needs(testInfo, 'docPip');
    const card = demo(page, /Keyboard Event Forwarding/);
    const pip = await openPip(page, card.getByRole('button', { name: 'Open PiP' }));
    await pip.getByRole('heading', { name: 'Press Cmd+S (or Ctrl+S)' }).click();

    await pip.keyboard.press('ControlOrMeta+s');

    await expect(card.getByText(/^Command intercepted! Last saved at: /)).toBeVisible();
  });

  /** Type "alpha omega" in the editor, then pop it out (PG6, PG7). */
  async function popOutTypedEditor(page: Page) {
    const card = demo(page, /TipTap Editor/);
    const editor = editorIn(card);
    await editor.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('alpha omega');
    await expect(editor).toHaveText('alpha omega');
    const pip = await openPip(page, card.getByRole('button', { name: '↗ Pop out' }));
    return { card, pip, pipEditor: editorIn(pip) };
  }

  test('PG6 editor: a click in the middle of the text inside PiP puts the caret there @smoke @docpip', async ({ page }, testInfo) => {
    needs(testInfo, 'docPip');
    const { pip, pipEditor } = await popOutTypedEditor(page);
    await expect(pipEditor).toHaveText('alpha omega');

    // The right edge of the 5th character ("alpha|"), in PiP window coordinates.
    const point = await pipEditor.evaluate((el) => {
      const text = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode() as Text;
      const range = el.ownerDocument.createRange();
      range.setStart(text, 4);
      range.setEnd(text, 5);
      const r = range.getBoundingClientRect();
      return { x: r.right, y: r.top + r.height / 2 };
    });
    await pip.mouse.click(point.x, point.y);
    await pip.keyboard.type('-beta');

    await expect(pipEditor).toHaveText('alpha-beta omega');
  });

  test('PG7 editor: undo inside PiP goes back past the pop-out (the editor was not remounted) @smoke @docpip', async ({ page }, testInfo) => {
    needs(testInfo, 'docPip');
    const { pip, pipEditor } = await popOutTypedEditor(page);
    await pipEditor.click();
    await pip.keyboard.press('End');
    await pip.keyboard.type('!');
    await expect(pipEditor).toHaveText('alpha omega!');

    // Undo groups depend on typing speed, so press until the pre-pop-out text is back (max 6).
    for (let i = 0; i < 6 && !(await pipEditor.textContent())?.includes('Hello World'); i++) {
      await pip.keyboard.press('ControlOrMeta+z');
    }

    await expect(pipEditor).toHaveText('Hello World! 🌎️');
  });

  test('PG8 editor auto-PiP: switching tabs right after typing pops the editor out @smoke @docpip', async ({ page }, testInfo) => {
    needs(testInfo, 'docPip');
    const card = demo(page, /TipTap Editor/);
    await card.getByRole('checkbox', { name: /Auto-PiP on tab switch/ }).check();
    await editorIn(card).click();
    await page.keyboard.type(' typed');

    const popup = page.waitForEvent('popup');
    await simulateTabSwitch(page, 'hidden');
    const pip = await popup;

    await expect(editorIn(pip)).toContainText('typed');
    await expect(pip.getByText('Popped out automatically (gesture).')).toBeVisible();
  });

  test('PG9 video auto-PiP: switching tabs while the video plays enters video PiP @smoke @video', async ({ page }, testInfo) => {
    needs(testInfo, 'videoPip', 'h264');
    const card = demo(page, /Native Video PiP/);
    const video = card.locator('video');
    await play(video);
    await card.getByRole('checkbox', { name: /Auto-PiP on tab switch/ }).check();

    await simulateTabSwitch(page, 'hidden');

    await expect.poll(() => isInVideoPip(video)).toBe(true);
    await expect(card.getByText('Entered PiP (gesture).')).toBeVisible();
  });

  test('PG10 video auto-PiP: with no interaction for ~6 s the switch is blocked and the status says why @video @slow', async ({ page, watchdog }, testInfo) => {
    needs(testInfo, 'videoPip', 'h264', 'userActivation');
    watchdog.allow(/\[useVideoPip\] Failed to enter PiP/);
    const card = demo(page, /Native Video PiP/);
    const video = card.locator('video');
    await play(video);
    await card.getByRole('checkbox', { name: /Auto-PiP on tab switch/ }).check();

    await tabSwitchAfterQuiet(page);

    await expect(card.getByText('Blocked: no click in the last ~5s to authorise it.')).toBeVisible();
    expect(await isInVideoPip(video)).toBe(false);
  });

  test('PG11 both auto-PiPs ticked: one tab switch pops out the editor, and the video reports a block @docpip @video', async ({ page, watchdog }, testInfo) => {
    needs(testInfo, 'docPip', 'videoPip', 'h264');
    watchdog.allow(/\[useVideoPip\] Failed to enter PiP/);
    const editorCard = demo(page, /TipTap Editor/);
    const videoCard = demo(page, /Native Video PiP/);
    const video = videoCard.locator('video');
    // Tick order is registration order (useAutoPip attaches when `enabled` turns true): editor first.
    await editorCard.getByRole('checkbox', { name: /Auto-PiP on tab switch/ }).check();
    await play(video);
    await videoCard.getByRole('checkbox', { name: /Auto-PiP on tab switch/ }).check();
    await editorIn(editorCard).click();
    await page.keyboard.type(' typed');

    const popup = page.waitForEvent('popup');
    await simulateTabSwitch(page, 'hidden');
    const pip = await popup;

    await expect(pip.getByText('Popped out automatically (gesture).')).toBeVisible();
    // MANUAL_SMOKE expects exactly "Blocked: NotAllowedError." (see flows/playground.md PG11 notes).
    await expect(videoCard.getByText(/^(Blocked: |Entered PiP)/)).toHaveText(/^Blocked: /);
    expect(await isInVideoPip(video)).toBe(false);
  });

  test('PG12 the playground loads with no uncaught errors, console errors or pip-it-up warnings @smoke', async ({ page }) => {
    await page.waitForLoadState('load');
    await expect(demo(page, /Build Progress Monitor/)).toBeVisible();
    // The watchdog fixture asserts the rest when the test ends.
  });
});
