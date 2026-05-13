"use client";

import React, { forwardRef, useEffect, useRef, useSyncExternalStore, ElementType, ReactNode, useImperativeHandle } from 'react';
import { createPip } from '@pip-it-up/core';
import type { PipOptions, PipInstance, PipState } from '@pip-it-up/core';
import { PipContext } from './PipContext';
import { PipPortal } from './PipPortal';

export interface PipWrapperProps extends PipOptions {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  as?: ElementType;
  originAs?: ElementType;
  children?: ReactNode;
}

const emptyServerState: PipState = { isOpen: false, isSupported: false, pipWindow: null };
const getServerState = () => emptyServerState;

export const PipWrapper = forwardRef<HTMLElement, PipWrapperProps>((props, ref) => {
  const {
    open: controlledOpen,
    defaultOpen = false,
    onOpenChange,
    as: Component = 'div',
    originAs: OriginComponent = 'div',
    children,
    ...coreOptions
  } = props;

  const contentRef = useRef<HTMLElement>(null);
  const originRef = useRef<HTMLElement>(null);
  const instanceRef = useRef<PipInstance | null>(null);

  useImperativeHandle(ref, () => originRef.current as HTMLElement);

  if (!instanceRef.current) {
    instanceRef.current = createPip(coreOptions);
  }

  const instance = instanceRef.current!;

  useEffect(() => {
    return () => {
      instance.destroy();
    };
  }, [instance]);

  const state = useSyncExternalStore(
    instance.subscribe,
    instance.getState,
    getServerState
  );

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

  useEffect(() => {
    if (isControlled) {
      if (controlledOpen && !state.isOpen) {
        instance.open({ contentEl: contentRef.current || undefined, originEl: originRef.current || undefined });
      } else if (!controlledOpen && state.isOpen) {
        instance.close();
      }
    }
  }, [controlledOpen, isControlled, state.isOpen, instance]);

  const defaultOpenHandled = useRef(false);
  useEffect(() => {
    if (!isControlled && defaultOpen && !defaultOpenHandled.current) {
      defaultOpenHandled.current = true;
      instance.open({ contentEl: contentRef.current || undefined, originEl: originRef.current || undefined });
    }
  }, [defaultOpen, isControlled, instance]);

  const mode = coreOptions.mode || 'move';

  return (
    <PipContext.Provider value={{ instance, state }}>
      <OriginComponent ref={originRef}>
        {mode === 'portal' && state.isOpen && state.pipWindow ? (
           <PipPortal pipWindow={state.pipWindow}>
             <Component ref={contentRef}>
               {children}
             </Component>
           </PipPortal>
        ) : (
          <Component ref={contentRef}>
            {children}
          </Component>
        )}
      </OriginComponent>
    </PipContext.Provider>
  );
});

PipWrapper.displayName = 'PipWrapper';
