"use client";

import { useRef, useEffect, useSyncExternalStore, useLayoutEffect } from 'react';
import { createPip, registerPip, unregisterPip } from '@pip-it-up/core';
import type { PipOptions, PipInstance, PipState } from '@pip-it-up/core';

const emptyServerState: PipState = { isOpen: false, isSupported: false, pipWindow: null };
const emptyGetState = (): PipState => emptyServerState;

export function usePip<T extends HTMLElement = HTMLDivElement>(options: PipOptions = {}) {
  const contentRef = useRef<T>(null);
  const originRef = useRef<T>(null);
  const instanceRef = useRef<PipInstance | null>(null);

  if (!instanceRef.current) {
    const { id: _id, ...factoryOptions } = options;
    instanceRef.current = createPip(factoryOptions);
  }

  const instance = instanceRef.current!;

  useEffect(() => {
    if (options.id) {
      registerPip(options.id, instance);
      return () => unregisterPip(options.id!);
    }
  }, [options.id, instance]);

  useEffect(() => {
    return () => {
      instance.destroy();
      instanceRef.current = null;
    };
  }, [instance]);

  useLayoutEffect(() => {
    if (typeof instance.setDefaultElements === 'function') {
      instance.setDefaultElements({
        contentEl: contentRef.current || undefined,
        originEl: originRef.current || undefined,
      });
    }
  // Ref objects are stable (same identity across renders), so deps are effectively [instance].
  }, [instance]);

  const state = useSyncExternalStore(
    instance.subscribe,
    instance.getState,
    emptyGetState
  );

  return {
    contentRef,
    originRef,
    open: () => instance.open({ contentEl: contentRef.current || undefined, originEl: originRef.current || undefined }),
    close: instance.close,
    toggle: () => instance.toggle({ contentEl: contentRef.current || undefined, originEl: originRef.current || undefined }),
    isOpen: state.isOpen,
    isSupported: state.isSupported,
    pipWindow: state.pipWindow,
  };
}
