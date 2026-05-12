"use client";

import React, { forwardRef, useEffect, useState, useSyncExternalStore, useContext } from 'react';
import { getPip, subscribeRegistry } from '@pip-it-up/core';
import type { PipInstance, PipState } from '@pip-it-up/core';
import { PipContext } from './PipContext';
import { useIsPipSupported } from './useIsPipSupported';
import { Slot } from './Slot';

export interface PipTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pipId?: string;
  asChild?: boolean;
  openLabel?: string;
  closeLabel?: string;
  renderOpen?: React.ReactNode;
  renderClose?: React.ReactNode;
  renderUnsupported?: React.ReactNode | null;
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
    onClick,
    ...rest
  } = props;

  const isSupported = useIsPipSupported();
  const context = useContext(PipContext);

  const [registryInstance, setRegistryInstance] = useState<PipInstance | null>(pipId ? getPip(pipId) : null);

  useEffect(() => {
    if (pipId) {
      const unsub = subscribeRegistry(pipId, () => {
        setRegistryInstance(getPip(pipId));
      });
      return unsub;
    }
  }, [pipId]);

  const instance = pipId ? registryInstance : context?.instance;

  const state: PipState = useSyncExternalStore(
    instance?.subscribe || (() => () => {}),
    instance?.getState || (() => ({ isOpen: false, isSupported: false, pipWindow: null })),
    () => ({ isOpen: false, isSupported: false, pipWindow: null })
  );

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return null; // SSR safe
  }

  if (!isSupported) {
    if (renderUnsupported === null) return null;
    return <>{renderUnsupported}</>;
  }

  if (!instance && pipId) {
    return null; // Waiting for instance to register
  }

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) onClick(e);
    if (instance) {
      await instance.toggle();
    }
  };

  const isOpen = state.isOpen;
  const content = isOpen 
    ? (renderClose ?? closeLabel) 
    : (renderOpen ?? openLabel);

  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      ref={ref as any}
      onClick={handleClick}
      {...(asChild ? {} : { type: 'button' })}
      {...rest}
    >
      {content}
    </Comp>
  );
});

PipTrigger.displayName = 'PipTrigger';
