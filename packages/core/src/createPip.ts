import { isSupported, isVideoPipSupported, isWebkitPipSupported, enterVideoPip, exitVideoPip } from './support';
import { copyStylesOnce, startStylesSync } from './styles';
import { applyMoveMode, applyCloneMode } from './dom-modes';
import { startKeyboardBridge } from './keyboard-bridge';
import { startPointerBridge } from './pointer-bridge';
import { snapshotScrollFocus } from './focus-scroll';
import { attachFixedSizeGuard } from './fixed-size';
import { executeFallback } from './fallback';
import { CLOSE_POLL_MS } from './constants';
import { mergeElements, ELEMENT_SLOTS } from './elements';
import type { PipOptions, PipInstance, PipState, PipElements, ElementPatch, ElementSlot, ElementRegistration, PipTeardownHook } from './types';

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

let idCounter = 0;

export const createPip = (initOptions: PipOptions = {}): PipInstance => {
  const options = { ...initOptions };
  const id = options.id || `pip-instance-${++idCounter}`;
  
  let state: PipState = {
    isOpen: false,
    isSupported: isSupported(),
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

  const notifyElementListeners = () => {
    elementListeners.forEach((fn) => fn());
  };

  const updateState = (newState: Partial<PipState>) => {
    state = { ...state, ...newState };
    listeners.forEach((fn) => fn());
  };

  const refreshSupportForVideoFallback = () => {
    if (!isSupported()) {
      const video = !options.disableVideoPip ? findSingleVideo(defaultElements.contentEl) : null;
      const hasVideoPipSupport = isVideoPipSupported() || isWebkitPipSupported();
      updateState({
        isSupported: !!(video && hasVideoPipSupport),
      });
    }
  };

  const commitElements = (next: PipElements) => {
    if (next === defaultElements) return;
    defaultElements = next;
    notifyElementListeners();
    refreshSupportForVideoFallback();
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

  const close = () => {
    if (!state.isOpen || isClosing) return;
    isClosing = true;
    isOpening = false;
    try {
      const pipWindow = state.pipWindow;
      runTeardownHooks(pipWindow);

      if (pipWindow && !pipWindow.closed) {
        pipWindow.close();
      }

      const contentEl = defaultElements.contentEl;
      const video = !options.disableVideoPip ? findSingleVideo(contentEl) : null;
      if (video) {
        exitVideoPip(video).catch(() => {});
      }

      cleanup();
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
    const contentEl = elements?.contentEl ?? defaultElements.contentEl;
    const originEl = elements?.originEl ?? defaultElements.originEl;
    const mode = options.mode || 'move';

    const docPipSupported = isSupported();
    if (!docPipSupported || options.forceFallback) {
      const video = !options.disableVideoPip ? findSingleVideo(contentEl) : null;
      const hasVideoPipSupport = isVideoPipSupported() || isWebkitPipSupported();

      if (video && hasVideoPipSupport) {
        try {
          await enterVideoPip(video);

          sessionController = new AbortController();
          disposers.push(() => {
            sessionController?.abort();
            sessionController = null;
          });

          const handleEnter = () => {
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
          const handleWebKitFullscreenBegin = () => {
            handleEnter();
          };
          const handleWebKitFullscreenEnd = () => {
            handleLeave();
          };

          video.addEventListener('enterpictureinpicture', handleEnter, { signal: sessionController.signal });
          video.addEventListener('leavepictureinpicture', handleLeave, { signal: sessionController.signal });
          video.addEventListener('webkitpresentationmodechanged', handleWebKitChange, { signal: sessionController.signal });
          video.addEventListener('webkitbeginfullscreen', handleWebKitFullscreenBegin, { signal: sessionController.signal });
          video.addEventListener('webkitendfullscreen', handleWebKitFullscreenEnd, { signal: sessionController.signal });

          disposers.push(() => {
            video.removeEventListener('enterpictureinpicture', handleEnter);
            video.removeEventListener('leavepictureinpicture', handleLeave);
            video.removeEventListener('webkitpresentationmodechanged', handleWebKitChange);
            video.removeEventListener('webkitbeginfullscreen', handleWebKitFullscreenBegin);
            video.removeEventListener('webkitendfullscreen', handleWebKitFullscreenEnd);
          });

          updateState({ isOpen: true, pipWindow: null });
          isOpening = false;
          if (options.onOpen) options.onOpen(window);
          return;
        } catch (err) {
          console.warn('[pip-it-up] Video PiP open failed, falling back to standard fallback:', err);
        }
      }

      isOpening = false;
      const fallback = options.fallback || 'none';
      const fallbackCleanup = executeFallback(fallback, options, contentEl, originEl);
      if (fallbackCleanup) disposers.push(fallbackCleanup);
      
      if (fallback !== 'none') {
        updateState({ isOpen: true, pipWindow: null });
        if (options.onOpen) options.onOpen(window);
      }
      return;
    }

    try {
      if (options.onBeforeOpen) {
        const shouldOpen = await options.onBeforeOpen();
        if (shouldOpen === false) {
          isOpening = false;
          return;
        }
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

      const pipWindow = await window.documentPictureInPicture!.requestWindow({
        width,
        height,
        disallowReturnToOpener: options.disallowReturnToOpener,
        preferInitialWindowPlacement: options.preferInitialWindowPlacement,
      });

      // The window could already be closed by the time the promise resolves
      // (e.g. browser killed it). Bail out to avoid attaching listeners to a dead window.
      if (pipWindow.closed) {
        isOpening = false;
        return;
      }

      const onPipClose = () => close();
      pipWindow.addEventListener('pagehide', onPipClose, { signal: sessionController.signal });
      pipWindow.addEventListener('unload', onPipClose, { signal: sessionController.signal });
      disposers.push(() => {
        pipWindow.removeEventListener('pagehide', onPipClose);
        pipWindow.removeEventListener('unload', onPipClose);
      });

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
        if (pipWindow.closed) {
          close();
        }
      }, CLOSE_POLL_MS);

      // Leak vector L2: the close-poll interval outlives the window without this.
      disposers.push(() => {
        clearInterval(closePollInterval);
      });

      const copyMode = options.copyStyles || 'sync';
      if (copyMode === 'sync') {
        disposers.push(startStylesSync(pipWindow));
      } else {
        copyStylesOnce(pipWindow);
      }

      if (contentEl && mode === 'move') {
        const reserveSpace = options.reserveSpace !== false;
        disposers.push(applyMoveMode(pipWindow, contentEl, {
          getOriginEl: () => defaultElements.originEl, // live binding, not a captured value
          reserveSpace,
        }));
      } else if (contentEl && mode === 'clone') {
        disposers.push(applyCloneMode(pipWindow, contentEl));
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
        Object.assign(pipWindow.document.body.style, stylesToApply);
      }

      if (options.forwardKeyboardEvents !== false) {
        disposers.push(startKeyboardBridge(pipWindow, window, sessionController.signal));
      }

      if (options.forwardPointerEvents !== false) {
        disposers.push(startPointerBridge(pipWindow, window, sessionController.signal));
      }

      if (options.fixedSize) {
        disposers.push(attachFixedSizeGuard(pipWindow, width, height, sessionController.signal));
      }

      if (restoreFocusScroll) {
        disposers.push(restoreFocusScroll);
      }

      updateState({ isOpen: true, pipWindow });
      isOpening = false;

      if (options.onOpen) {
        options.onOpen(pipWindow);
      }

      const rafId = requestAnimationFrame(() => {
        if (options.onPipWindowReady) {
          options.onPipWindowReady(pipWindow);
        }
      });
      // Leak vector L11: a pending rAF callback holds the pipWindow reference.
      disposers.push(() => cancelAnimationFrame(rafId));
    } catch (err: unknown) {
      isOpening = false;
      cleanup();
      updateState({ isOpen: false, pipWindow: null });
      if (options.onError) {
        options.onError(err as Error);
      } else {
        throw err;
      }
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
