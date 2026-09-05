import {
  type CSSProperties,
  type RefObject,
  useRef,
} from 'react';
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect';
import { useTeleport, type DockedSize } from './PipTeleportContext';
import { RESTORE_EPSILON_PX } from './constants';

export type ReserveMode = 'size' | 'ratio' | 'none';
export type ReserveAxis = 'block' | 'inline' | 'both';

export interface UseLayoutReservationArgs {
  /** Registry id, used to read and write the provider's `lastDockedSize` cache. */
  id: string;
  /** The anchor's own box. Must generate a real box (never `display: contents`). */
  boxRef: RefObject<HTMLElement | null>;
  /** `true` while the content is elsewhere (PiP or garage) and the box must hold space. */
  isReserved: boolean;
  mode: ReserveMode;
  axis: ReserveAxis;
  /** Restore-animation duration in ms. Callers pass `HANDOFF_MS` unless overridden. */
  handoffMs: number;
}

export interface UseLayoutReservationResult {
  /**
   * Style to spread onto the anchor box on EVERY render, including the first.
   * Non-empty on the initial render when the provider cache already holds a size for `id`
   * and the content is not docked. This is what eliminates the 1-frame collapse.
   */
  reservationStyle: CSSProperties;
}

const EMPTY_STYLE: CSSProperties = Object.freeze({});

/** Pure helper: builds the reservation style for a measured size. Exported for direct testing. */
export function buildReservationStyle(
  size: DockedSize,
  mode: ReserveMode,
  axis: ReserveAxis,
): CSSProperties {
  if (mode === 'none') {
    return EMPTY_STYLE;
  }
  if (mode === 'ratio') {
    return {
      aspectRatio: `${size.inlineSize} / ${size.blockSize}`,
    };
  }
  if (mode === 'size') {
    if (axis === 'block') {
      return { minBlockSize: `${size.blockSize}px` };
    }
    if (axis === 'inline') {
      return { minInlineSize: `${size.inlineSize}px` };
    }
    if (axis === 'both') {
      return {
        minBlockSize: `${size.blockSize}px`,
        minInlineSize: `${size.inlineSize}px`,
      };
    }
  }
  return EMPTY_STYLE;
}

export function useLayoutReservation(
  args: UseLayoutReservationArgs,
): UseLayoutReservationResult {
  const { id, boxRef, isReserved, mode, axis, handoffMs } = args;

  const teleport = useTeleport();
  const cached = teleport.getLastDockedSize(id);
  const lastSizeRef = useRef<DockedSize | null>(cached);
  const effectiveSize = isReserved ? (lastSizeRef.current ?? cached) : null;
  const reservationStyle =
    isReserved && effectiveSize && mode !== 'none'
      ? buildReservationStyle(effectiveSize, mode, axis)
      : EMPTY_STYLE;

  const animationRef = useRef<Animation | null>(null);
  const prevReservedRef = useRef(isReserved);

  useIsomorphicLayoutEffect(() => {
    const el = boxRef.current;
    if (!el || mode === 'none') return;
    if (isReserved) return; // NOT observing while reserved

    const ro = new ResizeObserver((observed) => {
      for (const e of observed) {
        const box = e.borderBoxSize?.[0];
        const inlineSize = box?.inlineSize ?? e.contentRect.width;
        const blockSize = box?.blockSize ?? e.contentRect.height;
        if (inlineSize > 0 && blockSize > 0) {
          const size: DockedSize = { inlineSize, blockSize };
          lastSizeRef.current = size;
          teleport.reportDockedSize(id, size);
        }
      }
    });
    ro.observe(el, { box: 'border-box' });
    return () => {
      ro.disconnect();
    };
  }, [id, mode, isReserved, boxRef, teleport]);

  useIsomorphicLayoutEffect(() => {
    const el = boxRef.current;
    const wasReserved = prevReservedRef.current;
    prevReservedRef.current = isReserved;
    if (!el || !wasReserved || isReserved || mode === 'none') return;

    const from = el.getBoundingClientRect().height; // the frozen, reserved size the user sees
    el.style.minBlockSize = '';
    el.style.minInlineSize = '';
    const to = el.getBoundingClientRect().height; // one deliberate reflow for the natural size

    if (Math.abs(to - from) < RESTORE_EPSILON_PX) return;
    if (
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    if (typeof el.animate !== 'function') return; // WAAPI absent: degrade to an instant restore

    const animation = el.animate(
      [{ blockSize: `${from}px` }, { blockSize: `${to}px` }],
      { duration: handoffMs, easing: 'ease-out', fill: 'none' },
    );
    animationRef.current = animation;
    animation.finished
      .then(() => {
        if (animationRef.current === animation) animationRef.current = null;
      })
      .catch(() => {
        /* cancel() rejects; an expected outcome, not an error */
      });
  }, [isReserved, mode, handoffMs, boxRef]);

  useIsomorphicLayoutEffect(
    () => () => {
      animationRef.current?.cancel();
    },
    [],
  );

  return { reservationStyle };
}
