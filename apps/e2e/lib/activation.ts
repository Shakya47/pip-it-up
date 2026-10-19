import type { Page } from '@playwright/test';

/**
 * User activation and page visibility: the two browser states Playwright can't drive honestly.
 *
 * 1. EVERY Playwright call that touches a page grants transient user activation, read-only ones
 *    included: `evaluate`, `textContent`, `isVisible`, `title`, `hover`, `click`. Measured on
 *    Chrome 153, Firefox 155 and WebKit 26.6; it expires after about 5 s. `page.goto` doesn't
 *    grant it. So:
 *    - A "blocked without a user gesture" test passes falsely if ANY page call (an `expect` on a
 *      locator included) runs in the ~5 s before the trigger. Use `triggerAfterQuiet`.
 *    - A "works with a gesture" test can't tell a real click from Playwright's own activation.
 *      Claim only "works when activation is present".
 *
 * 2. Playwright can't hide a tab: `visibilitychange` never fires for a second page +
 *    `bringToFront()`, a minimised window, `window.open()`, or a raw CDP background tab, headless
 *    or headed. So a tab switch is simulated in the page: `document.visibilityState` and
 *    `document.hidden` are overridden, then `visibilitychange` is dispatched. That is exactly what
 *    core's auto-PiP (`visibilityState === 'hidden'`) and PipProvider's dormancy store read.
 *
 * 3. Page Lifecycle freeze can't be produced either: CDP `Page.setWebLifecycleState('frozen')` is
 *    a no-op in Chrome 153 (timers keep running, no events). `simulateFreeze` dispatches the
 *    events the way Chromium does: at the Document, non-bubbling (`Event::Create`, see
 *    third_party/blink/renderer/core/dom/document.cc `DispatchFreezeEvent`).
 */

/** Page-side source shared by the helpers below (runs inside the page, so no Playwright import). */
const setVisibility = (state: 'hidden' | 'visible') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => state === 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
};

/**
 * Simulate switching away from the tab (`hidden`) or back (`visible`), now.
 * Note: this call itself grants activation (see 1 above).
 */
export async function simulateTabSwitch(page: Page, state: 'hidden' | 'visible') {
  await page.evaluate(setVisibility, state);
}

/** Undo `simulateTabSwitch`: drop the overrides so the real getters answer again. */
export async function restoreVisibility(page: Page) {
  await page.evaluate(() => {
    delete (document as unknown as Record<string, unknown>).visibilityState;
    delete (document as unknown as Record<string, unknown>).hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

/** Browsers' transient-activation window is ~5 s; a trigger this far out runs after it expired. */
export const QUIET_TRIGGER_MS = 6_500;

/**
 * For "blocked without a gesture" tests: switch the tab away `delayMs` from now, with nothing
 * touching the page in between, and resolve once it has happened.
 *
 * The scheduling `evaluate` grants activation too, but it expires before the timer fires. Node
 * then sleeps with no page calls and no `expect` until the timer is past. This is the ONLY
 * sanctioned sleep in the suite; everything else waits on a condition.
 */
export async function tabSwitchAfterQuiet(page: Page, delayMs = QUIET_TRIGGER_MS) {
  // Inlined rather than reusing `setVisibility`: rebuilding it from source would need
  // `new Function`, which a strict-CSP target page would block.
  await page.evaluate((delay) => {
    setTimeout(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    }, delay);
  }, delayMs);
  await quietWait(delayMs + 1_000);
}

/** Sleep in Node without touching any page. Only for activation-expiry tests (see above). */
export function quietWait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Dispatch Page Lifecycle `freeze` or `resume` the way Chromium does: at the Document, not bubbling. */
export async function simulateFreeze(page: Page, event: 'freeze' | 'resume') {
  await page.evaluate((type) => document.dispatchEvent(new Event(type)), event);
}
