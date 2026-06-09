import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { isSupported, isVideoPipSupported, isWebkitPipSupported, isInVideoPip, enterVideoPip, exitVideoPip } from '../src/support';

describe('support', () => {
  let original: unknown;

  beforeEach(() => {
    original = (window as unknown as Record<string, unknown>).documentPictureInPicture;
  });

  afterEach(() => {
    if (original !== undefined) {
      (window as unknown as Record<string, unknown>).documentPictureInPicture = original;
    } else {
      delete (window as unknown as Record<string, unknown>).documentPictureInPicture;
    }
  });

  it('returns true when API is present', () => {
    (window as unknown as Record<string, unknown>).documentPictureInPicture = { requestWindow: () => {} };
    expect(isSupported()).toBe(true);
  });

  it('returns false when API is missing', () => {
    delete (window as unknown as Record<string, unknown>).documentPictureInPicture;
    expect(isSupported()).toBe(false);
  });

  it('returns false when window is undefined (SSR)', () => {
    const originalWindow = global.window;
    try {
      delete (global as unknown as Record<string, unknown>).window;
      
      expect(isSupported()).toBe(false);
    } finally {
      global.window = originalWindow;
    }
  });

  it('isVideoPipSupported checks document.pictureInPictureEnabled', () => {
    const desc = Object.getOwnPropertyDescriptor(document.constructor.prototype, 'pictureInPictureEnabled') ||
                 Object.getOwnPropertyDescriptor(document, 'pictureInPictureEnabled');
    if (desc) {
      delete (document.constructor.prototype as any).pictureInPictureEnabled;
    }
    try {
      Object.defineProperty(document, 'pictureInPictureEnabled', {
        value: true,
        configurable: true,
        writable: true
      });
      expect(isVideoPipSupported()).toBe(true);

      delete (document as any).pictureInPictureEnabled;
      expect(isVideoPipSupported()).toBe(false);
    } finally {
      if (desc) {
        Object.defineProperty(document.constructor.prototype, 'pictureInPictureEnabled', desc);
      }
    }
  });

  it('isWebkitPipSupported detects WebKit PiP support', () => {
    const originalCreateElement = document.createElement;
    const fakeVideo = {
      webkitSupportsPresentationMode: vi.fn().mockReturnValue(true),
      webkitSetPresentationMode: vi.fn(),
    };
    document.createElement = vi.fn().mockImplementation((tag) => {
      if (tag === 'video') return fakeVideo as any;
      return originalCreateElement.call(document, tag);
    });

    try {
      expect(isWebkitPipSupported()).toBe(true);
      
      fakeVideo.webkitSupportsPresentationMode.mockReturnValue(false);
      expect(isWebkitPipSupported()).toBe(false);
    } finally {
      document.createElement = originalCreateElement;
    }
  });

  it('isInVideoPip checks document.pictureInPictureElement', () => {
    const desc = Object.getOwnPropertyDescriptor(document.constructor.prototype, 'pictureInPictureElement') ||
                 Object.getOwnPropertyDescriptor(document, 'pictureInPictureElement');
    try {
      Object.defineProperty(document, 'pictureInPictureElement', {
        value: null,
        configurable: true,
        writable: true
      });
      expect(isInVideoPip()).toBe(false);
      
      const mockVideo = document.createElement('video');
      Object.defineProperty(document, 'pictureInPictureElement', {
        value: mockVideo,
        configurable: true,
        writable: true
      });
      expect(isInVideoPip()).toBe(true);
    } finally {
      if (desc) {
        Object.defineProperty(document, 'pictureInPictureElement', desc);
      } else {
        delete (document as any).pictureInPictureElement;
      }
    }
  });


  describe('enterVideoPip', () => {
    it('sets playsinline if missing and calls requestPictureInPicture if available', async () => {
      const video = document.createElement('video');
      video.requestPictureInPicture = vi.fn().mockResolvedValue(undefined);

      expect(video.hasAttribute('playsinline')).toBe(false);
      await enterVideoPip(video);
      expect(video.getAttribute('playsinline')).toBe('true');
      expect(video.requestPictureInPicture).toHaveBeenCalled();
    });

    it('falls back to WebKit presentation mode', async () => {
      const video = document.createElement('video') as any;
      video.webkitSupportsPresentationMode = vi.fn().mockReturnValue(true);
      video.webkitSetPresentationMode = vi.fn();

      await enterVideoPip(video);
      expect(video.webkitSetPresentationMode).toHaveBeenCalledWith('picture-in-picture');
    });

    it('falls back to WebKit fullscreen mode', async () => {
      const video = document.createElement('video') as any;
      video.webkitEnterFullscreen = vi.fn();

      await enterVideoPip(video);
      expect(video.webkitEnterFullscreen).toHaveBeenCalled();
    });

    it('throws if no picture-in-picture method is supported', async () => {
      const video = document.createElement('video');
      await expect(enterVideoPip(video)).rejects.toThrow('Picture-in-Picture is not supported for this video element.');
    });
  });

  describe('exitVideoPip', () => {
    it('calls document.exitPictureInPicture if video is active pictureInPictureElement', async () => {
      const desc = Object.getOwnPropertyDescriptor(document.constructor.prototype, 'pictureInPictureElement') ||
                   Object.getOwnPropertyDescriptor(document, 'pictureInPictureElement');
      const video = document.createElement('video');
      Object.defineProperty(document, 'pictureInPictureElement', {
        value: video,
        configurable: true,
        writable: true
      });
      document.exitPictureInPicture = vi.fn().mockResolvedValue(undefined);

      try {
        await exitVideoPip(video);
        expect(document.exitPictureInPicture).toHaveBeenCalled();
      } finally {
        if (desc) {
          Object.defineProperty(document, 'pictureInPictureElement', desc);
        } else {
          delete (document as any).pictureInPictureElement;
        }
      }
    });

    it('falls back to WebKit presentation mode set to inline', async () => {
      const video = document.createElement('video') as any;
      video.webkitPresentationMode = 'picture-in-picture';
      video.webkitSetPresentationMode = vi.fn();

      await exitVideoPip(video);
      expect(video.webkitSetPresentationMode).toHaveBeenCalledWith('inline');
    });

    it('falls back to WebKit exit fullscreen mode', async () => {
      const video = document.createElement('video') as any;
      video.webkitExitFullscreen = vi.fn();

      await exitVideoPip(video);
      expect(video.webkitExitFullscreen).toHaveBeenCalled();
    });
  });
});

