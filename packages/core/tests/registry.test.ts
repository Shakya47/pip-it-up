import { describe, it, expect, vi } from 'vitest';
import { registerPip, unregisterPip, getPip, subscribeRegistry } from '../src/registry';

describe('registry', () => {
  it('should register and retrieve', () => {
    const mockPip: any = { id: 'abc' };
    registerPip('abc', mockPip);
    expect(getPip('abc')).toBe(mockPip);
    unregisterPip('abc');
    expect(getPip('abc')).toBeNull();
  });

  it('should notify subscribers', () => {
    const fn = vi.fn();
    const unsub = subscribeRegistry('xyz', fn);
    
    registerPip('xyz', {} as any);
    expect(fn).toHaveBeenCalledTimes(1);

    unregisterPip('xyz');
    expect(fn).toHaveBeenCalledTimes(2);

    unsub();
    registerPip('xyz', {} as any);
    expect(fn).toHaveBeenCalledTimes(2); // no longer notified
  });

  describe('collision warning', () => {
    it('should warn when registering a different instance with the same id', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const instanceA: any = { name: 'A' };
      const instanceB: any = { name: 'B' };

      registerPip('collision-test', instanceA);
      registerPip('collision-test', instanceB);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Overwriting existing registration for id "collision-test"')
      );

      unregisterPip('collision-test');
      warnSpy.mockRestore();
    });

    it('should NOT warn when re-registering the same instance (same reference)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const instance: any = { name: 'same' };

      registerPip('reregister-test', instance);
      registerPip('reregister-test', instance);

      expect(warnSpy).not.toHaveBeenCalled();

      unregisterPip('reregister-test');
      warnSpy.mockRestore();
    });
  });
});
