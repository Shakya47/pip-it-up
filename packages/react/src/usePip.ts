"use client";

import { useRef, useEffect, useSyncExternalStore } from 'react';
import { createPip, registerPip, unregisterPip } from '@pip-it-up/core';
import type { PipOptions, PipInstance, PipState } from '@pip-it-up/core';
import { bridgeReactEvents } from './reactEventBridge';
import { useElementSync } from './useElementSync';
import { setErrorHandledProbe } from './errors';

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
      // Compare-and-delete (MAINTENANCE_GUIDE §10): only remove the registration if it is still ours.
      return () => unregisterPip(options.id!, instance);
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

  // Lets <PipTrigger pipId> skip its own warning when onError already reports open failures.
  const onErrorRef = useRef(options.onError);
  onErrorRef.current = options.onError;
  useEffect(() => setErrorHandledProbe(instance, () => !!onErrorRef.current), [instance]);

  // Teardown is DEFERRED by one macrotask and cancelled if the component mounts again first
  // (MAINTENANCE_GUIDE §2). React Strict Mode simulates an unmount by re-running effects WITHOUT
  // re-rendering, so a synchronous destroy() left the hook holding a terminal instance: the first
  // open() failed with ERR_DESTROYED until some unrelated re-render created a new one. A real
  // unmount is not followed by a mount, so it still tears down, one macrotask later.
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
        if (mountedRef.current) return; // remounted (Strict Mode): keep the instance
        instance.destroy();
        if (instanceRef.current === instance) instanceRef.current = null;
      }, 0);
    };
  }, [instance]);

  // After every commit and whenever the content's DOM changes (useElementSync). A deps list of
  // `ref.current` values is read during render, before the refs attach, so it went stale; and a
  // <video> added later inside the content never reached core's isSupported.
  useElementSync(
    () => contentRef.current,
    () => {
      instance.setDefaultElements({
        contentEl: contentRef.current || undefined,
        originEl: originRef.current || undefined,
      });
    }
  );

  const state = useSyncExternalStore(
    instance.subscribe,
    instance.getState,
    emptyGetState
  );

  // The content is MOVED, not portalled, so React's delegated listeners don't hear events inside
  // PiP. Bridge them to the container that owns the node (reactEventBridge.ts).
  useEffect(() => {
    const content = contentRef.current;
    if (!state.pipWindow || !content) return;
    return bridgeReactEvents(state.pipWindow.document, content);
  }, [state.pipWindow]);

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
