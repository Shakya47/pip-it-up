import './global.d.ts';

export type FallbackMode = "new-tab" | "none" | ((ctx: { contentEl?: HTMLElement; originEl?: HTMLElement; resolvedOptions: PipOptions }) => (() => void) | void);
export type DomMode = "move" | "clone" | "portal";
export type CopyStylesMode = "once" | "sync";

export interface PipOptions {
  id?: string;
  width?: number;
  height?: number;
  preferInitialWindowPlacement?: boolean;
  disallowReturnToOpener?: boolean;
  fixedSize?: boolean;
  copyStyles?: CopyStylesMode;
  mode?: DomMode;
  fallback?: FallbackMode;
  /**
   * The URL to open in a new tab when `fallback: 'new-tab'` is used.
   *
   * **Security:** This value is validated at runtime — only `http:` and `https:`
   * protocols are allowed (see fallback.ts). However, consumers should still
   * avoid passing unsanitized user input directly, as open-redirect vectors
   * remain possible with valid HTTP URLs.
   */
  fallbackUrl?: string;
  forceFallback?: boolean;
  disableVideoPip?: boolean;
  reserveSpace?: boolean;
  centerInPip?: boolean;
  /**
   * Custom CSS styles applied to the PiP window's `<body>` element via
   * `Object.assign(pipWindow.document.body.style, ...)`. Pass `false` to
   * skip all body styling (including the library's default resets).
   *
   * **Security — trusted input only:** These values are written directly to
   * `CSSStyleDeclaration` without sanitization. Never pass user-supplied or
   * untrusted data here. While modern browsers ignore most malicious CSS
   * (e.g., `expression()`, `behavior: url(...)`), older engines may execute
   * script-bearing values. Always construct these styles from application code.
   */
  pipBodyStyles?: Partial<CSSStyleDeclaration> | false;
  /**
   * Forward `keydown` and `keyup` from the PiP window to the opener `window` so existing
   * keyboard shortcuts keep working while the user is focused in the PiP. Default `true`.
   *
   * **Security:** only user-initiated keystrokes are forwarded; synthetic `dispatchEvent`
   * calls inside the PiP window are ignored (`isTrusted` filter).
   *
   * **Privacy:** forwarded keystrokes carry full key identity (`key`, `code`, and all
   * modifiers) and are visible to EVERY `keydown` listener on the opener `window`, including
   * analytics, hotkey libraries, and session-replay scripts. Set this to `false` when the PiP
   * subtree contains credential, payment, or otherwise sensitive inputs.
   */
  forwardKeyboardEvents?: boolean;
  /**
   * Forward pointer and mouse events from the PiP window to the opener so opener-level gesture
   * and dismissal logic can observe that an interaction happened. Default `true`.
   *
   * **Security:** only user-initiated events are forwarded (`isTrusted` filter).
   *
   * **Coordinates are PiP-viewport relative and MUST NOT be used for opener hit-testing.**
   * A click at (20, 20) in the PiP arrives as (20, 20) in the opener's viewport, which is a
   * different element entirely. The bridge exists so the opener can learn THAT an interaction
   * happened, not WHERE in the opener. Every bridged event carries a non-enumerable
   * `pipItUpBridged: true` marker; guard coordinate-sensitive handlers with it, or set this
   * option to `false`.
   */
  forwardPointerEvents?: boolean;
  restoreScroll?: boolean;
  restoreFocus?: boolean;
  onBeforeOpen?: () => boolean | Promise<boolean>;
  onOpen?: (pipWindow: Window) => void;
  onPipWindowReady?: (pipWindow: Window) => void;
  onClose?: () => void;
  onError?: (err: Error) => void;
}

export interface PipState {
  isOpen: boolean;
  isSupported: boolean;
  pipWindow: Window | null;
}

/** Called synchronously at the top of `close()`, before `pipWindow.close()` and before `cleanup()`. */
export type PipTeardownHook = (pipWindow: Window | null) => void;

export interface PipInstance {
  id: string;
  open: (elements?: { contentEl?: HTMLElement; originEl?: HTMLElement }) => Promise<void>;
  close: () => void;
  toggle: (elements?: { contentEl?: HTMLElement; originEl?: HTMLElement }) => Promise<void>;
  isOpen: () => boolean;
  getPipWindow: () => Window | null;
  subscribe: (fn: () => void) => () => void;
  getState: () => PipState;
  setDefaultElements: (elements: Partial<PipElements>) => void;
  updateOptions: (options: PipOptions) => void;
  destroy: () => void;

  /** Tri-state slot registration returning a compare-and-clear handle. */
  registerElements: (patch: ElementPatch) => ElementRegistration;
  /** Referentially-stable accessor for the merged slot state. Safe as a useSyncExternalStore snapshot. */
  getDefaultElements: () => PipElements;
  /** Subscribe to slot changes only. Narrower than `subscribe`, which fires on all state changes. */
  subscribeElements: (fn: () => void) => () => void;

  /**
   * Register a hook run synchronously at the very top of `close()`, LIFO, before
   * `pipWindow.close()` and before `cleanup()`. Intended for DOM repatriation that must
   * complete while the PiP document is still alive.
   * Hooks are error-isolated: a throwing hook is reported via `console.error` and the
   * remaining hooks still run.
   * @returns an unregister function. Idempotent.
   */
  registerTeardown: (fn: PipTeardownHook) => () => void;

  /**
   * Aborted by `destroy()`. Pass to `addEventListener` for leak-proof lifetime binding:
   * the browser removes signal-bound listeners atomically, even if a disposer throws first.
   */
  readonly signal: AbortSignal;
  /** `true` after `destroy()`. Every mutating method is inert afterwards. */
  readonly destroyed: boolean;
}

export interface ElementRegistration {
  /** `true` once `release()` has run. Further `update()` calls are inert. */
  readonly released: boolean;
  /** Re-point one or more slots owned by this registration. Tri-state per ElementPatch. */
  update(patch: ElementPatch): void;
  /** Compare-and-clear: vacate only the slots this registration still owns. Idempotent. */
  release(): void;
}

/** Named DOM slots tracked by a PipInstance. */
export type ElementSlot = 'contentEl' | 'originEl';

/** Fully-resolved slot state. An absent key means the slot is unclaimed. */
export interface PipElements {
  contentEl?: HTMLElement;
  originEl?: HTMLElement;
}

/**
 * Tri-state slot patch.
 * - absent key or `undefined` — no opinion; leave the slot exactly as it is.
 * - `null`                    — explicitly vacate the slot.
 * - `HTMLElement`             — claim the slot.
 */
export type ElementPatch = {
  [K in ElementSlot]?: HTMLElement | null | undefined;
};


/** Outcome of one automatic Picture-in-Picture attempt. See `createAutoPip`. */
export type AutoPipResult =
  | {
      ok: true;
      /**
       * `'gesture'` — a transient user activation was still live and paid for the call.
       * `'browser'` — no activation was live, so the browser granted PiP on its own (an
       * auto-PiP-eligible origin invoking the Media Session action).
       */
      grantedBy: 'gesture' | 'browser';
    }
  | {
      ok: false;
      error: Error;
      /**
       * Whether a transient user activation was live when the attempt was made. `false` with a
       * `NotAllowedError` is the expected outcome for an untouched page; `true` means the
       * gesture was accepted and the failure came from somewhere else.
       */
      hadActivation: boolean;
    };

export interface AutoPipOptions {
  /** Guard evaluated at attempt time. Return `false` to skip. Default: always attempt. */
  when?: () => boolean;
  /** Reports every attempt's outcome, including expected rejections. */
  onResult?: (result: AutoPipResult) => void;
  /**
   * Also register the `enterpictureinpicture` Media Session action, letting the browser trigger
   * PiP itself on eligible origins with no user gesture. Only meaningful while media is
   * playing, and there is one Media Session per document, so enable it from a single owner.
   * Default `false`.
   */
  mediaSession?: boolean;
  /**
   * Stops listening when aborted, as an alternative to calling the returned disposer. Chain an
   * existing lifetime here — a `PipInstance`'s destroy signal, for instance — instead of
   * tracking the disposer separately.
   */
  signal?: AbortSignal;
}
