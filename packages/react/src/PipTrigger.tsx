"use client";

import React, { forwardRef, useEffect, useState, useSyncExternalStore, useContext } from 'react';
import { getPip, subscribeRegistry } from '@pip-it-up/core';
import type { PipInstance, PipState } from '@pip-it-up/core';
import { PipContext } from './PipContext';
import { useIsPipSupported } from './useIsPipSupported';
import { Slot } from './Slot';

const emptySubscribe = () => () => { };
const emptyServerState: PipState = { isOpen: false, isSupported: false, pipWindow: null };
const emptyGetState = (): PipState => emptyServerState;

export interface PipTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pipId?: string;
  asChild?: boolean;
  openLabel?: string;
  closeLabel?: string;
  renderOpen?: React.ReactNode;
  renderClose?: React.ReactNode;
  renderUnsupported?: React.ReactNode | null;
  hideInPip?: boolean;
}

export const PipTrigger = forwardRef<HTMLElement, PipTriggerProps>((props, ref) => {
  const {
    pipId,
    asChild,
    openLabel = "↗ Pop out",
    closeLabel = "⊠ Close",
    renderOpen,
    renderClose,
    renderUnsupported = null,
    hideInPip = true,
    onClick,
    children,
    ...rest
  } = props;

  const isSupported = useIsPipSupported();
  const context = useContext(PipContext);

  const registrySubscribe = React.useCallback((callback: () => void) => {
    if (!pipId) return () => { };
    return subscribeRegistry(pipId, callback);
  }, [pipId]);

  const getRegistrySnapshot = React.useCallback(() => {
    return pipId ? getPip(pipId) : null;
  }, [pipId]);

  const registryInstance = useSyncExternalStore(
    registrySubscribe,
    getRegistrySnapshot,
    () => null
  );

  const instance = pipId ? registryInstance : context?.instance;

  const subscribe = instance?.subscribe || emptySubscribe;
  const getState = instance?.getState || emptyGetState;

  const state: PipState = useSyncExternalStore(
    subscribe,
    getState,
    emptyGetState
  );

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!instance && pipId && mounted) {
    const Comp = (asChild ? Slot : 'button') as React.ElementType;
    return (
      <Comp
        ref={ref}
        disabled={true}
        style={{ opacity: 0.5, cursor: 'not-allowed' }}
        {...(asChild ? {} : { type: 'button' })}
        {...rest}
      >
        {asChild ? children : (children ?? renderOpen ?? openLabel)}
      </Comp>
    );
  }

  if (!mounted) {
    return null; // SSR safe
  }

  if (!isSupported) {
    if (renderUnsupported === null) return null;
    return <>{renderUnsupported}</>;
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) onClick(e);
    const target = instance ?? context?.instance;
    target?.toggle();
  };

  const isOpen = state.isOpen;

  if (hideInPip && isOpen && !!context) {
    return null;
  }

  const content = isOpen
    ? (renderClose ?? closeLabel)
    : (renderOpen ?? openLabel);

  const Comp = (asChild ? Slot : 'button') as React.ElementType;

  return (
    <Comp
      ref={ref}
      onClick={handleClick}
      {...(asChild ? {} : { type: 'button' })}
      {...rest}
    >
      {asChild ? children : (children ?? content)}
    </Comp>
  );
});

PipTrigger.displayName = 'PipTrigger';
