declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow(options?: any): Promise<Window>;
      window: Window | null;
      onenter: ((this: Window, ev: Event) => any) | null;
    };
  }
}

export type FallbackMode = "new-tab" | "modal" | "none" | ((ctx: { contentEl?: HTMLElement; originEl?: HTMLElement; options: PipOptions }) => void);
export type DomMode = "move" | "clone" | "portal";
export type CopyStylesMode = "once" | "sync";

export interface PipOptions {
  id?: string;
  width?: number;
  height?: number;
  preferInitialWindowPlacement?: boolean;
  disallowReturnToOpener?: boolean;
  lockAspectRatio?: boolean;
  fixedSize?: boolean;
  copyStyles?: CopyStylesMode;
  mode?: DomMode;
  fallback?: FallbackMode;
  fallbackUrl?: string;
  forwardKeyboardEvents?: boolean;
  restoreScroll?: boolean;
  restoreFocus?: boolean;
  onBeforeOpen?: () => boolean | Promise<boolean>;
  onOpen?: (pipWindow: Window) => void;
  onPipWindowReady?: (pipWindow: Window) => void;
  onClose?: () => void;
  onError?: (err: Error) => void;
  contentEl?: HTMLElement;
  originEl?: HTMLElement;
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
  subscribe: (fn: () => void) => () => void; // React useSyncExternalStore typically subscribes with a no-arg function
  getState: () => PipState;
  destroy: () => void;
}
