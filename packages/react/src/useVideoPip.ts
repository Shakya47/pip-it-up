"use client";

import { useState, useEffect, useCallback } from 'react';
import { enterVideoPip, exitVideoPip } from '@pip-it-up/core';

/**
 * A React hook that controls Picture-in-Picture mode explicitly for a single
 * `<video>` element, supporting standard and iOS/WebKit presentation modes.
 */
export function useVideoPip(ref: React.RefObject<HTMLVideoElement | null>) {
  const [isActive, setIsActive] = useState(false);

  const enter = useCallback(async () => {
    const video = ref.current;
    if (!video) return;
    try {
      await enterVideoPip(video);
    } catch (err) {
      console.warn('[useVideoPip] Failed to enter PiP:', err);
    }
  }, [ref]);

  const leave = useCallback(async () => {
    const video = ref.current;
    if (!video) return;
    try {
      await exitVideoPip(video);
    } catch (err) {
      console.warn('[useVideoPip] Failed to exit PiP:', err);
    }
  }, [ref]);

  const toggle = useCallback(() => {
    return isActive ? leave() : enter();
  }, [isActive, enter, leave]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    // Check initial state
    setIsActive(
      document.pictureInPictureElement === video ||
      (video as any).webkitPresentationMode === 'picture-in-picture'
    );

    const handleEnter = () => setIsActive(true);
    const handleLeave = () => setIsActive(false);
    const handleWebKitChange = () => {
      setIsActive((video as any).webkitPresentationMode === 'picture-in-picture');
    };
    const handleWebKitFullscreenBegin = () => {
      setIsActive(true);
    };
    const handleWebKitFullscreenEnd = () => {
      setIsActive(false);
    };

    video.addEventListener('enterpictureinpicture', handleEnter);
    video.addEventListener('leavepictureinpicture', handleLeave);
    video.addEventListener('webkitpresentationmodechanged', handleWebKitChange);
    video.addEventListener('webkitbeginfullscreen', handleWebKitFullscreenBegin);
    video.addEventListener('webkitendfullscreen', handleWebKitFullscreenEnd);

    return () => {
      video.removeEventListener('enterpictureinpicture', handleEnter);
      video.removeEventListener('leavepictureinpicture', handleLeave);
      video.removeEventListener('webkitpresentationmodechanged', handleWebKitChange);
      video.removeEventListener('webkitbeginfullscreen', handleWebKitFullscreenBegin);
      video.removeEventListener('webkitendfullscreen', handleWebKitFullscreenEnd);
    };
  }, [ref, ref.current]);

  return { isActive, enter, leave, toggle };
}
