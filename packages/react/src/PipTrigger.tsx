"use client";

import React, { forwardRef, useEffect, useState, useSyncExternalStore, useContext } from 'react';
import { getPip, subscribeRegistry } from '@pip-it-up/core';
import type { PipInstance, PipState } from '@pip-it-up/core';
import { PipContext } from './PipContext';
import { Slot } from './Slot';
import { hasErrorHandler, isOpenAborted } from './errors';

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

  // Per instance, not per browser: can THIS instance open anything here (Document PiP, its video
  // fallback, or a configured fallback)? A browser with only video PiP (Safari, Firefox before
  // Document PiP) used to count as supported, so non-video content got a button that did nothing.
  if (!state.isSupported) {
    if (renderUnsupported === null) return null;
    return <>{renderUnsupported}</>;
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) onClick(e);
    // open() rejects when the browser refuses (e.g. NotAllowedError); a click handler has nowhere
    // to send that, so catch it instead of leaving an unhandled rejection. Core has already called
    // onError; when the owner set one, the app handles it, so don't log a second report. An open
    // cancelled by close() while pending (ERR_OPEN_ABORTED) isn't a failure either.
    const target = instance;
    target?.toggle().catch((err: Error) => {
      if (isOpenAborted(err) || hasErrorHandler(target)) return;
      console.warn(`[PipTrigger] Could not open Picture-in-Picture: ${err?.name ?? 'Error'}`, err);
    });
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
      aria-pressed={isOpen}
      {...(asChild ? {} : { type: 'button' })}
      {...rest}
    >
      {asChild ? children : (children ?? content)}
    </Comp>
  );
});

PipTrigger.displayName = 'PipTrigger';
