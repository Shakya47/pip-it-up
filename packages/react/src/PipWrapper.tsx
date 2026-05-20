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
}

const emptyServerState: PipState = { isOpen: false, isSupported: false, pipWindow: null };
const getServerState = () => emptyServerState;

/**
 * A React wrapper for the Document Picture-in-Picture API.
 * Uses React Portals internally to migrate DOM nodes while keeping
 * the React component tree and state intact.
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

  useImperativeHandle(ref, () => originRef.current as HTMLElement);

  if (!instanceRef.current) {
    // The React wrapper always uses 'portal' mode at the core level because
    // React handles DOM movement via its own portal system.
    instanceRef.current = createPip({ ...coreOptions, mode: 'portal' });
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
    if (typeof instance.setDefaultElements === 'function') {
      instance.setDefaultElements({
        contentEl: contentRef.current || undefined,
        originEl: originRef.current || undefined,
      });
    }
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
      instance.open().catch(err => {
        if (err.name === 'NotAllowedError') {
          console.warn('[PipWrapper] PiP window defaultOpen blocked: requires user activation.');
        } else {
          console.error('[PipWrapper] Failed to open PiP window via defaultOpen', err);
        }
      });
    }
  }, [defaultOpen, isControlled, instance]);

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
    if (state.isOpen && coreOptions.reserveSpace !== false && originRef.current) {
      const { width, height } = lastSizeRef.current;
      const origin = originRef.current;
      
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
  }, [state.isOpen, coreOptions.reserveSpace, instance]);

  return (
    <PipContext.Provider value={{ instance, state, isInsidePip: false }}>
      <OriginComponent ref={originRef} style={{ display: 'contents' }}>
        {state.isOpen && state.pipWindow ? (
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
