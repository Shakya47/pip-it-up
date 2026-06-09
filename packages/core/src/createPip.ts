import { isSupported, isVideoPipSupported, isWebkitPipSupported, enterVideoPip, exitVideoPip } from './support';
import { copyStylesOnce, startStylesSync } from './styles';
import { applyMoveMode, applyCloneMode } from './dom-modes';
import { startKeyboardBridge } from './keyboard-bridge';
import { startPointerBridge } from './pointer-bridge';
import { snapshotScrollFocus } from './focus-scroll';
import { attachFixedSizeGuard } from './fixed-size';
import { executeFallback } from './fallback';
import type { PipOptions, PipInstance, PipState } from './types';

const findSingleVideo = (el?: HTMLElement): HTMLVideoElement | null => {
  if (!el) return null;
  if (el.tagName === 'VIDEO') return el as HTMLVideoElement;
  const videos = el.querySelectorAll('video');
  return videos.length === 1 ? videos[0] : null;
};

let idCounter = 0;

export const createPip = (initOptions: PipOptions = {}): PipInstance => {
  let options = { ...initOptions };
  const id = options.id || `pip-instance-${++idCounter}`;
  
  let state: PipState = {
    isOpen: false,
    isSupported: isSupported(),
    pipWindow: null,
  };

  const listeners = new Set<() => void>();
  const disposers: Array<() => void> = [];
  let defaultElements: { contentEl?: HTMLElement; originEl?: HTMLElement } = {};

  const updateState = (newState: Partial<PipState>) => {
    state = { ...state, ...newState };
    listeners.forEach((fn) => fn());
  };

  const cleanup = () => {
    while (disposers.length > 0) {
      const dispose = disposers.pop();
      if (dispose) {
        try {
          dispose();
        } catch (err) {
          console.error('[pip-it-up] disposer failed:', err);
        }
      }
    }
  };

  const close = () => {
    if (!state.isOpen) return;
    isOpening = false;

    if (state.pipWindow && !state.pipWindow.closed) {
      state.pipWindow.close();
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
  };

  let isOpening = false;
  const open = async (elements?: { contentEl?: HTMLElement; originEl?: HTMLElement }) => {
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

          video.addEventListener('enterpictureinpicture', handleEnter);
          video.addEventListener('leavepictureinpicture', handleLeave);
          video.addEventListener('webkitpresentationmodechanged', handleWebKitChange);
          video.addEventListener('webkitbeginfullscreen', handleWebKitFullscreenBegin);
          video.addEventListener('webkitendfullscreen', handleWebKitFullscreenEnd);

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
      pipWindow.addEventListener('pagehide', onPipClose);
      pipWindow.addEventListener('unload', onPipClose);
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
      }, 250);

      disposers.push(() => {
        clearInterval(closePollInterval);
      });

      const copyMode = options.copyStyles || 'sync';
      if (copyMode === 'sync') {
        disposers.push(startStylesSync(pipWindow));
      } else {
        copyStylesOnce(pipWindow);
      }

      if (contentEl && originEl && mode === 'move') {
        const reserveSpace = options.reserveSpace !== false;
        disposers.push(applyMoveMode(pipWindow, contentEl, originEl, reserveSpace));
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
        disposers.push(startKeyboardBridge(pipWindow, window));
      }

      if (options.forwardPointerEvents !== false) {
        disposers.push(startPointerBridge(pipWindow, window));
      }

      if (options.fixedSize) {
        disposers.push(attachFixedSizeGuard(pipWindow, width, height));
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
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getState: () => state,
    setDefaultElements: (elements) => {
      defaultElements = elements;
      if (!isSupported()) {
        const video = !options.disableVideoPip ? findSingleVideo(elements.contentEl) : null;
        const hasVideoPipSupport = isVideoPipSupported() || isWebkitPipSupported();
        updateState({
          isSupported: !!(video && hasVideoPipSupport),
        });
      }
    },
    updateOptions: (newOptions) => {
      options = { ...options, ...newOptions };
    },
    destroy: () => {
      close();
      listeners.clear();
    },
  };

  return instance;
};
