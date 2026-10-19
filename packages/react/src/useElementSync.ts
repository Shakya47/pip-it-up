import { useCallback, useRef } from 'react';
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect';

/**
 * Keep a core instance's default elements current, for `<PipWrapper>` and `usePip()`.
 *
 * `sync` (the latest one passed) runs after every commit of the calling component, and again
 * whenever the content's DOM subtree gains or loses nodes. A deps list is not enough: the content
 * changes without the caller re-rendering — a `<video>` a child adds later (core only counts it
 * toward `isSupported` when `setDefaultElements` runs, so Safari kept showing `renderUnsupported`),
 * a sibling `<PipTrigger>` that renders `null` until mounted (the single-child measurement went
 * stale), or, for `<PipWrapper>`, children that first render in a later commit after hydration.
 *
 * `getContent` returns the element to observe (or `null`). Returns `resync`, to call when the
 * content element may have appeared outside the caller's commits (e.g. the shuttle becoming ready).
 * Core merges a no-op patch without notifying anyone, so extra calls are cheap.
 */
export function useElementSync(
  getContent: () => HTMLElement | null,
  sync: () => void
): () => void {
  const syncRef = useRef(sync);
  syncRef.current = sync;
  const getContentRef = useRef(getContent);
  getContentRef.current = getContent;
  const observed = useRef<{ el: HTMLElement; observer: MutationObserver } | null>(null);
  /**
   * The mutation throttle: open while a frame is pending, on the window it was queued on. `dirty`
   * records mutations the open window swallowed; they get one trailing sync when the frame fires.
   */
  const throttle = useRef<{ win: Window; id: number; dirty: boolean } | null>(null);

  const cancelThrottle = useCallback(() => {
    const pending = throttle.current;
    if (!pending) return;
    throttle.current = null;
    try {
      pending.win.cancelAnimationFrame(pending.id);
    } catch {
      // a closed window's frame never fires anyway
    }
  }, []);

  const openThrottle = useCallback((win: Window) => {
    const id = win.requestAnimationFrame(() => {
      const pending = throttle.current;
      throttle.current = null;
      if (!pending?.dirty) return;
      openThrottle(win);
      syncRef.current();
    });
    throttle.current = { win, id, dirty: false };
  }, []);

  const resync = useCallback(() => {
    if (throttle.current) throttle.current.dirty = false; // this sync covers every mutation so far
    syncRef.current();
    const el = getContentRef.current();
    const current = observed.current;
    if (current?.el === el) return;
    current?.observer.disconnect();
    observed.current = null;
    cancelThrottle();
    if (!el || typeof MutationObserver === 'undefined') return;
    // Throttled to one sync per animation frame: content like Monaco mutates constantly, and each
    // sync can run core's `querySelectorAll('video')` support check. The first batch syncs at
    // once (a <video> a child adds shows up without waiting a frame); batches until the next frame
    // share one trailing sync. The frame comes from the window that owns the content now (the PiP
    // window while it is moved there), so a hidden opener tab does not stall it.
    const observer = new MutationObserver(() => {
      const win = el.ownerDocument.defaultView;
      const pending = throttle.current;
      if (pending && pending.win === win && !pending.win.closed) {
        pending.dirty = true;
        return;
      }
      // Queued on a window the content has left (or that closed, so the frame never fires).
      cancelThrottle();
      if (win && typeof win.requestAnimationFrame === 'function') openThrottle(win);
      syncRef.current();
    });
    observer.observe(el, { childList: true, subtree: true });
    observed.current = { el, observer };
  }, [cancelThrottle, openThrottle]);

  // No deps: every commit (and Strict Mode's simulated remount) re-syncs and re-attaches.
  useIsomorphicLayoutEffect(() => {
    resync();
  });

  useIsomorphicLayoutEffect(() => () => {
    observed.current?.observer.disconnect();
    observed.current = null;
    cancelThrottle();
  }, []);

  return resync;
}
