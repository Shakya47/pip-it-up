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
});
