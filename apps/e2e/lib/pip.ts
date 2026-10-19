import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Helpers for real Picture-in-Picture windows.
 *
 * A Document PiP window arrives as an ordinary Playwright page through the opener's `popup`
 * event (URL `about:blank`); `context.newPage()` is NOT how you get it. Clicks, `fill` and
 * `keyboard` inside it produce `isTrusted: true` events. `pip.close()` behaves like the OS close
 * button: `pagehide` fires in the PiP document, so it is the stand-in for the native X. The
 * library's own close paths (a "Restore" button, `instance.close()`) are different code paths:
 * test both.
 */

/** Click `trigger` and return the Document PiP window it opens. */
export async function openPip(page: Page, trigger: Locator): Promise<Page> {
  const [pip] = await Promise.all([page.waitForEvent('popup'), trigger.click()]);
  await pip.waitForLoadState('domcontentloaded');
  return pip;
}

/**
 * Click a control that closes the PiP window it lives in, and wait for the window to go.
 * Firefox's driver can report "Target page, context or browser has been closed" for the click
 * itself when the page dies mid-action; only that error is tolerated.
 */
export async function clickClosingPip(pip: Page, control: Locator) {
  // A window that is already gone would make this pass without the control doing anything.
  expect(pip.isClosed(), 'the PiP window should still be open before its closing control is clicked').toBe(false);
  const closed = pip.waitForEvent('close');
  await control.click().catch((e: Error) => {
    if (!/has been closed/.test(e.message)) throw e;
  });
  await closed;
}

/** Press a key that closes the PiP window it's pressed in (same tolerance as `clickClosingPip`). */
export async function pressClosingPip(pip: Page, key: string) {
  expect(pip.isClosed(), `the PiP window should still be open before ${key} is pressed in it`).toBe(false);
  const closed = pip.waitForEvent('close');
  await pip.keyboard.press(key).catch((e: Error) => {
    if (!/has been closed/.test(e.message)) throw e;
  });
  await closed;
}

/**
 * Hold a negative: sample `probe` every 100 ms for `ms` and fail the moment it differs from
 * `expected`. Only for "nothing else happens" checks where no positive signal marks the end (a
 * second auto-PiP attempt, a second window, an iframe reload). Prefer waiting for a positive
 * signal; when you use this, say in a comment why a hold is the only option and why `ms` is enough.
 * Note: every probe touches the page and so grants user activation (lib/activation.ts).
 */
export async function expectSteady<T>(probe: () => Promise<T>, expected: T, { ms = 1_000, message = '' } = {}) {
  const until = Date.now() + ms;
  for (;;) {
    const actual: unknown = await probe();
    expect(actual, message || 'should stay unchanged').toEqual(expected);
    if (Date.now() >= until) return;
    await new Promise((r) => setTimeout(r, 100));
  }
}

/**
 * Resolve with the text of the next console message (any page of `page`'s context, PiP windows
 * included) matching `pattern`. Start it BEFORE the action that should log, then await it: a
 * positive signal that the code path ran, instead of reading state that was already right.
 * The watchdog still sees the message; `watchdog.allow` it as usual.
 */
export function consoleMessage(page: Page, pattern: RegExp, timeout = 10_000): Promise<string> {
  const message = page
    .context()
    .waitForEvent('console', { predicate: (m) => pattern.test(m.text()), timeout })
    .then((m) => m.text());
  // If the test fails before awaiting it, the context closes and this rejects: not an unhandled rejection.
  message.catch(() => {});
  return message;
}

/** Close the PiP window the way the OS window button does (fires `pagehide`), and wait for it. */
export async function closePipLikeOS(pip: Page) {
  await pip.close();
}

/**
 * Remember `locator`'s DOM node under `key`, to prove later that the very same node (not a
 * re-created copy) is on screen: V10 of the route-persistent design spec. The node is kept in the
 * opener's window (`window.__e2eNodes`) and tagged `data-e2e-node="<key>"`; a re-created node
 * would carry neither.
 */
export async function markNode(locator: Locator, key: string) {
  await locator.evaluate((el, k) => {
    const w = window as unknown as { __e2eNodes?: Record<string, Element> };
    (w.__e2eNodes ??= {})[k] = el;
    el.setAttribute('data-e2e-node', k);
  }, key);
}

/**
 * Where the node marked `key` is now, judged from the opener: `'opener'` or `'pip'` when it is
 * the SAME node and connected there, `'missing'` when neither document holds that node (it was
 * destroyed or replaced).
 */
export async function nodeWhereabouts(opener: Page, key: string): Promise<'opener' | 'pip' | 'missing'> {
  return opener.evaluate((k) => {
    const w = window as unknown as {
      __e2eNodes?: Record<string, Element>;
      documentPictureInPicture?: { window: Window | null };
    };
    const node = w.__e2eNodes?.[k];
    if (!node || !node.isConnected) return 'missing';
    const selector = `[data-e2e-node="${k}"]`;
    if (document.querySelector(selector) === node) return 'opener';
    const pipDoc = w.documentPictureInPicture?.window?.document;
    if (pipDoc && pipDoc.querySelector(selector) === node) return 'pip';
    return 'missing';
  }, key);
}

export async function expectNodeIn(opener: Page, key: string, where: 'opener' | 'pip') {
  await expect.poll(() => nodeWhereabouts(opener, key), { message: `node "${key}" should be the same node, in the ${where}` }).toBe(where);
}

/** Top of an element in its document's coordinates (so page scrolling doesn't count as a shift). */
export async function documentTop(locator: Locator): Promise<number> {
  return locator.evaluate((el) => el.getBoundingClientRect().top + (el.ownerDocument.defaultView?.scrollY ?? 0));
}

type MediaSample = { time: number; paused: boolean };
const sampleMedia = (media: Locator) =>
  media.evaluate((el: HTMLMediaElement): MediaSample => ({ time: el.currentTime, paused: el.paused }));

/**
 * The media element is playing: not paused, and its `currentTime` moves forward from `after`
 * (default: its current time now). Returns the time it reached. V12 of the design spec.
 */
export async function expectPlaying(media: Locator, after?: number): Promise<number> {
  const start = after ?? (await sampleMedia(media)).time;
  let reached = start;
  await expect
    .poll(
      async () => {
        const s = await sampleMedia(media);
        reached = s.time;
        return !s.paused && s.time > start;
      },
      { message: `media should be playing and advance past ${start.toFixed(2)} s`, timeout: 10_000 },
    )
    .toBe(true);
  return reached;
}

/** Start playback (muted, so autoplay policy can't interfere) and wait until it is really running. */
export async function play(media: Locator, { muted = true } = {}) {
  await media.evaluate(async (el: HTMLMediaElement, m) => {
    el.muted = m;
    await el.play();
  }, muted);
  return expectPlaying(media);
}

export type PipRequest = { width?: number; height?: number; disallowReturnToOpener?: boolean; preferInitialWindowPlacement?: boolean };

/**
 * Record every `documentPictureInPicture.requestWindow(options)` call the page makes, so sizing
 * tests can assert what the LIBRARY asked for, separately from what the window manager granted
 * (Chrome trims a few px, and clamps to the screen). Call before `page.goto`.
 */
export async function recordPipRequests(page: Page) {
  await page.addInitScript(() => {
    const dpip = (window as unknown as { documentPictureInPicture?: { requestWindow(o: unknown): Promise<Window> } }).documentPictureInPicture;
    if (!dpip) return;
    const original = dpip.requestWindow.bind(dpip);
    const w = window as unknown as { __pipRequests: unknown[] };
    w.__pipRequests = [];
    dpip.requestWindow = (options: unknown) => {
      w.__pipRequests.push(JSON.parse(JSON.stringify(options ?? {})));
      return original(options);
    };
  });
}

export const pipRequests = (page: Page) =>
  page.evaluate(() => (window as unknown as { __pipRequests?: PipRequest[] }).__pipRequests ?? []);
