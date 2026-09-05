import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type DependencyList,
  type EffectCallback,
} from 'react';
import type { ActivityLevel, HostSnapshot } from './dormancy';
import { useHost } from './PipTeleportContext';
import { isDevEnv } from './errors';
import { DEFAULT_ACTIVITY_PERIODS, MIN_ADAPTIVE_PERIOD_MS } from './constants';

function useDepsLengthInvariant(deps: DependencyList, hookName: string): void {
  const firstLength = useRef<number | null>(null);
  if (!isDevEnv()) return;
  if (firstLength.current === null) {
    firstLength.current = deps.length;
    return;
  }
  if (firstLength.current !== deps.length) {
    console.warn(
      `[pip-it-up] ${hookName}: deps array length changed between renders (${firstLength.current} -> ${deps.length}). This is a rules-of-hooks violation.`
    );
    firstLength.current = deps.length;
  }
}

/** Current activity snapshot for the nearest hosted subtree. Referentially stable until it changes. */
export function useDormancy(): HostSnapshot {
  const host = useHost();
  return useSyncExternalStore(host.subscribe, host.getSnapshot, host.getServerSnapshot);
}

/** Runs `effect` only while `level === 'active'`; cleans up on every exit from active. */
export function useActiveEffect(effect: EffectCallback, deps: DependencyList): void {
  const { level } = useDormancy();
  const isActive = level === 'active';
  useDepsLengthInvariant(deps, 'useActiveEffect');
  useEffect(
    () => {
      if (!isActive) return;
      return effect();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- spreading caller-supplied deps
    [isActive, ...deps],
  );
}

/** Runs `effect` on mount-if-rendered and on every reveal from the garage. */
export function useRevealEffect(effect: EffectCallback): void {
  const { revealCount, placement } = useDormancy();
  const isRendered = placement !== 'garage';
  useEffect(
    () => {
      if (!isRendered) return;
      return effect();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reveal identity is (revealCount, isRendered)
    [revealCount, isRendered],
  );
}

/** Interval whose period follows the activity level. A `null` period means no timer at all. */
export function useAdaptiveInterval(
  callback: () => void,
  periods?: Partial<Record<ActivityLevel, number | null>>,
): void;
export function useAdaptiveInterval(
  callback: () => void,
  periods: Partial<Record<ActivityLevel, number | null>> = {},
): void {
  const { level } = useDormancy();
  const cbRef = useRef(callback);
  useEffect(() => {
    cbRef.current = callback;
  }, [callback]);

  const requested = level in periods ? periods[level] : DEFAULT_ACTIVITY_PERIODS[level];
  const period =
    requested === null || requested === undefined
      ? null
      : Math.max(MIN_ADAPTIVE_PERIOD_MS, requested);

  useEffect(() => {
    if (period === null) return;
    const handle = setInterval(() => {
      cbRef.current();
    }, period);
    return () => {
      clearInterval(handle);
    };
  }, [period]);
}
