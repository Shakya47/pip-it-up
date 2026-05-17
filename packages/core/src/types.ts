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
  fallbackUrl?: string;
  forceFallback?: boolean;
  reserveSpace?: boolean;
  centerInPip?: boolean;
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
