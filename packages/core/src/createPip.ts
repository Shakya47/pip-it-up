import { isSupported } from './support';
import { registerPip, unregisterPip } from './registry';
import { copyStylesOnce, startStylesSync } from './styles';
import { applyMoveMode, applyCloneMode, applyPortalAnchorMode } from './dom-modes';
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

  const updateState = (newState: Partial<PipState>) => {
    state = { ...state, ...newState };
    listeners.forEach((fn) => fn());
  };

  const cleanup = () => {
    while (disposers.length > 0) {
      const dispose = disposers.pop();
      if (dispose) dispose();
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

  const open = async (elements?: { contentEl?: HTMLElement; originEl?: HTMLElement }) => {
    if (state.isOpen) return;

    const contentEl = elements?.contentEl || options.contentEl;
    const originEl = elements?.originEl || options.originEl;
    const mode = options.mode || 'move';

    if (!state.isSupported) {
      const fallback = options.fallback || 'none';
      executeFallback(fallback, options, contentEl, originEl);
      if (fallback === 'modal') {
        updateState({ isOpen: true, pipWindow: null });
        if (options.onOpen) options.onOpen(window);
      }
      return;
    }

    try {
      if (options.onBeforeOpen) {
        const shouldOpen = await options.onBeforeOpen();
        if (shouldOpen === false) return;
      }

      let restoreFocusScroll: (() => void) | null = null;
      if (options.restoreScroll !== false && options.restoreFocus !== false && contentEl) {
         const snap = snapshotScrollFocus(contentEl);
         restoreFocusScroll = snap.restore;
      }

      const width = options.width || 900;
      const height = options.height || 600;
      const lockAspectRatio = options.lockAspectRatio || options.fixedSize || false;

      // Type cast to any to support TS < 5.4 or DOM libs missing the exact requestWindow definition
      const pipReqOpts: any = {
        width,
        height,
        disallowReturnToOpener: options.disallowReturnToOpener,
        preferInitialWindowPlacement: options.preferInitialWindowPlacement,
        ...(lockAspectRatio ? { lockAspectRatio: true } : {}),
      };

      const pipWindow = await window.documentPictureInPicture!.requestWindow(pipReqOpts);

      pipWindow.addEventListener('pagehide', () => {
        close();
      });

      const copyMode = options.copyStyles || 'sync';
      if (copyMode === 'sync') {
        disposers.push(startStylesSync(pipWindow));
      } else {
        copyStylesOnce(pipWindow);
      }

      if (contentEl && originEl && mode === 'move') {
        disposers.push(applyMoveMode(pipWindow, contentEl, originEl));
      } else if (contentEl && mode === 'clone') {
        disposers.push(applyCloneMode(pipWindow, contentEl));
      } else if (mode === 'portal') {
        disposers.push(applyPortalAnchorMode(pipWindow));
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

      if (options.onOpen) {
        options.onOpen(pipWindow);
      }

      requestAnimationFrame(() => {
        if (options.onPipWindowReady) {
          options.onPipWindowReady(pipWindow);
        }
      });
    } catch (err: any) {
      cleanup();
      updateState({ isOpen: false, pipWindow: null });
      if (options.onError) {
        options.onError(err);
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
    updateElements: (elements) => {
      if (elements.contentEl !== undefined) options.contentEl = elements.contentEl;
      if (elements.originEl !== undefined) options.originEl = elements.originEl;
    },
    destroy: () => {
      close();
      unregisterPip(id);
      listeners.clear();
    },
  };

  if (options.id) {
    registerPip(id, instance);
  }

  return instance;
};
