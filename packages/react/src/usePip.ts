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
    // `id` is used for registry only, not passed to createPip factory options.
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

  // Sync option changes to the core instance.
  // MAINTENANCE: If new options are added to PipOptions, add them here too.
  useEffect(() => {
    instance.updateOptions(options);
  }, [
    instance,
    options.width,
    options.height,
    options.preferInitialWindowPlacement,
    options.disallowReturnToOpener,
    options.fixedSize,
    options.copyStyles,
    options.fallback,
    options.fallbackUrl,
    options.forceFallback,
    options.disableVideoPip,
    options.reserveSpace,
    options.centerInPip,
    options.pipBodyStyles,
    options.forwardKeyboardEvents,
    options.forwardPointerEvents,
    options.restoreScroll,
    options.restoreFocus,
    options.onBeforeOpen,
    options.onOpen,
    options.onPipWindowReady,
    options.onClose,
    options.onError
  ]);

  useEffect(() => {
    return () => {
      instance.destroy();
      instanceRef.current = null;
    };
  }, [instance]);

  useLayoutEffect(() => {
    instance.setDefaultElements({
      contentEl: contentRef.current || undefined,
      originEl: originRef.current || undefined,
    });
  }, [instance, contentRef.current, originRef.current]);

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
