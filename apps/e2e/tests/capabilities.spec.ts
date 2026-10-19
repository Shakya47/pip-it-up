/**
 * flows/capabilities.md (BC): the per-browser canary. Each live browser must still match its
 * DECLARED row in lib/capabilities.ts, in both directions: a browser losing Document PiP fails
 * here (instead of silently skipping every docpip test), and so does one gaining it (Safari
 * shipping Document PiP) — then update the declaration and let its skipped tests run.
 * Runs on the vanilla project of every browser.
 */
import { test, expect } from '../lib/fixtures';
import { CAPABILITIES } from '../lib/capabilities';
import { routeFor } from '../lib/contract';

test('BC1 feature detection matches the declared capabilities (docPip, moveBefore, h264, userActivation) @smoke', async ({ page, browserKind }) => {
  await page.goto(routeFor('basic'));
  const declared = CAPABILITIES[browserKind];

  const live = await page.evaluate(() => ({
    docPip: 'documentPictureInPicture' in window,
    moveBefore: typeof (Element.prototype as unknown as { moveBefore?: unknown }).moveBefore === 'function',
    h264: document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"') !== '',
    userActivation: 'userActivation' in navigator,
  }));

  expect(live).toEqual({ docPip: declared.docPip, moveBefore: declared.moveBefore, h264: declared.h264, userActivation: declared.userActivation });
});

test('BC2 video PiP actually works exactly where it is declared (the API existing is not enough: WebKit has it and rejects) @video', async ({ page, browserKind }) => {
  await page.goto(routeFor('basic'));
  await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 36;
    setInterval(() => canvas.getContext('2d')!.fillRect(0, 0, 64, 36), 50);
    const video = document.createElement('video');
    video.muted = true;
    video.srcObject = canvas.captureStream(30);
    document.body.append(video);
    const button = document.createElement('button');
    button.textContent = 'Canary video PiP';
    button.onclick = () => {
      video
        .play()
        .then(() => video.requestPictureInPicture())
        .then(() => (button.dataset.result = 'entered'), (e: Error) => (button.dataset.result = e.name));
    };
    document.body.append(button);
  });
  const button = page.getByRole('button', { name: 'Canary video PiP' });

  await button.click();

  await expect(button).toHaveAttribute('data-result', /.+/);
  const result = await button.getAttribute('data-result');
  expect(result === 'entered', `video PiP result: ${result}`).toBe(CAPABILITIES[browserKind].videoPip);
});

test('BC3 Document PiP actually opens a window exactly where it is declared @docpip', async ({ page, browserKind }) => {
  await page.goto(routeFor('basic'));
  const declared = CAPABILITIES[browserKind].docPip;
  const opened = page.waitForEvent('popup', { timeout: 5_000 }).then(() => true, () => false);

  await page.evaluate(() => {
    const b = document.createElement('button');
    b.textContent = 'Canary document PiP';
    b.onclick = () => {
      const dpip = (window as unknown as { documentPictureInPicture?: { requestWindow(o: object): Promise<Window> } }).documentPictureInPicture;
      void dpip?.requestWindow({ width: 320, height: 240 }).catch(() => {});
    };
    document.body.append(b);
  });
  await page.getByRole('button', { name: 'Canary document PiP' }).click();

  expect(await opened).toBe(declared);
});
