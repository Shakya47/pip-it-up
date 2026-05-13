"use client";

import { useRef, useEffect, useSyncExternalStore } from 'react';
import { createPip } from '@pip-it-up/core';
import type { PipOptions, PipInstance, PipState } from '@pip-it-up/core';

const emptyServerState: PipState = { isOpen: false, isSupported: false, pipWindow: null };
const emptyGetState = (): PipState => emptyServerState;

export function usePip<T extends HTMLElement = HTMLDivElement>(options: PipOptions = {}) {
  const contentRef = useRef<T>(null);
  const originRef = useRef<T>(null);
  const instanceRef = useRef<PipInstance | null>(null);

  if (!instanceRef.current) {
    instanceRef.current = createPip(options);
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
