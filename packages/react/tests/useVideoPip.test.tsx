import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { useVideoPip } from '../src/useVideoPip';

describe('useVideoPip', () => {
  let videoElement: HTMLVideoElement;
  let ref: React.RefObject<HTMLVideoElement | null>;

  beforeEach(() => {
    videoElement = document.createElement('video');
    
    // Mock standard Picture-in-Picture methods
    videoElement.requestPictureInPicture = vi.fn().mockImplementation(async () => {
      Object.defineProperty(document, 'pictureInPictureElement', {
        value: videoElement,
        writable: true,
      });
      const event = new Event('enterpictureinpicture');
      videoElement.dispatchEvent(event);
      return {} as PictureInPictureWindow;
    });

    document.exitPictureInPicture = vi.fn().mockImplementation(async () => {
      Object.defineProperty(document, 'pictureInPictureElement', {
        value: null,
        writable: true,
      });
      const event = new Event('leavepictureinpicture');
      videoElement.dispatchEvent(event);
    });

    ref = { current: videoElement };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with isActive as false', () => {
    const { result } = renderHook(() => useVideoPip(ref));
    expect(result.current.isActive).toBe(false);
  });

  it('enters Video PiP mode successfully', async () => {
    const { result } = renderHook(() => useVideoPip(ref));

    await act(async () => {
      await result.current.enter();
    });

    expect(videoElement.requestPictureInPicture).toHaveBeenCalled();
    expect(result.current.isActive).toBe(true);
    expect(document.pictureInPictureElement).toBe(videoElement);
  });

  it('leaves Video PiP mode successfully', async () => {
    const { result } = renderHook(() => useVideoPip(ref));

    await act(async () => {
      await result.current.enter();
    });
    expect(result.current.isActive).toBe(true);

    await act(async () => {
      await result.current.leave();
    });

    expect(document.exitPictureInPicture).toHaveBeenCalled();
    expect(result.current.isActive).toBe(false);
    expect(document.pictureInPictureElement).toBeNull();
  });

  it('toggles Video PiP mode successfully', async () => {
    const { result } = renderHook(() => useVideoPip(ref));

    await act(async () => {
      await result.current.toggle();
    });
    expect(result.current.isActive).toBe(true);

    await act(async () => {
      await result.current.toggle();
    });
    expect(result.current.isActive).toBe(false);
  });

  it('syncs isActive state on custom events', () => {
    const { result } = renderHook(() => useVideoPip(ref));
    expect(result.current.isActive).toBe(false);

    // Trigger standard enter event manually
    act(() => {
      videoElement.dispatchEvent(new Event('enterpictureinpicture'));
    });
    expect(result.current.isActive).toBe(true);

    // Trigger standard leave event manually
    act(() => {
      videoElement.dispatchEvent(new Event('leavepictureinpicture'));
    });
    expect(result.current.isActive).toBe(false);
  });

  it('syncs isActive state on WebKit custom events', () => {
    const { result } = renderHook(() => useVideoPip(ref));
    expect(result.current.isActive).toBe(false);

    act(() => {
      (videoElement as any).webkitPresentationMode = 'picture-in-picture';
      videoElement.dispatchEvent(new Event('webkitpresentationmodechanged'));
    });
    expect(result.current.isActive).toBe(true);

    act(() => {
      (videoElement as any).webkitPresentationMode = 'inline';
      videoElement.dispatchEvent(new Event('webkitpresentationmodechanged'));
    });
    expect(result.current.isActive).toBe(false);

    act(() => {
      videoElement.dispatchEvent(new Event('webkitbeginfullscreen'));
    });
    expect(result.current.isActive).toBe(true);

    act(() => {
      videoElement.dispatchEvent(new Event('webkitendfullscreen'));
    });
    expect(result.current.isActive).toBe(false);
  });

  it('enter() rejects when the browser refuses, so useAutoPip can report the failure', async () => {
    const refusal = new DOMException('Must be handling a user gesture', 'NotAllowedError');
    videoElement.requestPictureInPicture = vi.fn().mockRejectedValue(refusal);
    const { result } = renderHook(() => useVideoPip(ref));

    await expect(result.current.enter()).rejects.toBe(refusal);
    expect(result.current.isActive).toBe(false);
  });

  it('leave() rejects when exiting fails', async () => {
    const { result } = renderHook(() => useVideoPip(ref));
    await act(async () => {
      await result.current.enter();
    });
    const failure = new DOMException('exit failed', 'InvalidStateError');
    document.exitPictureInPicture = vi.fn().mockRejectedValue(failure);

    await expect(result.current.leave()).rejects.toBe(failure);
  });

  it('toggle() never rejects: a refused request is a console warning, not an unhandled rejection', async () => {
    videoElement.requestPictureInPicture = vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useVideoPip(ref));

    await expect(result.current.toggle()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('[useVideoPip] Failed to enter PiP:', expect.any(DOMException));
  });

  it('enter() rejects when the ref has no <video> attached, so useAutoPip does not report success', async () => {
    const empty: React.RefObject<HTMLVideoElement | null> = { current: null };
    const { result } = renderHook(() => useVideoPip(empty));

    await expect(result.current.enter()).rejects.toMatchObject({ message: expect.stringContaining('[useVideoPip] enter()') });
  });
});
