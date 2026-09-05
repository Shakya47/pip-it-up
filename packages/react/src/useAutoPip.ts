"use client";

import { useEffect, useRef } from 'react';
import { createAutoPip } from '@pip-it-up/core';
import type { AutoPipOptions, AutoPipResult } from '@pip-it-up/core';
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect';

export interface UseAutoPipOptions extends AutoPipOptions {
  /**
   * Set `false` to suspend without unmounting — useful for a user-facing toggle. Omit it and
   * auto-PiP is simply always on. Default `true`.
   */
  enabled?: boolean;
}

/**
 * Enters Picture-in-Picture automatically when the tab is hidden.
 *
 * Pass whatever should open — `enter` from `useVideoPip` for a bare `<video>`, or
 * `instance.open` from `usePipContext` for a whole component. This hook owns *when* to attempt;
 * the caller owns *what* opens.
 *
 * ```tsx
 * const { enter } = useVideoPip(videoRef);
 * useAutoPip(enter, { when: () => !videoRef.current?.paused });
 * ```
 *
 * See `createAutoPip` in `@pip-it-up/core` for why an attempt can be rejected and what
 * `onResult` reports.
 */
export function useAutoPip(
  enter: () => unknown | Promise<unknown>,
  options: UseAutoPipOptions = {}
): void {
  const { enabled = true, mediaSession = false, when, onResult } = options;

  // Callers pass inline arrows, whose identity changes every render. Reading them through a ref
  // keeps the listener attached across renders instead of detaching and reattaching on each one,
  // while still calling the newest version. Writing the ref in an effect rather than during
  // render keeps the render phase pure.
  const latest = useRef<{
    enter: () => unknown | Promise<unknown>;
    when?: () => boolean;
    onResult?: (result: AutoPipResult) => void;
  }>({ enter, when, onResult });

  useIsomorphicLayoutEffect(() => {
    latest.current = { enter, when, onResult };
  });

  useEffect(() => {
    if (!enabled) return;
    return createAutoPip(() => latest.current.enter(), {
      when: () => latest.current.when?.() ?? true,
      onResult: (result) => latest.current.onResult?.(result),
      mediaSession,
    });
  }, [enabled, mediaSession]);
}
