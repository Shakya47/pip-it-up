import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { usePip } from '../src/usePip';

describe('usePip', () => {
  it('returns manual control flow API', async () => {
    const { result } = renderHook(() => usePip());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.isSupported).toBe(true);

    await act(async () => {
      await result.current.open();
    });

    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.close();
    });

    expect(result.current.isOpen).toBe(false);
  });

  it('is SSR safe', () => {
    // We cannot delete window entirely in a jsdom environment because React render Hook requires it.
    // However, if we just ensure documentPictureInPicture is missing, we test the isSupported fallback
    const original = (global.window as any).documentPictureInPicture;
    delete (global.window as any).documentPictureInPicture;

    const { result } = renderHook(() => usePip());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.isSupported).toBe(false);

    (global.window as any).documentPictureInPicture = original;
  });
});
