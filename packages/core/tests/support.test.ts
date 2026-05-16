import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isSupported } from '../src/support';

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
});
