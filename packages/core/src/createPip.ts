import { isSupported } from './support';
import { copyStylesOnce, startStylesSync } from './styles';
import { applyMoveMode, applyCloneMode } from './dom-modes';
import { startKeyboardBridge } from './keyboard-bridge';
import { snapshotScrollFocus } from './focus-scroll';
import { attachFixedSizeGuard } from './fixed-size';
import { executeFallback } from './fallback';
import type { PipOptions, PipInstance, PipState } from './types';

let idCounter = 0;

export const createPip = (options: PipOptions = {}): PipInstance => {
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

    if (state.pipWindow && !state.pipWindow.closed) {
      state.pipWindow.close();
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

    if (!state.isSupported || options.forceFallback) {
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
    },
    destroy: () => {
      close();
      listeners.clear();
    },
  };


  return instance;
};
