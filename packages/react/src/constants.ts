/** Restore-animation duration (ms) for the anti-CLS size handoff. */
export const HANDOFF_MS = 200;

/** Eviction lease (ms) for a registry id removed from `PipProvider`'s `registry` prop. */
export const GC_GRACE_MS = 30000;

/** Re-arm delay (ms) when the grace timer fires while a lease is still held. */
export const GC_RECHECK_MS = 5000;

/** Minimum pixel delta below which the restore animation is skipped. */
export const RESTORE_EPSILON_PX = 1;

/** Number of animation frames to defer the duplicate-anchor diagnostic by. */
export const DUPLICATE_ANCHOR_FRAMES = 1;

/** Floor (ms) for any period passed to `useAdaptiveInterval`. */
export const MIN_ADAPTIVE_PERIOD_MS = 250;

/** Default adaptive-interval period (ms) per activity level. `null` means "no timer". */
export const DEFAULT_ACTIVITY_PERIODS: Readonly<Record<
  'active' | 'background' | 'dormant' | 'frozen',
  number | null
>> = Object.freeze({
  active: 1000,
  background: 15000,
  dormant: 60000,
  frozen: null,
});
