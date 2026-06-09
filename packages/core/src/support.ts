export const isSupported = (): boolean => {
  return typeof window !== 'undefined'
    && 'documentPictureInPicture' in window
    && typeof window.documentPictureInPicture?.requestWindow === 'function';
};

/**
 * Returns `true` if the browser supports the classic Video Picture-in-Picture API.
 * (~95% global coverage — Chrome 70+, Edge, Firefox, Safari macOS 14+, iPhone iOS 16+)
 */
export const isVideoPipSupported = (): boolean =>
  typeof document !== 'undefined' && 'pictureInPictureEnabled' in document;

/**
 * Returns `true` if the browser supports WebKit-specific Picture-in-Picture
 * (older Safari versions that use `webkitSetPresentationMode`).
 */
export const isWebkitPipSupported = (): boolean => {
  if (typeof document === 'undefined') return false;
  const v = document.createElement('video') as unknown as Record<string, unknown>;
  return (
    typeof v.webkitSupportsPresentationMode === 'function' &&
    (v.webkitSupportsPresentationMode as (mode: string) => boolean)('picture-in-picture') &&
    typeof v.webkitSetPresentationMode === 'function'
  );
};

/**
 * Returns `true` if any `<video>` element on the page is currently in
 * the classic Video Picture-in-Picture mode.
 */
export const isInVideoPip = (): boolean =>
  typeof document !== 'undefined' && !!document.pictureInPictureElement;

/**
 * Request classic Video Picture-in-Picture on a video element.
 * Fallbacks to WebKit-specific presentation mode or WebKit fullscreen mode if needed.
 */
export const enterVideoPip = async (video: HTMLVideoElement): Promise<void> => {
  if (!video) return;

  // playsinline is required for Picture-in-Picture on Safari/iOS
  if (!video.hasAttribute('playsinline')) {
    video.setAttribute('playsinline', 'true');
  }

  if (video.requestPictureInPicture) {
    await video.requestPictureInPicture();
  } else if (
    typeof (video as any).webkitSupportsPresentationMode === 'function' &&
    (video as any).webkitSupportsPresentationMode('picture-in-picture') &&
    typeof (video as any).webkitSetPresentationMode === 'function'
  ) {
    (video as any).webkitSetPresentationMode('picture-in-picture');
  } else if (typeof (video as any).webkitEnterFullscreen === 'function') {
    (video as any).webkitEnterFullscreen();
  } else {
    throw new Error('Picture-in-Picture is not supported for this video element.');
  }
};

/**
 * Exits classic Video Picture-in-Picture mode on a video element.
 */
export const exitVideoPip = async (video: HTMLVideoElement): Promise<void> => {
  if (!video) return;

  if (document.pictureInPictureElement === video) {
    await document.exitPictureInPicture();
  } else if (
    typeof (video as any).webkitSetPresentationMode === 'function' &&
    (video as any).webkitPresentationMode === 'picture-in-picture'
  ) {
    (video as any).webkitSetPresentationMode('inline');
  } else if (typeof (video as any).webkitExitFullscreen === 'function') {
    (video as any).webkitExitFullscreen();
  }
};
