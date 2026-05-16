/**
 * Global type augmentation for the Document Picture-in-Picture API.
 */
declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow(options?: {
        width?: number;
        height?: number;
        disallowReturnToOpener?: boolean;
        preferInitialWindowPlacement?: boolean;
        lockAspectRatio?: boolean;
      }): Promise<Window>;
      window: Window | null;
      onenter: ((this: Window, ev: Event) => void) | null;
    };
  }
}

export {};
