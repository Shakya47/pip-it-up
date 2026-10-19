/**
 * flows/media-editors.md (ME): third-party widgets that hold state the DOM move must not lose.
 * Monaco loads from cdn.jsdelivr.net (the @monaco-editor/react default loader), so ME1 is @network.
 * Tiptap, the scribble canvas and media continuity are covered by PG4–PG7 and PG1–PG3.
 */
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '../../lib/fixtures';
import { needs } from '../../lib/capabilities';
import { openPip, markNode, expectNodeIn } from '../../lib/pip';
import { demo } from './helpers';

/** The text of Monaco's (only) model, via the global the @monaco-editor/react loader installs. */
const monacoText = (page: Page) =>
  page.evaluate(() => (window as unknown as { monaco?: { editor: { getModels(): { getValue(): string }[] } } }).monaco?.editor.getModels()[0]?.getValue() ?? null);

/** Type a line in the playground's Monaco demo, then pop it out. */
async function popOutTypedMonaco(page: Page) {
  await page.goto('/');
  const card = demo(page, /Monaco Editor/);
  const input = card.getByRole('textbox', { name: /Editor content/ });
  await expect(input).toBeAttached({ timeout: 20_000 });
  await markNode(input, 'monaco-input');
  const original = await monacoText(page);
  expect(original).toContain('Hello from Monaco!');
  // A real click puts Monaco's cursor in the text; the demo's editor is controlled (`value`),
  // so type at a human pace rather than racing its onChange → setState → value round trip.
  await card.getByRole('code').first().click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('\n// typed before pop-out', { delay: 25 });
  await expect.poll(() => monacoText(page)).toContain('// typed before pop-out');
  const pip = await openPip(page, card.getByRole('button', { name: '↗ Pop out' }));
  return { pip, original: original! };
}

test('ME1 Monaco keeps the same editor node, its model text, and a real layout inside PiP @network @docpip', async ({ page }, testInfo) => {
  needs(testInfo, 'docPip');
  const { pip } = await popOutTypedMonaco(page);

  await expectNodeIn(page, 'monaco-input', 'pip');
  expect(await monacoText(page)).toContain('// typed before pop-out');
  // Laid out in the PiP window (automaticLayout), not a stale zero-size box.
  await expect.poll(async () => (await pip.getByRole('code').first().boundingBox())?.height ?? 0).toBeGreaterThan(50);
  await pip.getByRole('code').first().click();
  await pip.keyboard.type('X', { delay: 25 });
  await expect.poll(() => monacoText(page)).toContain('X');
});

/**
 * Run the setup of a known-bug test. When the test is an expected failure (lib/known-bugs.ts, CI),
 * `test.fail` would accept ANY failure, a CDN outage included; so a failing precondition SKIPS
 * the test with its reason instead, and only the step under test can produce the expected
 * failure. Without the known-bug mark (local runs) a precondition failure fails as usual.
 */
async function precondition<T>(testInfo: TestInfo, step: () => Promise<T>): Promise<T> {
  try {
    return await step();
  } catch (e) {
    if (testInfo.expectedStatus === 'failed') testInfo.skip(true, `precondition failed, the known bug wasn't reached: ${(e as Error).message.split('\n')[0]}`);
    throw e;
  }
}

test('ME2 Monaco: Cmd/Ctrl+Z inside PiP undoes the edit made before the pop-out @network @docpip', async ({ page }, testInfo) => {
  needs(testInfo, 'docPip');
  const { pip, original } = await precondition(testInfo, async () => {
    const opened = await popOutTypedMonaco(page);
    await expectNodeIn(page, 'monaco-input', 'pip');
    await opened.pip.getByRole('code').first().click();
    await expect(opened.pip.getByRole('textbox', { name: /Editor content/ })).toBeFocused();
    return opened;
  });

  for (let i = 0; i < 4 && (await monacoText(page)) !== original; i++) await pip.keyboard.press('ControlOrMeta+z');

  expect(await monacoText(page)).toBe(original);
});

test('ME4 Monaco: the undo history survives the pop-out — a control in PiP that runs editor.trigger("undo") restores the original text @network @docpip', async ({ page }, testInfo) => {
  needs(testInfo, 'docPip');
  const { pip, original } = await popOutTypedMonaco(page);
  // The workaround docs/recipes/monaco.md documents for Monaco's shortcuts not firing in PiP.
  await page.evaluate(() => {
    const w = window as unknown as { documentPictureInPicture: { window: Window }; monaco: { editor: { getEditors(): { trigger(s: string, id: string, p: null): void }[] } } };
    const editor = w.monaco.editor.getEditors()[0];
    const button = w.documentPictureInPicture.window.document.createElement('button');
    button.textContent = 'Undo (command)';
    button.onclick = () => editor.trigger('pip', 'undo', null);
    w.documentPictureInPicture.window.document.body.append(button);
  });

  for (let i = 0; i < 4 && (await monacoText(page)) !== original; i++) {
    await pip.getByRole('button', { name: 'Undo (command)' }).click();
  }

  expect(await monacoText(page)).toBe(original);
});
