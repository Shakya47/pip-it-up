import './global.d.ts';

export type FallbackMode = "new-tab" | "none" | ((ctx: { contentEl?: HTMLElement; originEl?: HTMLElement; resolvedOptions: PipOptions }) => void);
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
  forwardKeyboardEvents?: boolean;
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

export interface PipInstance {
  id: string;
  open: (elements?: { contentEl?: HTMLElement; originEl?: HTMLElement }) => Promise<void>;
  close: () => void;
  toggle: (elements?: { contentEl?: HTMLElement; originEl?: HTMLElement }) => Promise<void>;
  isOpen: () => boolean;
  getPipWindow: () => Window | null;
  subscribe: (fn: () => void) => () => void;
  getState: () => PipState;
  setDefaultElements: (elements: { contentEl?: HTMLElement; originEl?: HTMLElement }) => void;
  destroy: () => void;
}
