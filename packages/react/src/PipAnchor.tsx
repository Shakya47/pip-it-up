import {
  type CSSProperties,
  type ElementType,
  type ReactNode,
  useCallback,
  useRef,
  useSyncExternalStore,
} from 'react';
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect';
import { useTeleport, type Placement } from './PipTeleportContext';
import {
  useLayoutReservation,
  type ReserveAxis,
  type ReserveMode,
} from './useLayoutReservation';
import { HANDOFF_MS } from './constants';
import { PipError, warnPip, isDevEnv } from './errors';

export interface PipAnchorProps {
  /** Must be a key of the provider's `registry` prop. */
  id: string;
  /**
   * `'size'`  freezes the measured border box while the content is away (default).
   * `'ratio'` freezes `aspect-ratio` instead; use for media with a known shape.
   * `'none'`  reserves nothing; the layout is allowed to collapse.
   */
  reserve?: ReserveMode;
  /** Which axis to freeze. Default `'block'`; inline size is normally set by the parent. */
  axis?: ReserveAxis;
  /** Restore-animation duration in ms. Default `HANDOFF_MS` (200). */
  handoffMs?: number;
  /** Rendered while the content is elsewhere. Positioned `absolute; inset: 0`. */
  placeholder?: ReactNode;
  /** Element type for the anchor box. Must generate a real box. Default `'div'`. */
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
}

/** Base style always applied to the anchor box, before the caller's `style`. */
const ANCHOR_BASE_STYLE: CSSProperties = Object.freeze({
  position: 'relative',
  display: 'block',
});

/** Style always applied to the placeholder wrapper. */
const PLACEHOLDER_STYLE: CSSProperties = Object.freeze({
  position: 'absolute',
  inset: 0,
});

export function PipAnchor(props: PipAnchorProps): ReactNode {
  const {
    id,
    reserve,
    axis,
    handoffMs,
    placeholder,
    as,
    className,
    style,
  } = props;

  const teleport = useTeleport();

  useIsomorphicLayoutEffect(() => {
    if (teleport.hasId(id)) return;
    const message = `<PipAnchor id="${id}"> is not a key of <PipProvider registry={...}>. Add it to the registry object.`;
    if (isDevEnv()) throw new PipError('ERR_UNKNOWN_ID', message);
    warnPip('ERR_UNKNOWN_ID', message);
  }, [teleport, id]);

  const subscribe = useCallback(
    (fn: () => void) => teleport.subscribePlacement(id, fn),
    [teleport, id]
  );
  const getPlacement = useCallback(
    () => teleport.getPlacement(id),
    [teleport, id]
  );
  const getServerPlacement = useCallback((): Placement => 'garage', []);
  const placement = useSyncExternalStore(
    subscribe,
    getPlacement,
    getServerPlacement
  );
  const isReserved = placement !== 'anchor';

  const boxRef = useRef<HTMLElement | null>(null);
  const claimedRef = useRef<HTMLElement | null>(null);

  const setBox = useCallback(
    (node: HTMLElement | null) => {
      boxRef.current = node;
      if (node) {
        claimedRef.current = node;
        teleport.claimAnchor(id, node);
      } else {
        teleport.releaseAnchor(id, claimedRef.current);
        claimedRef.current = null;
      }
    },
    [teleport, id]
  );

  const { reservationStyle } = useLayoutReservation({
    id,
    boxRef,
    isReserved,
    mode: reserve ?? 'size',
    axis: axis ?? 'block',
    handoffMs: handoffMs ?? HANDOFF_MS,
  });

  useIsomorphicLayoutEffect(() => {
    if (!isDevEnv()) return;
    const el = boxRef.current;
    if (!el) return;
    const computed = getComputedStyle(el);
    if (computed.display === 'contents') {
      console.warn(
        '[pip-it-up] <PipAnchor> must generate a real box; display: contents disables measurement, the placeholder containing block, and the size reservation.'
      );
    }
    if (computed.position === 'static') {
      console.warn(
        '[pip-it-up] <PipAnchor> must be a positioned element; position: static lets the absolutely positioned placeholder escape to the nearest positioned ancestor.'
      );
    }
  }, [placement]);

  const Box = (as ?? 'div') as ElementType;
  return (
    <Box
      ref={setBox}
      data-pip-anchor={id}
      className={className}
      style={{ ...ANCHOR_BASE_STYLE, ...reservationStyle, ...style }}
    >
      {isReserved && placeholder !== undefined ? (
        <div data-pip-placeholder="" style={PLACEHOLDER_STYLE}>
          {placeholder}
        </div>
      ) : null}
    </Box>
  );
}
