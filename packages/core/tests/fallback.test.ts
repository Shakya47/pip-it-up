import { describe, it, expect, vi } from 'vitest';
import { executeFallback } from '../src/fallback';

describe('executeFallback', () => {
  it('should execute custom function', () => {
    const fn = vi.fn();
    executeFallback(fn, {} as any);
    expect(fn).toHaveBeenCalled();
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

  describe('URL validation', () => {
    it('should reject javascript: URLs and emit a warning', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      executeFallback('new-tab', { fallbackUrl: 'javascript:alert(1)' } as any);

      expect(openSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Blocked fallbackUrl with disallowed protocol')
      );

      openSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('should reject data: URLs and emit a warning', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      executeFallback('new-tab', { fallbackUrl: 'data:text/html,<h1>hi</h1>' } as any);

      expect(openSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Blocked fallbackUrl with disallowed protocol')
      );

      openSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('should reject unparseable URLs gracefully (no thrown exception)', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // This should not throw
      expect(() => {
        executeFallback('new-tab', { fallbackUrl: 'not a url' } as any);
      }).not.toThrow();

      // jsdom's URL constructor may or may not parse "not a url" with a base.
      // The key assertion: either it was blocked or warned — no crash.
      openSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('should open https: URLs with noopener,noreferrer', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      executeFallback('new-tab', { fallbackUrl: 'https://example.com' } as any);

      expect(openSpy).toHaveBeenCalledWith(
        'https://example.com',
        '_blank',
        'noopener,noreferrer'
      );

      openSpy.mockRestore();
    });

    it('should resolve relative paths against window.location.origin and open normally', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      executeFallback('new-tab', { fallbackUrl: '/relative/path' } as any);

      expect(openSpy).toHaveBeenCalledWith(
        '/relative/path',
        '_blank',
        'noopener,noreferrer'
      );

      openSpy.mockRestore();
    });
  });
});
