"use client";

import { useState, useEffect, useCallback } from 'react';
import { enterVideoPip, exitVideoPip } from '@pip-it-up/core';

/**
 * A React hook that controls Picture-in-Picture mode explicitly for a single
 * `<video>` element, supporting standard and iOS/WebKit presentation modes.
 */
export function useVideoPip(ref: React.RefObject<HTMLVideoElement | null>) {
  const [isActive, setIsActive] = useState(false);

  // `enter` and `leave` REJECT when the browser refuses (e.g. `NotAllowedError` without a user
  // gesture), so callers can tell success from failure. `useAutoPip(enter)` depends on this: a
  // resolved `enter()` is reported as `{ ok: true }`, so swallowing the error here made every
  // blocked auto-PiP look like a success. For the same reason, entering with no <video> attached
  // rejects: nothing entered PiP.
  const enter = useCallback(async () => {
    const video = ref.current;
    if (!video) {
      throw new Error('[useVideoPip] enter(): the ref is not attached to a <video> element.');
    }
    await enterVideoPip(video);
  }, [ref]);

  const leave = useCallback(async () => {
    const video = ref.current;
    if (!video) return;
    await exitVideoPip(video);
  }, [ref]);

  // `toggle` is the UI helper (`<button onClick={toggle}>`): it never rejects, so a refused request
  // can't surface as an unhandled rejection from an event handler. It warns instead.
  const toggle = useCallback(async () => {
    try {
      await (isActive ? leave() : enter());
    } catch (err) {
      console.warn(`[useVideoPip] Failed to ${isActive ? 'exit' : 'enter'} PiP:`, err);
    }
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
