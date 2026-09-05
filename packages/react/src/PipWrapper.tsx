"use client";

import React, {
  forwardRef,
  useEffect,
  useRef,
  useState,
  useCallback,
  useSyncExternalStore,
  ElementType,
  ReactNode,
  useImperativeHandle,
} from 'react';
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect';
import { createPip, registerPip, unregisterPip } from '@pip-it-up/core';
import type { PipOptions, PipInstance, PipState } from '@pip-it-up/core';
import { PipContext } from './PipContext';
import { SwitchingPortal } from './SwitchingPortal';
import { getGarage, moveHost } from './garage';

export interface PipWrapperProps extends Omit<PipOptions, 'mode'> {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  as?: ElementType;
  /**
   * Element type for the origin container. Defaults to 'div'.
   * If a custom component is supplied, it must forward its ref (`React.forwardRef`)
   * to receive the origin DOM node.
   */
  originAs?: ElementType;
  children?: ReactNode;
  placeholder?: ReactNode;
  placeholderClassName?: string;
}

const emptyServerState: PipState = { isOpen: false, isSupported: false, pipWindow: null };
const getServerState = () => emptyServerState;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), details, [tabindex]:not([tabindex="-1"])';

const SR_ONLY_STYLE: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: '0',
};

/** Focus the first focusable descendant, or the container itself as a fallback. */
const focusFirstOrContainer = (el: HTMLElement) => {
  const firstFocusable = el.querySelector(FOCUSABLE_SELECTOR) as HTMLElement | null;
  if (firstFocusable) {
    firstFocusable.focus();
  } else {
    if (el.tabIndex === -1 || el.tabIndex === undefined) {
      el.tabIndex = -1;
    }
    el.focus();
  }
};

/**
 * A React wrapper for the Document Picture-in-Picture API.
 * Uses an immortal SwitchingPortal internally to migrate DOM nodes while keeping
 * the React component tree and state intact without remounting.
 */
export const PipWrapper = forwardRef<HTMLElement, PipWrapperProps>((props, ref) => {
  const {
    open: controlledOpen,
    defaultOpen = false,
    onOpenChange,
    as: Component = 'div',
    originAs: OriginComponent = 'div',
    children,
    placeholder,
    placeholderClassName,
    ...coreOptions
  } = props;

  const contentRef = useRef<HTMLElement>(null);
  const [originEl, setOriginEl] = useState<HTMLElement | null>(null);
  const setOriginNode = useCallback((node: HTMLElement | null): void => {
    setOriginEl(node);
  }, []);

  useImperativeHandle(ref, () => originEl as HTMLElement, [originEl]);

  const originElRef = useRef<HTMLElement | null>(null);
  useIsomorphicLayoutEffect(() => {
    originElRef.current = originEl;
  }, [originEl]);

  const instanceRef = useRef<PipInstance | null>(null);

  if (!instanceRef.current) {
    // The React wrapper always uses 'portal' mode at the core level because
    // React handles DOM movement via its own portal system.
    instanceRef.current = createPip({ ...coreOptions, mode: 'portal' });
  }

  const instance = instanceRef.current!;

  const shuttleRef = useRef<HTMLDivElement | null>(null);
  const handleShuttleReady = useCallback((shuttle: HTMLDivElement | null) => {
    if (shuttle) {
      shuttleRef.current = shuttle;
    }
  }, []);

  useEffect(() => instance.registerTeardown(() => {
    const shuttle = shuttleRef.current;
    if (!shuttle) return;
    moveHost(shuttle, originElRef.current ?? getGarage());
  }), [instance]);

  useEffect(() => {
    if (coreOptions.id) {
      registerPip(coreOptions.id, instance);
      return () => {
        unregisterPip(coreOptions.id!, instance);
      };
    }
  }, [coreOptions.id, instance]);

  // Teardown is DEFERRED by one macrotask and cancelled if this component mounts again before
  // it fires.
  //
  // React Strict Mode simulates an unmount by re-running effects (mount -> unmount -> mount)
  // WITHOUT re-rendering. The instance is created in the render body via `if (!instanceRef.current)`
  // and that ref survives the simulated unmount, so a cleanup that destroyed synchronously left
  // the remounted component holding a TERMINAL instance: `destroy()` sets `destroyed`, and
  // `open()` then refuses with ERR_DESTROYED. Every <PipWrapper> in a Strict Mode tree became
  // permanently unable to open.
  //
  // MAINTENANCE_GUIDE Section 2 says to keep the instance in a ref and destroy it in cleanup.
  // That rule predates `destroy()` becoming terminal (CORE-105); deferring restores it, because
  // a real unmount is not followed by a mount and so still tears down on the next macrotask.
  const mountedRef = useRef(false);
  const teardownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    if (teardownTimerRef.current !== null) {
      clearTimeout(teardownTimerRef.current);
      teardownTimerRef.current = null;
    }

    return () => {
      mountedRef.current = false;
      if (teardownTimerRef.current !== null) clearTimeout(teardownTimerRef.current);
      teardownTimerRef.current = setTimeout(() => {
        teardownTimerRef.current = null;
        if (mountedRef.current) return; // remounted (Strict Mode): keep the instance alive
        instanceRef.current?.destroy();
        shuttleRef.current?.remove(); // leak vector L8: the shuttle is owned here
      }, 0);
    };
  }, []);

  const state = useSyncExternalStore(
    instance.subscribe,
    instance.getState,
    getServerState
  );

  useIsomorphicLayoutEffect(() => {
    instance.setDefaultElements({
      contentEl: contentRef.current || undefined,
      originEl: originEl || undefined,
    });
  }, [instance, state.isOpen, originEl]);

  // Sync option changes to the core instance.
  // MAINTENANCE: If new options are added to PipOptions, add them here too.
  useEffect(() => {
    instance.updateOptions({ ...coreOptions, mode: 'portal' });
  }, [
    instance,
    coreOptions.width,
    coreOptions.height,
    coreOptions.preferInitialWindowPlacement,
    coreOptions.disallowReturnToOpener,
    coreOptions.fixedSize,
    coreOptions.copyStyles,
    coreOptions.fallback,
    coreOptions.fallbackUrl,
    coreOptions.forceFallback,
    coreOptions.disableVideoPip,
    coreOptions.reserveSpace,
    coreOptions.centerInPip,
    coreOptions.pipBodyStyles,
    coreOptions.forwardKeyboardEvents,
    coreOptions.forwardPointerEvents,
    coreOptions.restoreScroll,
    coreOptions.restoreFocus,
    coreOptions.onBeforeOpen,
    coreOptions.onOpen,
    coreOptions.onPipWindowReady,
    coreOptions.onClose,
    coreOptions.onError,
  ]);

  const isControlled = controlledOpen !== undefined;
  const prevOpenRef = useRef(state.isOpen);

  useEffect(() => {
    if (state.isOpen !== prevOpenRef.current) {
      if (onOpenChange) {
        onOpenChange(state.isOpen);
      }
      prevOpenRef.current = state.isOpen;
    }
  }, [state.isOpen, onOpenChange]);

  const prevControlledOpenRef = useRef(false);
  useEffect(() => {
    if (isControlled) {
      const changedToOpen = controlledOpen && !prevControlledOpenRef.current;
      const changedToClosed = !controlledOpen && prevControlledOpenRef.current;

      if (changedToOpen && !state.isOpen) {
        if (contentRef.current) {
          // After REACT-305, contentRef.current is the same element in either document.
          // Only width/height may be used (document-independent); top/left are relative
          // to whichever document currently owns the node.
          const rect = contentRef.current.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            lastSizeRef.current = { width: rect.width, height: rect.height };
          }
        }
        instance.open().catch((err) => {
          if (err.name === 'NotAllowedError') {
            console.warn('[PipWrapper] PiP window opening blocked: requires user activation.');
          } else {
            console.error('[PipWrapper] Failed to open PiP window', err);
          }
        });
      } else if (changedToClosed && state.isOpen) {
        instance.close();
      }

      prevControlledOpenRef.current = controlledOpen;
    }
  }, [controlledOpen, isControlled, state.isOpen, instance]);

  const defaultOpenHandled = useRef(false);
  useEffect(() => {
    if (!isControlled && defaultOpen && !defaultOpenHandled.current) {
      defaultOpenHandled.current = true;
      instance.open().catch((err) => {
        if (err.name === 'NotAllowedError') {
          console.warn('[PipWrapper] PiP window defaultOpen blocked: requires user activation.');
        } else {
          console.error('[PipWrapper] Failed to open PiP window via defaultOpen', err);
        }
      });
    }
  }, [defaultOpen, isControlled, instance]);

  const [liveMessage, setLiveMessage] = React.useState('');
  const prevIsOpenForMessageRef = useRef(state.isOpen);

  useEffect(() => {
    if (state.isOpen) {
      setLiveMessage('Content moved to Picture-in-Picture window');
    } else if (prevIsOpenForMessageRef.current) {
      setLiveMessage('Content restored to main window');
    }
    prevIsOpenForMessageRef.current = state.isOpen;
  }, [state.isOpen]);

  useEffect(() => {
    if (state.isOpen && state.pipWindow && contentRef.current) {
      if (typeof state.pipWindow.focus === 'function') {
        state.pipWindow.focus();
      }
      focusFirstOrContainer(contentRef.current);
    }
  }, [state.isOpen, state.pipWindow]);

  useEffect(() => {
    if (prevIsOpenRef.current && !state.isOpen) {
      const timer = setTimeout(() => {
        const activeEl = document.activeElement;
        if (!activeEl || activeEl === document.body) {
          if (contentRef.current) {
            focusFirstOrContainer(contentRef.current);
          }
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [state.isOpen]);

  const defaultPlaceholder = (
    <div
      style={{
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        border: '1px dashed color-mix(in srgb, currentColor 30%, #ccc)',
        borderRadius: 'inherit',
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          marginBottom: '4px',
          fontSize: '0.875rem',
          fontWeight: 500,
          opacity: 0.6,
          textAlign: 'center',
        }}
      >
        📺 In PiP
      </div>
      <button
        onClick={() => instance.close()}
        aria-label="Restore content from Picture-in-Picture"
        style={{
          fontSize: '0.75rem',
          padding: '4px 8px',
          cursor: 'pointer',
          borderRadius: '4px',
          border: '1px solid currentColor',
          background: 'transparent',
          opacity: 0.6,
        }}
      >
        Restore
      </button>
    </div>
  );

  const placeholderContent = placeholder !== undefined ? placeholder : defaultPlaceholder;
  const lastSizeRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    if (!contentRef.current || state.isOpen) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          lastSizeRef.current = {
            width: entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width,
            height: entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height,
          };
        }
      }
    });

    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [state.isOpen]);

  const prevIsOpenRef = useRef(state.isOpen);
  useIsomorphicLayoutEffect(() => {
    if (prevIsOpenRef.current && !state.isOpen && contentRef.current) {
      // After REACT-305, contentRef.current is the same element in either document.
      // Only width/height may be used (document-independent); top/left are relative
      // to whichever document currently owns the node.
      const rect = contentRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        lastSizeRef.current = { width: rect.width, height: rect.height };
      }
    }
    prevIsOpenRef.current = state.isOpen;
  }, [state.isOpen]);

  useIsomorphicLayoutEffect(() => {
    if (state.isOpen && coreOptions.reserveSpace !== false && originEl) {
      const { width, height } = lastSizeRef.current;
      const origin = originEl;

      if (width > 0 && height > 0) {
        origin.style.minWidth = `${width}px`;
        origin.style.minHeight = `${height}px`;
        origin.style.width = `${width}px`;
        origin.style.height = `${height}px`;
        origin.style.display = 'inline-block';
        origin.style.verticalAlign = 'top';

        return () => {
          origin.style.minWidth = '';
          origin.style.minHeight = '';
          origin.style.width = '';
          origin.style.height = '';
          origin.style.display = '';
          origin.style.verticalAlign = '';
        };
      }
    }
  }, [state.isOpen, coreOptions.reserveSpace, instance, originEl]);

  const placeholderNode = (
    <div
      key="placeholder"
      className={placeholderClassName}
      style={{
        width: coreOptions.width ? `${coreOptions.width}px` : '100%',
        height: lastSizeRef.current.height ? `${lastSizeRef.current.height}px` : 'auto',
        display: 'inline-block',
        verticalAlign: 'top',
        boxSizing: 'border-box',
      }}
    >
      {placeholderContent}
    </div>
  );

  return (
    <PipContext.Provider value={{ instance, state, isInsidePip: false }}>
      <div aria-live="polite" aria-atomic="true" style={SR_ONLY_STYLE}>
        {liveMessage}
      </div>
      <OriginComponent ref={setOriginNode} style={{ position: 'relative' }}>
        {state.isOpen && state.pipWindow ? placeholderNode : null}
        <SwitchingPortal
          id={instance.id}
          target={state.isOpen && state.pipWindow ? state.pipWindow.document.body : originEl}
          onShuttleReady={handleShuttleReady}
        >
          <PipContext.Provider value={{ instance, state, isInsidePip: state.isOpen }}>
            <Component ref={contentRef}>{children}</Component>
          </PipContext.Provider>
        </SwitchingPortal>
      </OriginComponent>
    </PipContext.Provider>
  );
});

PipWrapper.displayName = 'PipWrapper';
