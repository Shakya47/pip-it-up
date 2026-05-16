import { describe, it, expect, vi } from 'vitest';
import { executeFallback } from '../src/fallback';

describe('executeFallback', () => {
  it('should execute custom function', () => {
    const fn = vi.fn();
    executeFallback(fn, {} as any);
    expect(fn).toHaveBeenCalled();
  });

  it('should handle new-tab', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    executeFallback('new-tab', { fallbackUrl: '/test' } as any);
    expect(openSpy).toHaveBeenCalledWith('/test', '_blank');
    openSpy.mockRestore();
  });

  it('should handle new-tab without fallbackUrl', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    executeFallback('new-tab', {} as any);
    expect(warnSpy).toHaveBeenCalledWith('pip-it-up: fallback="new-tab" requires fallbackUrl option');
    warnSpy.mockRestore();
  });



  it('should do nothing for none and log warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    executeFallback('none', {} as any);
    expect(warnSpy).toHaveBeenCalledWith('pip-it-up: Document Picture-in-Picture is not supported in this browser.');
    warnSpy.mockRestore();
  });
});
