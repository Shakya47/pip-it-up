"use client";

import React, { forwardRef, useEffect, useRef, useSyncExternalStore, ElementType, ReactNode, useImperativeHandle, useLayoutEffect } from 'react';
import { createPip, registerPip, unregisterPip } from '@pip-it-up/core';
import type { PipOptions, PipInstance, PipState } from '@pip-it-up/core';
import { PipContext } from './PipContext';
import { PipPortal } from './PipPortal';

export interface PipWrapperProps extends Omit<PipOptions, 'mode'> {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  as?: ElementType;
  originAs?: ElementType;
  children?: ReactNode;
  placeholder?: ReactNode;
  placeholderClassName?: string;
  /**
   * @deprecated `mode` is not supported in PipWrapper. The React package always
   * uses portal mode internally because React manages its own DOM — vanilla
   * `move`/`clone` modes would conflict with React's reconciler. For clone mode,
   * use the vanilla `createPip()` API directly.
   */
  mode?: PipOptions['mode'];
}

const emptyServerState: PipState = { isOpen: false, isSupported: false, pipWindow: null };
const getServerState = () => emptyServerState;

/**
 * A React wrapper for the Document Picture-in-Picture API.
 *
 * **Important**: The underlying core instance always uses `mode: 'portal'`
 * regardless of any `mode` prop. This is because React handles DOM movement
 * via its own Portal system — using the core's vanilla DOM `move`/`clone`
 * modes would cause `removeChild` errors and reconciliation crashes.
 *
 * **Implication for vanilla interop**: If you register a `<PipWrapper id="foo">`
 * and then call `getPip('foo').open({ contentEl, originEl })` from vanilla JS,
 * the core runs in portal mode — meaning `applyMoveMode` and `applyCloneMode`
 * are skipped. The vanilla caller would get an empty PiP window. For vanilla
 * DOM manipulation, create a separate instance with `createPip()` directly.
 *
 * **Layout note**: The outer wrapper element (`originAs`, defaults to `div`)
 * uses `display: contents` to avoid adding an extra layout box. This means:
 * - `getBoundingClientRect()` on the forwarded ref will return all zeros.
 * - Screen readers may skip the element.
 * If you need to measure the wrapper, measure the inner content element
 * (the `as` element) instead.
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
  const originRef = useRef<HTMLElement>(null);
  const instanceRef = useRef<PipInstance | null>(null);

  // Note: forwardRef is typed as HTMLElement, but originAs can render any element.
  // The `as HTMLElement` cast is technically a lie for non-div origins. We keep
  // HTMLElement as the public type since it covers >99% of usage; making PipWrapper
  // generic (forwardRef<T extends HTMLElement>) would complicate the API.
  useImperativeHandle(ref, () => originRef.current as HTMLElement);

  if (!instanceRef.current) {
    const { id: _id, mode: _mode, ...factoryOptions } = coreOptions;

    if (_mode === 'clone') {
      console.warn(
        '[PipWrapper] mode="clone" is not supported in the React package. ' +
        'PipWrapper always uses portal mode internally. For clone mode, use ' +
        'the vanilla createPip() API directly. Falling back to portal mode.'
      );
    }

    // For React, we always use 'portal' mode at the core level because React
    // handles DOM movement/cloning via its own portal system. Using vanilla
    // move/clone modes would cause removeChild errors during reconciliation.
    // See MAINTENANCE_GUIDE.md section 3.
    instanceRef.current = createPip({ ...factoryOptions, mode: 'portal' });
  }

  const instance = instanceRef.current!;

  useEffect(() => {
    if (coreOptions.id) {
      registerPip(coreOptions.id, instance);
      return () => {
        unregisterPip(coreOptions.id!);
      };
    }
  }, [coreOptions.id, instance]);


  useEffect(() => {
    return () => {
      if (instanceRef.current) {
        instanceRef.current.destroy();
      }
    };
  }, []);

  const state = useSyncExternalStore(
    instance.subscribe,
    instance.getState,
    getServerState
  );

  useLayoutEffect(() => {
    console.log('[PipWrapper] instance:', instance);
    console.log('[PipWrapper] instance.setDefaultElements:', typeof instance.setDefaultElements);
    
    if (typeof instance.setDefaultElements === 'function') {
      instance.setDefaultElements({
        contentEl: contentRef.current || undefined,
        originEl: originRef.current || undefined,
      });
    } else {
      console.error('[PipWrapper] setDefaultElements is MISSING on instance!');
    }
    // state.isOpen is intentionally in deps: when PiP closes, React may
    // recreate DOM nodes as they move back from the portal. We must re-sync
    // the element references so the next open() reads fresh DOM nodes for sizing.
    // See MAINTENANCE_GUIDE.md section 8.
  }, [instance, state.isOpen]);

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
          const rect = contentRef.current.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            lastSizeRef.current = { width: rect.width, height: rect.height };
          }
        }
        instance.open().catch(err => {
          if (err.name === 'NotAllowedError') {
            console.warn('[PipWrapper] PiP window opening blocked: requires user activation. Ensure the "open" prop is changed within a user gesture handler.');
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
      instance.open().catch(err => {
        if (err.name === 'NotAllowedError') {
          console.warn('[PipWrapper] PiP window defaultOpen blocked: requires user activation.');
        } else {
          console.error('[PipWrapper] Failed to open PiP window via defaultOpen', err);
        }
      });
    }
  }, [defaultOpen, isControlled, instance]);

  // mode is only used for JSX branching (placeholder vs normal render).
  // Since clone mode is not supported (see above), we treat everything as portal/move.
  const mode = coreOptions.mode === 'clone' ? 'move' : (coreOptions.mode || 'move');

  const defaultPlaceholder = (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: '1px dashed color-mix(in srgb, currentColor 30%, #ccc)', borderRadius: 'inherit', width: '100%', height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ marginBottom: '4px', fontSize: '0.875rem', fontWeight: 500, opacity: 0.6, textAlign: 'center' }}>📺 In PiP</div>
      <button onClick={() => instance.close()} style={{ fontSize: '0.75rem', padding: '4px 8px', cursor: 'pointer', borderRadius: '4px', border: '1px solid currentColor', background: 'transparent', opacity: 0.6 }}>Restore</button>
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

  // When PiP closes, re-measure the content element so lastSizeRef reflects any
  // size changes that happened while the content was in the PiP window. Without
  // this, the next open would use the stale pre-open size.
  const prevIsOpenRef = useRef(state.isOpen);
  useLayoutEffect(() => {
    if (prevIsOpenRef.current && !state.isOpen && contentRef.current) {
      const rect = contentRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        lastSizeRef.current = { width: rect.width, height: rect.height };
      }
    }
    prevIsOpenRef.current = state.isOpen;
  }, [state.isOpen]);

  useLayoutEffect(() => {
    if ((mode === 'move' || mode === 'portal') && state.isOpen && coreOptions.reserveSpace !== false && originRef.current) {
      const { width, height } = lastSizeRef.current;
      const origin = originRef.current;
      
      if (width > 0 && height > 0) {
        origin.style.minWidth = `${width}px`;
        origin.style.minHeight = `${height}px`;
        origin.style.width = `${width}px`;
        origin.style.height = `${height}px`;
        // Ensure it maintains its place in the layout
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
  }, [mode, state.isOpen, coreOptions.reserveSpace, instance]);

  return (
    <PipContext.Provider value={{ instance, state, isInsidePip: false }}>
      <OriginComponent ref={originRef} style={{ display: 'contents' }}>
        {(mode === 'portal' || mode === 'move') && state.isOpen && state.pipWindow ? (
          <>
            <div
              key="placeholder"
              className={placeholderClassName}
              style={{ 
                width: coreOptions.width ? `${coreOptions.width}px` : '100%', 
                height: lastSizeRef.current.height ? `${lastSizeRef.current.height}px` : 'auto',
                display: 'inline-block',
                verticalAlign: 'top',
                boxSizing: 'border-box' 
              }}
            >
              {placeholderContent}
            </div>
            <PipPortal pipWindow={state.pipWindow}>
              <Component ref={contentRef}>
                {children}
              </Component>
            </PipPortal>
          </>
        ) : (
          <Component key="content" ref={contentRef}>
            {children}
          </Component>
        )}
      </OriginComponent>
    </PipContext.Provider>
  );
});

PipWrapper.displayName = 'PipWrapper';
