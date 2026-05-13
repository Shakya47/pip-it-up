import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isSupported } from '../src/support';

describe('support', () => {
  let original: any;

  beforeEach(() => {
    original = (window as any).documentPictureInPicture;
  });

  afterEach(() => {
    if (original !== undefined) {
      (window as any).documentPictureInPicture = original;
    } else {
      delete (window as any).documentPictureInPicture;
    }
  });

  it('returns true when API is present', () => {
    (window as any).documentPictureInPicture = {};
    expect(isSupported()).toBe(true);
  });

  it('returns false when API is missing', () => {
    delete (window as any).documentPictureInPicture;
    expect(isSupported()).toBe(false);
  });

  it('returns false when window is undefined (SSR)', () => {
    const originalWindow = global.window;
    // @ts-expect-error Testing invalid assignment
    delete global.window;
    
    expect(isSupported()).toBe(false);
    
    global.window = originalWindow;
  });
});
