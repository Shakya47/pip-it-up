import type { Locator, Page } from '@playwright/test';

/**
 * Playground locators. Demos are scoped by their card heading (an `<h2>` per `<section>`), never
 * by Tailwind classes: several demos share the default trigger label "↗ Pop out".
 */
export const demo = (page: Page, title: RegExp): Locator =>
  page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: title }) });

/** Tiptap renders a contenteditable ProseMirror root; there is one per Rich Text Editor demo. */
export const editorIn = (scope: Page | Locator) => scope.locator('[contenteditable="true"]');

/** Draw a horizontal stroke across `canvas` at height `y`, from `x0` to `x1` (fractions of its box). */
export async function drawLine(page: Page, canvas: Locator, y: number, x0: number, x1: number) {
  // Raw mouse input only lands inside the viewport, and the scribble demo is below the fold.
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas has no layout box');
  await page.mouse.move(box.x + box.width * x0, box.y + box.height * y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * x1, box.y + box.height * y, { steps: 12 });
  await page.mouse.up();
}

/** Is there ink on the canvas bitmap around (`fx`, `fy`) (fractions of its logical size)? */
export async function inkAt(canvas: Locator, fx: number, fy: number): Promise<boolean> {
  return canvas.evaluate(
    (el: HTMLCanvasElement, [x, y]) => {
      const cx = Math.round(el.width * x);
      const cy = Math.round(el.height * y);
      const data = el.getContext('2d')!.getImageData(cx - 4, cy - 4, 9, 9).data;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
      return false;
    },
    [fx, fy],
  );
}

/** The Live Tracker's "MM:SS" readout, in seconds. */
export async function trackerSeconds(scope: Page | Locator): Promise<number> {
  const text = await scope.getByText(/^\d{2}:\d{2}$/).textContent();
  const [m, s] = (text ?? '').split(':').map(Number);
  return m * 60 + s;
}

export const isInVideoPip = (video: Locator) =>
  video.evaluate((v) => v.ownerDocument.pictureInPictureElement === v);
