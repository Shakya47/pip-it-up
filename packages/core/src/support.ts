export const isSupported = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  return 'documentPictureInPicture' in window && window.documentPictureInPicture !== undefined;
};
