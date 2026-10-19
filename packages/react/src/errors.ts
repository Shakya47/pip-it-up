export type PipErrorCode =
  /** <PipAnchor> rendered outside <PipProvider>. Throws in dev AND prod. */
  | 'ERR_NO_PROVIDER'
  /** useDormancy() called outside a registry subtree. Throws in dev AND prod. */
  | 'ERR_NO_HOST'
  /** <PipAnchor id> is not a key of the provider's `registry`. Throws in dev, warns in prod. */
  | 'ERR_UNKNOWN_ID'
  /** Two live anchors claim one id past one animation frame. Warns in dev only. */
  | 'ERR_DUPLICATE_ANCHOR'
  /** A method was called on a destroyed instance. Warns; the call is inert. */
  | 'ERR_DESTROYED'
  /** moveHost exhausted both moveBefore and appendChild. Throws — unrecoverable. */
  | 'ERR_SHUTTLE_MOVE_FAILED'
  /** A portal was attempted during a server render. Throws in dev only. */
  | 'ERR_SSR_PORTAL';

export class PipError extends Error {
  readonly code: PipErrorCode;

  constructor(code: PipErrorCode, message: string) {
    super(`[pip-it-up] ${code}: ${message}`);
    this.name = 'PipError';
    this.code = code;
    // Restores the prototype chain when the package is transpiled to ES5, where
    // `Error` subclassing otherwise loses `instanceof PipError`.
    Object.setPrototypeOf(this, PipError.prototype);
  }
}

/** Emit a code-tagged `console.warn`. Used for recoverable races. */
export function warnPip(code: PipErrorCode, message: string): void {
  console.warn(`[pip-it-up] ${code}: ${message}`);
}

/** `true` when `process.env.NODE_ENV !== 'production'`. Read at call time, never cached. */
export function isDevEnv(): boolean {
  // Written as the literal `process.env.NODE_ENV` so bundlers (Vite, webpack, esbuild, Next)
  // replace it at build time. A `typeof process` guard defeated that: browsers have no `process`,
  // so the guard was always false and every dev-only diagnostic was silently off.
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return false; // no bundler replacement and no `process` (e.g. raw ESM from a CDN): stay quiet
  }
}

/**
 * Instances whose owner (`<PipWrapper>`, `usePip()`) has an `onError` set. Core reports every open
 * failure to `onError` before rejecting, so `<PipTrigger>` reads this to avoid logging a second
 * report of a failure the app already handles. Keyed weakly: no cleanup needed for leaks.
 */
const errorHandledProbes = new WeakMap<object, () => boolean>();

/** Register `probe` for `instance`. Returns a compare-and-delete unregister (MAINTENANCE_GUIDE §10). */
export function setErrorHandledProbe(instance: object, probe: () => boolean): () => void {
  errorHandledProbes.set(instance, probe);
  return () => {
    if (errorHandledProbes.get(instance) === probe) errorHandledProbes.delete(instance);
  };
}

/** `true` when the owner of `instance` handles open failures itself (an `onError` is set). */
export function hasErrorHandler(instance: object): boolean {
  return errorHandledProbes.get(instance)?.() ?? false;
}

/**
 * `true` for the rejection core gives `open()` when `close()` / `destroy()` cancels it while pending
 * (`code: 'ERR_OPEN_ABORTED'`). That is the caller's own doing, not a failure: core skips `onError`
 * for it, and the React wrappers don't log it.
 */
export function isOpenAborted(err: unknown): boolean {
  return !!err && (err as { code?: unknown }).code === 'ERR_OPEN_ABORTED';
}
