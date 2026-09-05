import { describe, it, expect, vi } from 'vitest';
import {
  deriveLevel,
  createDormancyStore,
  type Placement,
  type ActivityLevel,
} from '../src/dormancy';

describe('dormancy', () => {
  const TABLE_COMBINATIONS: ReadonlyArray<[Placement, boolean, boolean, ActivityLevel]> = [
    ['anchor', true, false, 'active'],
    ['anchor', false, false, 'background'],
    ['anchor', true, true, 'frozen'],
    ['anchor', false, true, 'frozen'],
    ['pip', true, false, 'active'],
    ['pip', false, false, 'background'],
    ['pip', true, true, 'frozen'],
    ['pip', false, true, 'frozen'],
    ['garage', true, false, 'dormant'],
    ['garage', false, false, 'frozen'],
    ['garage', true, true, 'frozen'],
    ['garage', false, true, 'frozen'],
  ];

  it.each(TABLE_COMBINATIONS)(
    'derives all 12 level combinations (%s, visible=%s, frozen=%s -> %s)',
    (placement, visible, frozen, expected) => {
      expect(deriveLevel(placement, visible, frozen)).toBe(expected);
    },
  );

  it('derives all 12 level combinations', () => {
    for (const [placement, visible, frozen, expected] of TABLE_COMBINATIONS) {
      expect(deriveLevel(placement, visible, frozen)).toBe(expected);
    }
  });

  it('frozen overrides every placement', () => {
    expect(deriveLevel('anchor', true, true)).toBe('frozen');
    expect(deriveLevel('pip', true, true)).toBe('frozen');
    expect(deriveLevel('garage', true, true)).toBe('frozen');
  });

  it('pip with a hidden document is background', () => {
    expect(deriveLevel('pip', false, false)).toBe('background');
  });

  it('snapshot is referentially stable', () => {
    const store = createDormancyStore();
    store.setInputs('a', { placement: 'anchor' });
    const snap1 = store.getSnapshot('a');
    const snap2 = store.getSnapshot('a');
    expect(snap1).toBe(snap2);
  });

  it('identical patch does not notify', () => {
    const store = createDormancyStore();
    const listener = vi.fn();
    store.subscribe('a', listener);
    store.setInputs('a', { placement: 'anchor' });
    store.setInputs('a', { placement: 'anchor' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('revealCount increments on garage to anchor', () => {
    const store = createDormancyStore();
    store.setInputs('a', { placement: 'garage' });
    store.setInputs('a', { placement: 'anchor' });
    expect(store.getSnapshot('a').revealCount).toBe(1);
  });

  it('revealCount does not increment on anchor to pip', () => {
    const store = createDormancyStore();
    store.setInputs('a', { placement: 'anchor' });
    store.setInputs('a', { placement: 'pip' });
    expect(store.getSnapshot('a').revealCount).toBe(0);
  });

  it('revealCount does not increment on visibility change', () => {
    const store = createDormancyStore();
    store.setInputs('a', { placement: 'anchor', visible: false });
    store.setInputs('a', { visible: true });
    expect(store.getSnapshot('a').revealCount).toBe(0);
  });

  it('unknown id returns the frozen default without creating an entry', () => {
    const store = createDormancyStore();
    const snap1 = store.getSnapshot('nope');
    const snap2 = store.getSnapshot('nope');
    expect(snap1).toBe(snap2);
    expect(snap1.id).toBe('');
    expect(snap1.level).toBe('dormant');
    expect(snap1.placement).toBe('garage');
    expect(snap1.isOpen).toBe(false);
    expect(snap1.visible).toBe(false);
    expect(snap1.revealCount).toBe(0);

    const nopeListener = vi.fn();
    store.subscribe('nope', nopeListener);
    store.setInputs('other', { placement: 'anchor' });
    expect(nopeListener).not.toHaveBeenCalled();
  });

  it('server snapshot is stable', () => {
    const store = createDormancyStore();
    const snap1 = store.getServerSnapshot('a');
    const snap2 = store.getServerSnapshot('a');
    expect(snap1).toBe(snap2);
    expect(snap1.id).toBe('a');
    expect(snap1.level).toBe('dormant');
    expect(snap1.placement).toBe('garage');
  });

  it('snapshots are frozen', () => {
    const store = createDormancyStore();
    store.setInputs('a', { placement: 'anchor' });
    const snap = store.getSnapshot('a');
    try {
      // @ts-expect-error mutating readonly property
      snap.level = 'dormant';
    } catch {
      // Ignored: frozen object throws in strict mode
    }
    expect(snap.level).toBe('active');
    expect(Object.isFrozen(snap)).toBe(true);

    const defaultSnap = store.getSnapshot('unknown');
    try {
      // @ts-expect-error mutating readonly property
      defaultSnap.level = 'active';
    } catch {
      // Ignored
    }
    expect(defaultSnap.level).toBe('dormant');
    expect(Object.isFrozen(defaultSnap)).toBe(true);

    const serverSnap = store.getServerSnapshot('srv');
    try {
      // @ts-expect-error mutating readonly property
      serverSnap.level = 'active';
    } catch {
      // Ignored
    }
    expect(serverSnap.level).toBe('dormant');
    expect(Object.isFrozen(serverSnap)).toBe(true);
  });

  it('deleteHost clears listeners', () => {
    const store = createDormancyStore();
    const listener = vi.fn();
    store.subscribe('a', listener);
    store.deleteHost('a');
    store.setInputs('a', { placement: 'anchor' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('deleteHost on an unknown id is a no-op', () => {
    const store = createDormancyStore();
    expect(() => store.deleteHost('nope')).not.toThrow();
  });

  it('a throwing listener does not block the others', () => {
    const store = createDormancyStore();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const badListener = vi.fn(() => {
      throw new Error('boom');
    });
    const goodListener = vi.fn();

    store.subscribe('a', badListener);
    store.subscribe('a', goodListener);

    store.setInputs('a', { placement: 'anchor' });

    expect(badListener).toHaveBeenCalledTimes(1);
    expect(goodListener).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[pip-it-up] dormancy listener failed:',
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });

  it('a listener deleting its host mid-notify does not throw', () => {
    const store = createDormancyStore();
    const selfDeletingListener = vi.fn(() => {
      store.deleteHost('a');
    });
    const secondListener = vi.fn();

    store.subscribe('a', selfDeletingListener);
    store.subscribe('a', secondListener);

    expect(() => {
      store.setInputs('a', { placement: 'anchor' });
    }).not.toThrow();

    expect(selfDeletingListener).toHaveBeenCalledTimes(1);
    expect(secondListener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot('a')).toBe(store.getSnapshot('unknown'));
  });

  it('setGlobalFrozen freezes then restores all hosts', () => {
    const store = createDormancyStore();
    store.setInputs('A', { placement: 'anchor', visible: true });
    store.setInputs('B', { placement: 'garage', visible: true });

    expect(store.getSnapshot('A').level).toBe('active');
    expect(store.getSnapshot('B').level).toBe('dormant');

    store.setGlobalFrozen(true);
    expect(store.getSnapshot('A').level).toBe('frozen');
    expect(store.getSnapshot('B').level).toBe('frozen');

    store.setGlobalFrozen(false);
    expect(store.getSnapshot('A').level).toBe('active');
    expect(store.getSnapshot('B').level).toBe('dormant');
  });

  it('setOpenerVisible skips pip-placed hosts', () => {
    const store = createDormancyStore();
    store.setInputs('A', { placement: 'anchor', visible: true });
    store.setInputs('B', { placement: 'pip', visible: true });

    expect(store.getSnapshot('A').level).toBe('active');
    expect(store.getSnapshot('B').level).toBe('active');

    store.setOpenerVisible(false);

    expect(store.getSnapshot('A').level).toBe('background');
    expect(store.getSnapshot('B').level).toBe('active');
  });

  // Additional defensive invariant tests from section 5:
  it('revealCount increments on garage to pip', () => {
    const store = createDormancyStore();
    store.setInputs('a', { placement: 'garage' });
    store.setInputs('a', { placement: 'pip' });
    expect(store.getSnapshot('a').revealCount).toBe(1);
  });

  it('revealCount does not increment on pip to anchor', () => {
    const store = createDormancyStore();
    store.setInputs('a', { placement: 'pip' });
    store.setInputs('a', { placement: 'anchor' });
    expect(store.getSnapshot('a').revealCount).toBe(0);
  });

  it('revealCount does not increment on anchor to garage', () => {
    const store = createDormancyStore();
    store.setInputs('a', { placement: 'anchor' });
    store.setInputs('a', { placement: 'garage' });
    expect(store.getSnapshot('a').revealCount).toBe(0);
  });

  it('disposer returned from subscribe removes listener', () => {
    const store = createDormancyStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe('a', listener);
    store.setInputs('a', { placement: 'anchor' });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.setInputs('a', { placement: 'pip' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
