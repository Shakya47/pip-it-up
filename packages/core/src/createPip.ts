import { isSupported, isVideoPipSupported, isWebkitPipSupported, enterVideoPip, exitVideoPip } from './support';
import { copyStylesOnce, startStylesSync } from './styles';
import { applyMoveMode, applyCloneMode } from './dom-modes';
import { startKeyboardBridge } from './keyboard-bridge';
import { startPointerBridge } from './pointer-bridge';
import { snapshotScrollFocus } from './focus-scroll';
import { attachFixedSizeGuard } from './fixed-size';
import { executeFallback, resolveFallbackUrl } from './fallback';
import { CLOSE_POLL_MS } from './constants';
import { mergeElements, ELEMENT_SLOTS } from './elements';
import type { PipOpenErrorCode, PipOptions, PipInstance, PipState, PipElements, ElementPatch, ElementSlot, ElementRegistration, PipTeardownHook } from './types';

const INERT_REGISTRATION: ElementRegistration = Object.freeze({
  released: true,
  update() {},
  release() {},
});

const findSingleVideo = (el?: HTMLElement): HTMLVideoElement | null => {
  if (!el) return null;
  if (el.tagName === 'VIDEO') return el as HTMLVideoElement;
  const videos = el.querySelectorAll('video');
  return videos.length === 1 ? videos[0] : null;
};

/** Errors core itself rejects open() with. Tagged like the React package's PipError messages. */
const pipError = (code: PipOpenErrorCode, message: string, name = 'PipError'): Error =>
  Object.assign(new Error(`[pip-it-up] ${code}: ${message}`), { name, code });

const abortError = () =>
  pipError('ERR_OPEN_ABORTED', 'cancelled by close() or destroy().', 'AbortError');

const isAbort = (err: unknown): boolean =>
  !!err && (err as { code?: unknown }).code === 'ERR_OPEN_ABORTED';

let idCounter = 0;

export const createPip = (initOptions: PipOptions = {}): PipInstance => {
  const options = { ...initOptions };
  const id = options.id || `pip-instance-${++idCounter}`;
  
  /**
   * `state.isSupported`: will open() actually DO something for this instance? True with Document
   * PiP; without it, true when the automatic video fallback applies (exactly one <video> in the
   * content and a video PiP API) or a usable `fallback` is configured (a function, or 'new-tab'
   * with a valid fallbackUrl). <PipTrigger>
   * shows `renderUnsupported` when this is false.
   */
  const canOpen = (elements: PipElements): boolean => {
    if (isSupported() && !options.forceFallback) return true;
    const video = !options.disableVideoPip ? findSingleVideo(elements.contentEl) : null;
    if (video && (isVideoPipSupported() || isWebkitPipSupported())) return true;
    const fallback = options.fallback;
    if (typeof fallback === 'function') return true;
    // 'new-tab' without a valid URL opens nothing; open() rejects with ERR_INVALID_FALLBACK.
    return fallback === 'new-tab' && resolveFallbackUrl(options).ok;
  };

  let state: PipState = {
    isOpen: false,
    isSupported: canOpen({}),
    pipWindow: null,
  };

  const listeners = new Set<() => void>();
  const elementListeners = new Set<() => void>();
  const teardownHooks = new Set<PipTeardownHook>();
  const disposers: Array<() => void> = [];
  const lifetimeController = new AbortController();
  /** Aborted by `cleanup()`. One controller per open session; a fresh one per `open()`. */
  let sessionController: AbortController | null = null;
  let defaultElements: PipElements = {};
  let destroyed = false;
  let isOpening = false;
  // Re-entrancy guard. `pipWindow.close()` fires `pagehide` synchronously, which routes back into
  // close(). A dedicated flag is used instead of mutating `state.isOpen` directly, because
  // `getState()` returns `state` by reference and React holds it as a useSyncExternalStore
  // snapshot; mutating it in place changes React's snapshot without notifying React.
  let isClosing = false;
  /** Bumped by open() and by a close()/destroy() that cancels a pending open. */
  let openToken = 0;
  /** The contentEl of the current session, which may differ from the default slot. */
  let sessionContentEl: HTMLElement | undefined;

  const notifyElementListeners = () => {
    elementListeners.forEach((fn) => fn());
  };

  const updateState = (newState: Partial<PipState>) => {
    state = { ...state, ...newState };
    listeners.forEach((fn) => fn());
  };

  const refreshSupport = () => {
    const next = canOpen(defaultElements);
    if (next !== state.isSupported) updateState({ isSupported: next });
  };

  const commitElements = (next: PipElements) => {
    // A no-op merge still re-checks support: the slot is the same node, but a <video> added inside
    // it since the last commit changes what open() can do (Safari's video-only fallback).
    if (next === defaultElements) {
      refreshSupport();
      return;
    }
    defaultElements = next;
    notifyElementListeners();
    refreshSupport();
  };

  const registerElements = (patch: ElementPatch): ElementRegistration => {
    if (destroyed) return INERT_REGISTRATION;

    const claims = new Map<ElementSlot, HTMLElement>();
    let released = false;

    const apply = (next: ElementPatch) => {
      if (released || destroyed) return;
      for (const slot of ELEMENT_SLOTS) {
        if (!(slot in next)) continue;
        const value = next[slot];
        if (value === undefined) continue;
        if (value === null) {
          claims.delete(slot);
          continue;
        }
        claims.set(slot, value);
      }
      commitElements(mergeElements(defaultElements, next));
    };

    apply(patch);

    return {
      get released() {
        return released;
      },
      update: apply,
      release: () => {
        if (released) return;
        released = true;
        const revert: ElementPatch = {};
        let any = false;
        for (const [slot, node] of claims) {
          if (defaultElements[slot] === node) {
            revert[slot] = null;
            any = true;
          }
        }
        claims.clear();
        if (any) {
          commitElements(mergeElements(defaultElements, revert));
        }
      },
    };
  };

  const cleanup = () => {
    while (disposers.length > 0) {
      const dispose = disposers.pop();
      if (dispose) {
        // Leak vector L2: a throwing disposer must not abandon the rest of the LIFO stack.
        try {
          dispose();
        } catch (err) {
          console.error('[pip-it-up] disposer failed:', err);
        }
      }
    }
  };

  /**
   * Runs every teardown hook synchronously, LIFO, each isolated.
   *
   * Snapshot-then-reverse is mandatory: a hook may unregister itself or another hook during the
   * run, and mutating a Set mid-iteration would skip entries.
   *
   * Isolation is mandatory: one consumer's repatriation failure must never abandon the window,
   * strand the isOpening gate, or skip the remaining hooks. Mirrors cleanup()'s per-disposer
   * try/catch (MAINTENANCE_GUIDE Section 5).
   */
  const runTeardownHooks = (pipWindow: Window | null): void => {
    for (const hook of Array.from(teardownHooks).reverse()) {
      try {
        hook(pipWindow);
      } catch (err) {
        console.error('[pip-it-up] teardown hook failed:', err);
      }
    }
  };

  const registerTeardown = (fn: PipTeardownHook) => {
    if (destroyed) return () => {};
    teardownHooks.add(fn);
    return () => {
      teardownHooks.delete(fn);
    };
  };

  /**
   * Reports an open() failure without letting the notification replace it. A throwing `onError`
   * used to become the rejection reason, and the caller lost the original browser error.
   */
  const reportError = (err: unknown) => {
    if (!options.onError) return;
    try {
      options.onError(err as Error);
    } catch (handlerErr) {
      console.error('[pip-it-up] onError threw:', handlerErr);
    }
  };

  const close = () => {
    if (isClosing) return;
    if (!state.isOpen) {
      // close() or destroy() while open() is still awaiting (onBeforeOpen, requestWindow, the video
      // PiP request) cancels that open: it used to finish anyway and leave a window nobody asked
      // for. Bumping the token is all that happens here; the pending open() notices after its
      // await, closes whatever arrived and rejects with ERR_OPEN_ABORTED. `isOpening` stays set
      // until then, so a new open() cannot overlap the pending requestWindow (Section 5).
      if (isOpening) openToken++;
      return;
    }
    isClosing = true;
    isOpening = false;
    try {
      const pipWindow = state.pipWindow;
      runTeardownHooks(pipWindow);

      if (pipWindow && !pipWindow.closed) {
        pipWindow.close();
      }

      const contentEl = sessionContentEl ?? defaultElements.contentEl;
      const video = !options.disableVideoPip ? findSingleVideo(contentEl) : null;
      if (video) {
        exitVideoPip(video).catch(() => {});
      }

      cleanup();
      sessionContentEl = undefined;
      updateState({ isOpen: false, pipWindow: null });

      if (options.onClose) {
        options.onClose();
      }
    } finally {
      isClosing = false;
    }
  };

  const open = async (elements?: { contentEl?: HTMLElement; originEl?: HTMLElement }) => {
    if (destroyed) {
      console.warn('[pip-it-up] ERR_DESTROYED: open() called on a destroyed instance.');
      return;
    }
    if (state.isOpen || isOpening) return;
    
    isOpening = true;
    const token = ++openToken;
    const isStale = () => token !== openToken || destroyed;
    // Once this session is open, a synchronous state subscriber or `onOpen` may close it (and even
    // start a new open) before open() returns. Everything after that point belongs to a closed
    // session: calling onOpen after onClose, scheduling onPipWindowReady on a closed window, or
    // pushing a disposer onto the emptied stack (it would leak into the next session).
    let sessionOpened = false;
    const sessionEnded = () => !state.isOpen || token !== openToken;
    const contentEl = elements?.contentEl ?? defaultElements.contentEl;
    // The origin passed to THIS call; it wins over the default slot for the whole session.
    const callOriginEl = elements?.originEl;
    const originEl = callOriginEl ?? defaultElements.originEl;
    // Last-resort restore target for move mode: where the content lived when the window opened.
    const openParent = contentEl?.parentElement ?? undefined;
    const mode = options.mode || 'move';
    sessionContentEl = contentEl;

    // Everything a failed or cancelled open must undo. Set as soon as it exists.
    let pipWindow: Window | null = null;
    let enteredVideo: HTMLVideoElement | null = null;

    try {
      const docPipSupported = isSupported();
      if (!docPipSupported || options.forceFallback) {
        const video = !options.disableVideoPip ? findSingleVideo(contentEl) : null;
        const hasVideoPipSupport = isVideoPipSupported() || isWebkitPipSupported();
        let videoError: unknown = null;
        let videoFailed = false;

        if (video && hasVideoPipSupport) {
          try {
            await enterVideoPip(video);
          } catch (err) {
            videoFailed = true;
            videoError = err;
          }
          if (!videoFailed) enteredVideo = video;
          if (isStale()) throw abortError();
        }

        if (enteredVideo) {
          const video = enteredVideo;
          sessionController = new AbortController();
          disposers.push(() => {
            sessionController?.abort();
            sessionController = null;
          });

          // Idempotent: Safari fires `enterpictureinpicture` (and a presentation-mode change) AFTER
          // requestPictureInPicture() has resolved, when this session is already open; reporting
          // it again called onOpen twice for one open (e2e safari.md SF4).
          const handleEnter = () => {
            if (state.isOpen) return;
            updateState({ isOpen: true, pipWindow: null });
            if (options.onOpen) options.onOpen(window);
          };
          const handleLeave = () => {
            close();
          };
          const handleWebKitChange = () => {
            const isPip = (video as any).webkitPresentationMode === 'picture-in-picture';
            if (isPip) {
              handleEnter();
            } else {
              handleLeave();
            }
          };

          // Removed by the session signal (aborted in cleanup), like every other session listener.
          const signal = sessionController.signal;
          video.addEventListener('enterpictureinpicture', handleEnter, { signal });
          video.addEventListener('leavepictureinpicture', handleLeave, { signal });
          video.addEventListener('webkitpresentationmodechanged', handleWebKitChange, { signal });
          video.addEventListener('webkitbeginfullscreen', handleEnter, { signal });
          video.addEventListener('webkitendfullscreen', handleLeave, { signal });

          updateState({ isOpen: true, pipWindow: null });
          sessionOpened = true;
          if (sessionEnded()) return;
          isOpening = false;
          if (options.onOpen) options.onOpen(window);
          return;
        }

        const fallback = options.fallback || 'none';
        if (fallback === 'none') {
          // The video request failed and there is nothing else to try: that is a failure, not
          // "unsupported" (Safari's NotAllowedError without a gesture used to resolve silently).
          if (videoFailed) {
            throw videoError instanceof Error ? videoError : new Error(String(videoError));
          }
          executeFallback(fallback, options, contentEl, originEl); // warns: nothing can open here
          isOpening = false;
          sessionContentEl = undefined;
          return;
        }

        if (videoFailed) {
          console.warn('[pip-it-up] Video PiP open failed, falling back to standard fallback:', videoError);
        }
        if (fallback === 'new-tab') {
          const url = resolveFallbackUrl(options);
          if (!url.ok) {
            throw pipError('ERR_INVALID_FALLBACK', url.reason);
          }
        }
        const fallbackCleanup = executeFallback(fallback, options, contentEl, originEl);
        if (fallbackCleanup) disposers.push(fallbackCleanup);

        updateState({ isOpen: true, pipWindow: null });
        sessionOpened = true;
        if (sessionEnded()) return;
        isOpening = false;
        if (options.onOpen) options.onOpen(window);
        return;
      }

      if (options.onBeforeOpen) {
        const shouldOpen = await options.onBeforeOpen();
        if (shouldOpen === false) {
          isOpening = false;
          sessionContentEl = undefined;
          return;
        }
        if (isStale()) throw abortError();
      }

      sessionController = new AbortController();
      disposers.push(() => {
        sessionController?.abort();
        sessionController = null;
      });

      let restoreFocusScroll: (() => void) | null = null;
      if ((options.restoreScroll !== false || options.restoreFocus !== false) && contentEl) {
         const snap = snapshotScrollFocus(contentEl, {
           restoreScroll: options.restoreScroll !== false,
           restoreFocus: options.restoreFocus !== false,
         });
         restoreFocusScroll = snap.restore;
      }

      let reqWidth = options.width;
      let reqHeight = options.height;

      if ((!reqWidth || !reqHeight) && contentEl) {
        const rect = contentEl.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          reqWidth = reqWidth || Math.max(300, Math.min(1600, Math.round(rect.width)));
          reqHeight = reqHeight || Math.max(200, Math.min(1200, Math.round(rect.height)));
        }
      }

      const width = reqWidth || 900;
      const height = reqHeight || 600;

      pipWindow = await window.documentPictureInPicture!.requestWindow({
        width,
        height,
        disallowReturnToOpener: options.disallowReturnToOpener,
        preferInitialWindowPlacement: options.preferInitialWindowPlacement,
      });
      const win = pipWindow;

      if (isStale()) throw abortError();

      // The window could already be closed by the time the promise resolves (e.g. the browser
      // killed it). That is a failed open: it used to resolve with nothing open and leave the
      // session disposer behind for the next close() to run.
      if (win.closed) {
        throw pipError('ERR_WINDOW_CLOSED', 'the window closed before open() completed.');
      }

      // Removed by the session signal, aborted in cleanup.
      const onPipClose = () => close();
      win.addEventListener('pagehide', onPipClose, { signal: sessionController.signal });
      win.addEventListener('unload', onPipClose, { signal: sessionController.signal });

      // Close-polling fallback: some browsers don't reliably fire `pagehide`
      // or `unload` when the PiP window is closed by the user (e.g., via the
      // OS window chrome). This interval detects `pipWindow.closed` and calls
      // `close()` to trigger cleanup.
      //
      // Re-entrancy safety: `close()` has an early `if (!state.isOpen) return;`
      // guard, so the poll triggering `close()` after it has already been called
      // (via pagehide/unload) is a harmless no-op. The interval itself is
      // cleared inside `cleanup()` via the disposer below.
      const closePollInterval = setInterval(() => {
        if (win.closed) {
          close();
        }
      }, CLOSE_POLL_MS);

      // Leak vector L2: the close-poll interval outlives the window without this.
      disposers.push(() => {
        clearInterval(closePollInterval);
      });

      // Registered BEFORE the move-mode disposer: disposers run LIFO, so focus and scroll are
      // restored only AFTER the content is back in the opener. Restoring first touched nodes still
      // in the PiP document (the input couldn't take focus, and the move back reset the offsets).
      if (restoreFocusScroll) {
        disposers.push(restoreFocusScroll);
      }

      const copyMode = options.copyStyles || 'sync';
      if (copyMode === 'sync') {
        disposers.push(startStylesSync(win));
      } else {
        copyStylesOnce(win);
      }

      if (contentEl && mode === 'move') {
        const reserveSpace = options.reserveSpace !== false;
        disposers.push(applyMoveMode(win, contentEl, {
          // An origin passed to open() wins for this session. Otherwise the live default slot, not
          // a captured value, so an origin registered while the window is open is honoured.
          getOriginEl: () => callOriginEl ?? defaultElements.originEl,
          getFallbackParent: () => openParent,
          reserveSpace,
        }));
      } else if (contentEl && mode === 'clone') {
        disposers.push(applyCloneMode(win, contentEl));
      }

      if (options.pipBodyStyles !== false) {
        const defaultStyles: Partial<CSSStyleDeclaration> = {
          margin: '0',
          padding: '0',
          boxSizing: 'border-box',
          width: options.fixedSize ? `${width}px` : '100%',
          height: options.fixedSize ? `${height}px` : 'auto',
          overflow: options.fixedSize ? 'hidden' : 'auto',
          ...(options.centerInPip ? {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
          } : {})
        };
        const stylesToApply = options.pipBodyStyles || defaultStyles;
        Object.assign(win.document.body.style, stylesToApply);
      }

      if (options.forwardKeyboardEvents !== false) {
        disposers.push(startKeyboardBridge(win, window, sessionController.signal));
      }

      if (options.forwardPointerEvents !== false) {
        disposers.push(startPointerBridge(win, window, sessionController.signal));
      }

      if (options.fixedSize) {
        disposers.push(attachFixedSizeGuard(win, width, height));
      }

      updateState({ isOpen: true, pipWindow: win });
      sessionOpened = true;
      // A subscriber closed it: close() already ran the hooks, the disposers and onClose.
      if (sessionEnded()) return;
      isOpening = false;

      if (options.onOpen) {
        options.onOpen(win);
      }
      if (sessionEnded()) return;

      const rafId = requestAnimationFrame(() => {
        if (options.onPipWindowReady) {
          options.onPipWindowReady(win);
        }
      });
      // Leak vector L11: a pending rAF callback holds the pipWindow reference.
      disposers.push(() => cancelAnimationFrame(rafId));
    } catch (err: unknown) {
      // Undo everything this attempt created, in close()'s order (Section 13): teardown hooks
      // while the document is alive, then the window, then the disposers. A failure after
      // requestWindow resolved (onOpen, styles sync, a bridge) used to reset state but leave the
      // window open with its hooks never run. `isClosing` keeps the window's own pagehide from
      // re-entering close() mid-teardown.
      //
      // A session a subscriber or onOpen already closed was torn down by close(): running the hooks
      // again, or resetting isOpening/sessionContentEl under an open() that close() may have
      // started, would corrupt it. Report and rethrow only.
      if (sessionOpened && sessionEnded()) {
        reportError(err);
        throw err;
      }
      isClosing = true;
      try {
        if (pipWindow) {
          runTeardownHooks(pipWindow);
          if (!pipWindow.closed) pipWindow.close();
        }
        if (enteredVideo) exitVideoPip(enteredVideo).catch(() => {});
        cleanup();
        if (state.isOpen || state.pipWindow) updateState({ isOpen: false, pipWindow: null });
      } finally {
        isClosing = false;
        isOpening = false;
        sessionContentEl = undefined;
      }
      // `onError` is a notification, not a handler that swallows the failure: open() still
      // rejects, so callers (createAutoPip among them) can tell success from failure. It used to
      // resolve whenever onError was set, and auto-PiP reported blocked attempts as successes.
      // A cancellation is not reported: close()/destroy() asked for it.
      if (!isAbort(err)) reportError(err);
      throw err;
    }
  };

  const toggle = async (elements?: { contentEl?: HTMLElement; originEl?: HTMLElement }) => {
    if (state.isOpen) {
      close();
    } else {
      await open(elements);
    }
  };

  const instance: PipInstance = {
    id,
    open,
    close,
    toggle,
    isOpen: () => state.isOpen,
    getPipWindow: () => state.pipWindow,
    subscribe: (fn) => {
      if (destroyed) return () => {};
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getState: () => state,
    setDefaultElements: (elements: Partial<PipElements>) => {
      if (destroyed) return;
      commitElements(mergeElements(defaultElements, elements as ElementPatch));
    },
    /**
     * Merge new options into the stored set.
     *
     * Tri-state semantics, matching element slots (MAINTENANCE_GUIDE Section 10):
     *  - absent key or `undefined` — leave the stored value untouched
     *  - any other value          — overwrite
     *
     * `id` and `mode` are read once at construction and are IGNORED here; changing them after
     * creation would desynchronise the registry key and React's DOM-ownership contract.
     *
     * A caller that truly needs to clear a callback passes a no-op function, or recreates
     * the instance.
     */
    updateOptions: (newOptions) => {
      if (destroyed) return;
      const keys = Object.keys(newOptions) as (keyof PipOptions)[];
      for (const key of keys) {
        if (key === 'id' || key === 'mode') continue; // construction-time only
        const value = newOptions[key];
        if (value === undefined) continue; // no opinion: preserve the stored value
        (options as Record<string, unknown>)[key] = value;
      }
      refreshSupport(); // `fallback` / `disableVideoPip` may have changed what open() can do
    },
    destroy: () => {
      if (destroyed) return;
      close();
      destroyed = true;
      lifetimeController.abort();
      teardownHooks.clear();
      // Leak vector L3: subscriber sets must not outlive the instance.
      listeners.clear();
      elementListeners.clear();
      defaultElements = {};
    },
    registerElements,
    registerTeardown,
    getDefaultElements: () => defaultElements,
    subscribeElements: (fn) => {
      if (destroyed) return () => {};
      elementListeners.add(fn);
      return () => {
        elementListeners.delete(fn);
      };
    },
    get signal() {
      return lifetimeController.signal;
    },
    get destroyed() {
      return destroyed;
    },
  };

  return instance;
};
