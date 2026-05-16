export const isSupported = (): boolean => {
  return typeof window !== 'undefined'
    && 'documentPictureInPicture' in window
    && typeof window.documentPictureInPicture?.requestWindow === 'function';
};
