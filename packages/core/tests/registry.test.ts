import { describe, it, expect, vi } from 'vitest';
import { registerPip, unregisterPip, getPip, subscribeRegistry } from '../src/registry';
import type { PipInstance } from '../src/types';

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

  describe('compare-and-delete', () => {
    const makeInstance = (id: string): PipInstance => ({ id } as unknown as PipInstance);

    it('non-owner unregister does not delete', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const instanceA = makeInstance('A');
      const instanceB = makeInstance('B');

      registerPip('x', instanceA);
      registerPip('x', instanceB);
      unregisterPip('x', instanceA);

      expect(getPip('x')).toBe(instanceB);
      warnSpy.mockRestore();
    });

    it('non-owner unregister does not notify', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const instanceA = makeInstance('A');
      const instanceB = makeInstance('B');

      registerPip('x', instanceA);
      registerPip('x', instanceB);

      const spy = vi.fn();
      subscribeRegistry('x', spy);

      unregisterPip('x', instanceA);

      expect(spy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('owner unregister deletes', () => {
      const instanceB = makeInstance('B');

      registerPip('x', instanceB);
      unregisterPip('x', instanceB);

      expect(getPip('x')).toBeNull();
    });

    it('owner unregister notifies once', () => {
      const instanceB = makeInstance('B');

      registerPip('x', instanceB);

      const spy = vi.fn();
      subscribeRegistry('x', spy);

      unregisterPip('x', instanceB);

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('legacy single-argument call still deletes', () => {
      const instanceA = makeInstance('A');

      registerPip('x', instanceA);
      unregisterPip('x');

      expect(getPip('x')).toBeNull();
    });

    it('unregister for an unregistered id with an instance is a no-op', () => {
      const instanceA = makeInstance('A');
      const spy = vi.fn();
      subscribeRegistry('never', spy);

      expect(() => unregisterPip('never', instanceA)).not.toThrow();
      expect(getPip('never')).toBeNull();
      expect(spy).not.toHaveBeenCalled();
    });

    it('unregistering an unregistered id without an instance notifies listeners (legacy)', () => {
      const spy = vi.fn();
      subscribeRegistry('never-legacy', spy);

      expect(() => unregisterPip('never-legacy')).not.toThrow();
      expect(getPip('never-legacy')).toBeNull();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('Strict Mode double-mount emits no collision warning', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const instance = makeInstance('strict-mode');

      registerPip('strict', instance);
      unregisterPip('strict', instance);
      registerPip('strict', instance);

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
