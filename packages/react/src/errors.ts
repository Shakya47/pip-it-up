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
  return typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
}
