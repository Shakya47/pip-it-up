import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as core from '@pip-it-up/core';
import { PipProvider, __latestEntriesForTests } from '../src/PipProvider';
import { PipAnchor } from '../src/PipAnchor';
import {
  useTeleport,
  useHost,
  type PipTeleportApi,
  type PipHostApi,
} from '../src/PipTeleportContext';
import { __resetGarageCacheForTests, GARAGE_ATTR } from '../src/garage';

describe('PipProvider GC pipeline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    document.querySelectorAll('[data-pip-shuttle]').forEach((el) => el.remove());
    document.querySelectorAll(`[${GARAGE_ATTR}]`).forEach((el) => el.remove());
    __resetGarageCacheForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('does not destroy before the grace window', () => {
    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    const { rerender } = render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <Probe />
      </PipProvider>
    );
    const instance = teleportApi!.getInstance('a')!;
    expect(instance.destroyed).toBe(false);

    rerender(
      <PipProvider registry={{}}>
        <Probe />
      </PipProvider>
    );

    act(() => {
      vi.advanceTimersByTime(29999);
    });

    expect(instance.destroyed).toBe(false);
  });

  it('destroys after the grace window with no leases', () => {
    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    const { rerender } = render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <Probe />
      </PipProvider>
    );
    const instance = teleportApi!.getInstance('a')!;
    const shuttle = document.querySelector('[data-pip-shuttle="a"]') as HTMLElement;
    expect(shuttle).toBeTruthy();
    expect(shuttle.isConnected).toBe(true);

    rerender(
      <PipProvider registry={{}}>
        <Probe />
      </PipProvider>
    );

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(instance.destroyed).toBe(true);
    expect(shuttle.isConnected).toBe(false);
  });

  it('re-adoption inside the window cancels the lease', () => {
    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    const { rerender } = render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <Probe />
      </PipProvider>
    );
    const instance = teleportApi!.getInstance('a')!;

    rerender(
      <PipProvider registry={{}}>
        <Probe />
      </PipProvider>
    );

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    rerender(
      <PipProvider registry={{ a: <div>A</div> }}>
        <Probe />
      </PipProvider>
    );

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(instance.destroyed).toBe(false);
  });

  it('an open window blocks the sweep', () => {
    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    const { rerender } = render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <Probe />
      </PipProvider>
    );
    const instance = teleportApi!.getInstance('a')!;

    const isOpen = true;
    vi.spyOn(instance, 'isOpen').mockImplementation(() => isOpen);
    vi.spyOn(instance, 'getState').mockImplementation(() => ({
      isOpen,
      isSupported: true,
      pipWindow: {} as unknown as Window,
    }));
    vi.spyOn(instance, 'close').mockImplementation(() => {});

    rerender(
      <PipProvider registry={{}}>
        <Probe />
      </PipProvider>
    );

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(instance.destroyed).toBe(false);
  });

  it('re-arms at the recheck interval', () => {
    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    const { rerender } = render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <Probe />
      </PipProvider>
    );
    const instance = teleportApi!.getInstance('a')!;

    const isOpen = true;
    vi.spyOn(instance, 'isOpen').mockImplementation(() => isOpen);
    vi.spyOn(instance, 'getState').mockImplementation(() => ({
      isOpen,
      isSupported: true,
      pipWindow: {} as unknown as Window,
    }));
    vi.spyOn(instance, 'close').mockImplementation(() => {});

    rerender(
      <PipProvider registry={{}}>
        <Probe />
      </PipProvider>
    );

    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(instance.destroyed).toBe(false);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(instance.destroyed).toBe(false);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('sweeps once the lease clears', () => {
    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    const { rerender } = render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <Probe />
      </PipProvider>
    );
    const instance = teleportApi!.getInstance('a')!;

    let isOpen = true;
    vi.spyOn(instance, 'isOpen').mockImplementation(() => isOpen);
    vi.spyOn(instance, 'getState').mockImplementation(() => ({
      isOpen,
      isSupported: true,
      pipWindow: {} as unknown as Window,
    }));
    vi.spyOn(instance, 'close').mockImplementation(() => {});

    rerender(
      <PipProvider registry={{}}>
        <Probe />
      </PipProvider>
    );

    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(instance.destroyed).toBe(false);

    isOpen = false;

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(instance.destroyed).toBe(true);
  });

  it('a mounted anchor blocks the sweep', () => {
    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    const { rerender } = render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <PipAnchor id="a" />
        <Probe />
      </PipProvider>
    );
    const instance = teleportApi!.getInstance('a')!;

    rerender(
      <PipProvider registry={{}}>
        <PipAnchor id="a" />
        <Probe />
      </PipProvider>
    );

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(instance.destroyed).toBe(false);
  });

  it('onKeyRemoved is idempotent', () => {
    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    const { rerender } = render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <Probe />
      </PipProvider>
    );
    const instance = teleportApi!.getInstance('a')!;
    const destroySpy = vi.spyOn(instance, 'destroy');

    rerender(
      <PipProvider registry={{}}>
        <Probe />
      </PipProvider>
    );
    rerender(
      <PipProvider registry={{}}>
        <Probe />
      </PipProvider>
    );

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  it('sweep order: unregister precedes destroy', () => {
    let callIndex = 0;
    let unregisterIndex = -1;
    let destroyIndex = -1;

    const unregisterSpy = vi.spyOn(core, 'unregisterPip').mockImplementation(() => {
      unregisterIndex = ++callIndex;
    });

    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    const { rerender } = render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <Probe />
      </PipProvider>
    );
    const instance = teleportApi!.getInstance('a')!;

    vi.spyOn(instance, 'destroy').mockImplementation(() => {
      destroyIndex = ++callIndex;
    });

    callIndex = 0;
    unregisterIndex = -1;
    destroyIndex = -1;

    rerender(
      <PipProvider registry={{}}>
        <Probe />
      </PipProvider>
    );

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(unregisterIndex).toBeGreaterThan(0);
    expect(destroyIndex).toBeGreaterThan(0);
    expect(unregisterIndex).toBeLessThan(destroyIndex);

    unregisterSpy.mockRestore();
  });

  it('sweep order: destroy precedes shuttle removal', () => {
    let callIndex = 0;
    let destroyIndex = -1;
    let removeIndex = -1;

    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    const { rerender } = render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <Probe />
      </PipProvider>
    );
    const instance = teleportApi!.getInstance('a')!;
    const shuttle = document.querySelector('[data-pip-shuttle="a"]') as HTMLElement;

    vi.spyOn(instance, 'destroy').mockImplementation(() => {
      destroyIndex = ++callIndex;
    });
    vi.spyOn(shuttle, 'remove').mockImplementation(() => {
      removeIndex = ++callIndex;
    });

    rerender(
      <PipProvider registry={{}}>
        <Probe />
      </PipProvider>
    );

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(destroyIndex).toBeGreaterThan(0);
    expect(removeIndex).toBeGreaterThan(0);
    expect(destroyIndex).toBeLessThan(removeIndex);
  });

  it('sweep releases the content registration', () => {
    let capturedRegistration: core.ElementRegistration | null = null;

    const origCreatePip = core.createPip;
    const createPipSpy = vi.spyOn(core, 'createPip').mockImplementation((opts) => {
      const inst = origCreatePip(opts);
      const origRegElements = inst.registerElements.bind(inst);
      vi.spyOn(inst, 'registerElements').mockImplementation((patch) => {
        const reg = origRegElements(patch);
        capturedRegistration = reg;
        return reg;
      });
      return inst;
    });

    const { rerender } = render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <div>App</div>
      </PipProvider>
    );

    expect(capturedRegistration).toBeTruthy();
    const releaseSpy = vi.spyOn(capturedRegistration!, 'release');

    rerender(
      <PipProvider registry={{}}>
        <div>App</div>
      </PipProvider>
    );

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(releaseSpy).toHaveBeenCalledTimes(1);
    createPipSpy.mockRestore();
  });

  it('sweep releases the teardown hook', () => {
    const { rerender } = render(<PipProvider registry={{ a: <div>A</div> }} />);
    const entry = __latestEntriesForTests?.get('a');
    expect(entry).toBeTruthy();
    const unregisterTeardownSpy = vi.fn();
    entry!.releaseTeardown = unregisterTeardownSpy;

    rerender(<PipProvider registry={{}} />);

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(unregisterTeardownSpy).toHaveBeenCalledTimes(1);
    expect(entry!.releaseTeardown).toBeNull();
  });

  it('sweep deletes the dormancy host', () => {
    let hostApi: PipHostApi | null = null;
    function HostedChild() {
      hostApi = useHost();
      return <div>Hosted</div>;
    }
    const { rerender } = render(
      <PipProvider registry={{ a: <HostedChild /> }}>
        <div>App</div>
      </PipProvider>
    );
    expect(hostApi).toBeTruthy();
    expect(hostApi!.getSnapshot().level).toBe('dormant');

    rerender(
      <PipProvider registry={{}}>
        <div>App</div>
      </PipProvider>
    );

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(hostApi!.getSnapshot()).toEqual({
      id: '',
      level: 'dormant',
      placement: 'garage',
      isOpen: false,
      visible: false,
      revealCount: 0,
    });
  });

  it('custom gcGraceMs is honoured', () => {
    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    const { rerender } = render(
      <PipProvider registry={{ a: <div>A</div> }} gcGraceMs={1000}>
        <Probe />
      </PipProvider>
    );
    const instance = teleportApi!.getInstance('a')!;

    rerender(
      <PipProvider registry={{}} gcGraceMs={1000}>
        <Probe />
      </PipProvider>
    );

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(instance.destroyed).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(instance.destroyed).toBe(true);
  });

  it('gcGraceMs 0 does not sweep synchronously', () => {
    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    const { rerender } = render(
      <PipProvider registry={{ a: <div>A</div> }} gcGraceMs={0}>
        <Probe />
      </PipProvider>
    );
    const instance = teleportApi!.getInstance('a')!;

    rerender(
      <PipProvider registry={{}} gcGraceMs={0}>
        <Probe />
      </PipProvider>
    );

    expect(instance.destroyed).toBe(false);

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(instance.destroyed).toBe(true);
  });

  it('registry identity change with the same keys does not orphan', () => {
    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    const { rerender } = render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <Probe />
      </PipProvider>
    );
    const instance = teleportApi!.getInstance('a')!;

    rerender(
      <PipProvider registry={{ a: <div>Fresh Object A</div> }}>
        <Probe />
      </PipProvider>
    );

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(instance.destroyed).toBe(false);
  });

  it('provider unmount clears timers and sweeps', () => {
    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    const { rerender, unmount } = render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <Probe />
      </PipProvider>
    );
    const instance = teleportApi!.getInstance('a')!;

    rerender(
      <PipProvider registry={{}}>
        <Probe />
      </PipProvider>
    );

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(instance.destroyed).toBe(false);
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    // The GC timer is cleared synchronously on unmount, but the sweep itself is deferred by one
    // macrotask so a Strict Mode remount can cancel it. So immediately after unmount the only
    // live timer is that deferred sweep.
    expect(vi.getTimerCount()).toBe(1);
    expect(instance.destroyed).toBe(false);

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(vi.getTimerCount()).toBe(0);
    expect(instance.destroyed).toBe(true);
  });

  it('sweeping an already-destroyed instance does not throw', () => {
    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    const { rerender } = render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <Probe />
      </PipProvider>
    );
    const instance = teleportApi!.getInstance('a')!;
    instance.destroy();

    expect(() => {
      rerender(
        <PipProvider registry={{}}>
          <Probe />
        </PipProvider>
      );

      act(() => {
        vi.advanceTimersByTime(30000);
      });
    }).not.toThrow();
  });
});
