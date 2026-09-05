import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  useDormancy,
  useActiveEffect,
  useRevealEffect,
  useAdaptiveInterval,
} from '../src/useDormancy';
import {
  createDormancyStore,
  type DormancyStore,
  type HostSnapshot,
} from '../src/dormancy';
import {
  PipHostContext,
  type PipHostApi,
} from '../src/PipTeleportContext';
import { PipError } from '../src/errors';

function renderWithHost(
  ui: React.ReactElement,
  store: DormancyStore,
  id = 'test-host',
) {
  const hostApi: PipHostApi = {
    id,
    subscribe: (fn: () => void) => store.subscribe(id, fn),
    getSnapshot: () => store.getSnapshot(id),
    getServerSnapshot: () => store.getServerSnapshot(id),
  };

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <PipHostContext.Provider value={hostApi}>
      {children}
    </PipHostContext.Provider>
  );

  return render(ui, { wrapper: Wrapper });
}

describe('useDormancy and consumer throttling verbs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('useDormancy throws outside a host', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Probe() {
      useDormancy();
      return null;
    }

    let thrown: unknown;
    try {
      render(<Probe />);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(PipError);
    expect((thrown as PipError).code).toBe('ERR_NO_HOST');
    consoleSpy.mockRestore();
  });

  it('useDormancy returns a stable snapshot', () => {
    const store = createDormancyStore();
    store.setInputs('test-host', { placement: 'anchor', visible: true });

    let firstSnapshot: HostSnapshot | undefined;
    let secondSnapshot: HostSnapshot | undefined;

    function Probe({ pass }: { pass: number }) {
      const snap = useDormancy();
      if (pass === 1) firstSnapshot = snap;
      if (pass === 2) secondSnapshot = snap;
      return null;
    }

    const { rerender } = renderWithHost(<Probe pass={1} />, store, 'test-host');
    rerender(<Probe pass={2} />);

    expect(firstSnapshot).toBeDefined();
    expect(secondSnapshot).toBe(firstSnapshot);
  });

  it('useDormancy re-renders on level change', () => {
    const store = createDormancyStore();
    store.setInputs('test-host', { placement: 'anchor', visible: true });

    function Probe() {
      const { level } = useDormancy();
      return <div data-testid="level">{level}</div>;
    }

    const { getByTestId } = renderWithHost(<Probe />, store, 'test-host');
    expect(getByTestId('level').textContent).toBe('active');

    act(() => {
      store.setInputs('test-host', { visible: false });
    });

    expect(getByTestId('level').textContent).toBe('background');
  });

  it('useActiveEffect runs while active', () => {
    const store = createDormancyStore();
    store.setInputs('test-host', { placement: 'anchor', visible: true });

    const effectSpy = vi.fn();
    function Probe() {
      useActiveEffect(effectSpy, []);
      return null;
    }

    renderWithHost(<Probe />, store, 'test-host');
    expect(effectSpy).toHaveBeenCalledTimes(1);
  });

  it('useActiveEffect does not run while dormant', () => {
    const store = createDormancyStore();
    store.setInputs('test-host', { placement: 'garage', visible: true });

    const effectSpy = vi.fn();
    function Probe() {
      useActiveEffect(effectSpy, []);
      return null;
    }

    renderWithHost(<Probe />, store, 'test-host');
    expect(effectSpy).not.toHaveBeenCalled();
  });

  it('useActiveEffect does not run while background', () => {
    const store = createDormancyStore();
    store.setInputs('test-host', { placement: 'anchor', visible: false });

    const effectSpy = vi.fn();
    function Probe() {
      useActiveEffect(effectSpy, []);
      return null;
    }

    renderWithHost(<Probe />, store, 'test-host');
    expect(effectSpy).not.toHaveBeenCalled();
  });

  it('useActiveEffect does not run while frozen', () => {
    const store = createDormancyStore();
    store.setInputs('test-host', { placement: 'anchor', visible: true, frozen: true });

    const effectSpy = vi.fn();
    function Probe() {
      useActiveEffect(effectSpy, []);
      return null;
    }

    renderWithHost(<Probe />, store, 'test-host');
    expect(effectSpy).not.toHaveBeenCalled();
  });

  it('useActiveEffect cleans up on exit from active', () => {
    const store = createDormancyStore();
    store.setInputs('test-host', { placement: 'anchor', visible: true });

    const cleanupSpy = vi.fn();
    function Probe() {
      useActiveEffect(() => {
        return cleanupSpy;
      }, []);
      return null;
    }

    renderWithHost(<Probe />, store, 'test-host');
    expect(cleanupSpy).not.toHaveBeenCalled();

    act(() => {
      store.setInputs('test-host', { visible: false });
    });

    expect(cleanupSpy).toHaveBeenCalledTimes(1);
  });

  it('useActiveEffect cleans up on exit to dormant', () => {
    const store = createDormancyStore();
    store.setInputs('test-host', { placement: 'anchor', visible: true });

    const cleanupSpy = vi.fn();
    function Probe() {
      useActiveEffect(() => {
        return cleanupSpy;
      }, []);
      return null;
    }

    renderWithHost(<Probe />, store, 'test-host');
    expect(cleanupSpy).not.toHaveBeenCalled();

    act(() => {
      store.setInputs('test-host', { placement: 'garage' });
    });

    expect(cleanupSpy).toHaveBeenCalledTimes(1);
  });

  it('useActiveEffect re-runs on deps change while active', () => {
    const store = createDormancyStore();
    store.setInputs('test-host', { placement: 'anchor', visible: true });

    const effectSpy = vi.fn();
    function Probe({ count }: { count: number }) {
      useActiveEffect(() => {
        effectSpy();
      }, [count]);
      return null;
    }

    const { rerender } = renderWithHost(<Probe count={1} />, store, 'test-host');
    expect(effectSpy).toHaveBeenCalledTimes(1);

    rerender(<Probe count={2} />);
    expect(effectSpy).toHaveBeenCalledTimes(2);
  });

  it('deps length change warns in dev', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = createDormancyStore();
    store.setInputs('test-host', { placement: 'anchor', visible: true });

    function Probe({ deps }: { deps: unknown[] }) {
      useActiveEffect(() => {}, deps);
      return null;
    }

    const { rerender } = renderWithHost(<Probe deps={[1]} />, store, 'test-host');
    expect(warnSpy).not.toHaveBeenCalled();

    rerender(<Probe deps={[1, 2]} />);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('deps array length changed');
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('deps length change is silent in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = createDormancyStore();
    store.setInputs('test-host', { placement: 'anchor', visible: true });

    function Probe({ deps }: { deps: unknown[] }) {
      useActiveEffect(() => {}, deps);
      return null;
    }

    const { rerender } = renderWithHost(<Probe deps={[1]} />, store, 'test-host');
    rerender(<Probe deps={[1, 2]} />);

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('useRevealEffect runs on garage to anchor', () => {
    const store = createDormancyStore();
    store.setInputs('test-host', { placement: 'garage', visible: true });

    const effectSpy = vi.fn();
    function Probe() {
      useRevealEffect(effectSpy);
      return null;
    }

    renderWithHost(<Probe />, store, 'test-host');
    expect(effectSpy).not.toHaveBeenCalled();

    act(() => {
      store.setInputs('test-host', { placement: 'anchor' });
    });

    expect(effectSpy).toHaveBeenCalledTimes(1);
  });

  it('useRevealEffect does not run in the garage', () => {
    const store = createDormancyStore();
    store.setInputs('test-host', { placement: 'garage', visible: true });

    const effectSpy = vi.fn();
    function Probe() {
      useRevealEffect(effectSpy);
      return null;
    }

    renderWithHost(<Probe />, store, 'test-host');
    expect(effectSpy).not.toHaveBeenCalled();
  });

  it('useRevealEffect does not re-run on unrelated renders', () => {
    const store = createDormancyStore();
    store.setInputs('test-host', { placement: 'anchor', visible: true });

    const effectSpy = vi.fn();
    function Probe({ pass }: { pass: number }) {
      useRevealEffect(effectSpy);
      return <div>{pass}</div>;
    }

    const { rerender } = renderWithHost(<Probe pass={1} />, store, 'test-host');
    expect(effectSpy).toHaveBeenCalledTimes(1);

    rerender(<Probe pass={2} />);
    rerender(<Probe pass={3} />);
    rerender(<Probe pass={4} />);

    expect(effectSpy).toHaveBeenCalledTimes(1);
  });

  it('adaptive interval uses 1000 at active', () => {
    const store = createDormancyStore();
    store.setInputs('test-host', { placement: 'anchor', visible: true });

    const callback = vi.fn();
    function Probe() {
      useAdaptiveInterval(callback);
      return null;
    }

    renderWithHost(<Probe />, store, 'test-host');
    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('adaptive interval uses 15000 at background', () => {
    const store = createDormancyStore();
    store.setInputs('test-host', { placement: 'anchor', visible: false });

    const callback = vi.fn();
    function Probe() {
      useAdaptiveInterval(callback);
      return null;
    }

    renderWithHost(<Probe />, store, 'test-host');

    act(() => {
      vi.advanceTimersByTime(14999);
    });
    expect(callback).toHaveBeenCalledTimes(0);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('adaptive interval registers no timer at frozen', () => {
    const store = createDormancyStore();
    store.setInputs('test-host', { placement: 'anchor', visible: true, frozen: true });

    const callback = vi.fn();
    function Probe() {
      useAdaptiveInterval(callback);
      return null;
    }

    renderWithHost(<Probe />, store, 'test-host');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('explicit null disables at dormant', () => {
    const store = createDormancyStore();
    store.setInputs('test-host', { placement: 'garage', visible: true });

    const callback = vi.fn();
    function Probe() {
      useAdaptiveInterval(callback, { dormant: null });
      return null;
    }

    renderWithHost(<Probe />, store, 'test-host');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('omitted level uses the default', () => {
    const store = createDormancyStore();
    store.setInputs('test-host', { placement: 'garage', visible: true });

    const callback = vi.fn();
    function Probe() {
      useAdaptiveInterval(callback, { active: 500 });
      return null;
    }

    renderWithHost(<Probe />, store, 'test-host');

    act(() => {
      vi.advanceTimersByTime(59999);
    });
    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('period below the floor is clamped', () => {
    const store = createDormancyStore();
    store.setInputs('test-host', { placement: 'anchor', visible: true });

    const callback = vi.fn();
    function Probe() {
      useAdaptiveInterval(callback, { active: 10 });
      return null;
    }

    renderWithHost(<Probe />, store, 'test-host');

    act(() => {
      vi.advanceTimersByTime(249);
    });
    expect(callback).toHaveBeenCalledTimes(0);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('new inline callback does not restart the timer', () => {
    const store = createDormancyStore();
    store.setInputs('test-host', { placement: 'anchor', visible: true });

    const cb1 = vi.fn();
    const cb2 = vi.fn();

    function Probe({ cb }: { cb: () => void }) {
      useAdaptiveInterval(cb);
      return null;
    }

    const { rerender } = renderWithHost(<Probe cb={cb1} />, store, 'test-host');

    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(cb1).not.toHaveBeenCalled();

    rerender(<Probe cb={cb2} />);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('level change restarts with the new period', () => {
    const store = createDormancyStore();
    store.setInputs('test-host', { placement: 'anchor', visible: true });

    const callback = vi.fn();
    function Probe() {
      useAdaptiveInterval(callback);
      return null;
    }

    renderWithHost(<Probe />, store, 'test-host');

    act(() => {
      store.setInputs('test-host', { visible: false });
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(callback).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
  });

  it('unmount clears the interval', () => {
    const store = createDormancyStore();
    store.setInputs('test-host', { placement: 'anchor', visible: true });

    const callback = vi.fn();
    function Probe() {
      useAdaptiveInterval(callback);
      return null;
    }

    const { unmount } = renderWithHost(<Probe />, store, 'test-host');
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
