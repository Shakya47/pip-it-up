import type { AutoPipOptions } from './types';

/**
 * The Media Session action Chrome invokes when it decides to grant automatic PiP itself.
 * Not present in TypeScript's `MediaSessionAction` union, so it is applied through a
 * narrowed cast rather than by widening the DOM lib.
 */
const ENTER_PIP_ACTION = 'enterpictureinpicture';

type ActionCapableMediaSession = MediaSession & {
  setActionHandler(action: string, handler: (() => void) | null): void;
};

/**
 * Registers the `enterpictureinpicture` Media Session action.
 *
 * This is the page's *opt-in* to browser-initiated PiP: on origins Chrome considers eligible
 * (camera or microphone in use, an installed PWA, or a user allow-listing the site under
 * `chrome://settings/content/autoPictureInPicture`) the browser calls this handler itself, with
 * no user gesture involved. Without the registration the browser has nothing to call.
 *
 * It only has an effect while a media session exists — that is, while the page is actually
 * playing media. Registering it for a non-media component is inert, not harmful.
 *
 * There is one Media Session per document, so the last registration wins. Register from a single
 * owner per page.
 */
export const registerEnterPipAction = (
  enter: () => unknown | Promise<unknown>
): (() => void) => {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return () => {};
  const session = navigator.mediaSession as ActionCapableMediaSession;
  try {
    session.setActionHandler(ENTER_PIP_ACTION, () => void enter());
  } catch {
    // The action is unsupported in this browser. There is nothing to undo.
    return () => {};
  }
  return () => {
    try {
      session.setActionHandler(ENTER_PIP_ACTION, null);
    } catch {
      /* Unregistering an unsupported action is a no-op, not a failure. */
    }
  };
};

/**
 * Enters Picture-in-Picture automatically when the document becomes hidden — the behaviour
 * YouTube and Google Meet have when you switch tabs.
 *
 * Framework-agnostic. Returns a disposer; call it to stop listening.
 *
 * ```ts
 * const stop = createAutoPip(() => video.requestPictureInPicture(), {
 *   when: () => !video.paused,
 * });
 * ```
 *
 * ## Why this can fail, and when
 *
 * Both `HTMLVideoElement.requestPictureInPicture()` and
 * `documentPictureInPicture.requestWindow()` require *transient user activation*. Two things
 * about it decide whether auto-PiP works, and both are measurable:
 *
 * 1. **Activation is time-based and survives across tasks.** A gesture stays live for roughly
 *    five seconds, so a `visibilitychange` listener — which by definition runs long after the
 *    click or keystroke that armed it — still holds it. Deferring the call does not lose it.
 * 2. **A successful call consumes it.** You get one attempt per gesture. Any subsequent attempt
 *    fails with `NotAllowedError` until the user interacts again.
 *
 * So auto-PiP succeeds whenever the user interacted with the page shortly before leaving it,
 * which is the overwhelmingly common case: click play then switch tabs, or type then switch
 * tabs. It fails if the page has sat untouched for longer than the activation window — unless
 * the origin is auto-PiP eligible, in which case `mediaSession: true` lets the browser trigger
 * it with no gesture at all.
 *
 * `onResult` reports which of those happened, so this is observable rather than mysterious.
 *
 * ## Boundary
 *
 * This fires on `visibilitychange`, which covers switching tabs and minimising the window. It
 * does **not** fire when you switch to another application while the browser window stays
 * visible, because the document is not hidden then — it is merely unfocused.
 */
export const createAutoPip = (
  enter: () => unknown | Promise<unknown>,
  options: AutoPipOptions = {}
): (() => void) => {
  if (typeof document === 'undefined') return () => {};

  const { when, onResult, mediaSession = false, signal } = options;
  if (signal?.aborted) return () => {};

  const attempt = async (): Promise<void> => {
    if (document.visibilityState !== 'hidden') return;
    if (when && !when()) return;

    // Read this *before* the call, because a successful call consumes it. It is the single most
    // useful thing to report: a rejection with `hadActivation: false` is the expected, benign
    // outcome, while one with `hadActivation: true` points at a real problem in `enter`.
    const hadActivation = navigator.userActivation?.isActive ?? false;

    try {
      await enter();
      onResult?.({ ok: true, grantedBy: hadActivation ? 'gesture' : 'browser' });
    } catch (error) {
      onResult?.({ ok: false, error: error as Error, hadActivation });
    }
  };

  const unregisterAction = mediaSession ? registerEnterPipAction(enter) : undefined;

  // Every listener in this package is signal-bound, so that one abort can never leave one
  // attached. The local controller is the single source of truth; an externally supplied
  // `signal` is chained into it, which lets a caller tie auto-PiP to a lifetime it already has
  // (a `PipInstance`'s destroy signal, say) instead of tracking this disposer separately.
  const controller = new AbortController();
  const stop = () => {
    controller.abort();
    unregisterAction?.();
  };

  document.addEventListener('visibilitychange', attempt, { signal: controller.signal });
  signal?.addEventListener('abort', stop, { once: true, signal: controller.signal });

  return stop;
};
