import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, type MockInstance } from 'vitest';
import * as core from '@pip-it-up/core';
import { PipProvider } from '../src/PipProvider';
import { PipAnchor } from '../src/PipAnchor';
import { useTeleport, type PipTeleportApi } from '../src/PipTeleportContext';
import * as garageModule from '../src/garage';
import { __resetGarageCacheForTests, GARAGE_ATTR } from '../src/garage';

describe('PipProvider synchronous teardown repatriation', () => {
  afterEach(() => {
    document.querySelectorAll('[data-pip-shuttle]').forEach((el) => el.remove());
    document.querySelectorAll(`[${GARAGE_ATTR}]`).forEach((el) => el.remove());
    __resetGarageCacheForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('repatriates synchronously on pagehide', async () => {
    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    const { container } = render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <PipAnchor id="a" />
        <Probe />
      </PipProvider>
    );
    const anchorBox = container.querySelector('[data-pip-anchor="a"]') as HTMLElement;
    const instance = teleportApi!.getInstance('a')!;
    const shuttle = document.querySelector('[data-pip-shuttle="a"]') as HTMLElement;

    await act(async () => {
      await instance.open();
    });

    const pipWindow = instance.getState().pipWindow!;
    expect(pipWindow).toBeTruthy();
    expect(shuttle.parentElement).toBe(pipWindow.document.body);

    pipWindow.dispatchEvent(new Event('pagehide'));

    expect(shuttle.parentElement).toBe(anchorBox);
  });

  it('hook runs before the window closes', async () => {
    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <PipAnchor id="a" />
        <Probe />
      </PipProvider>
    );
    const instance = teleportApi!.getInstance('a')!;

    let wasClosedAtTeardown: boolean | null = null;
    instance.registerTeardown(() => {
      const pipWin = instance.getState().pipWindow;
      wasClosedAtTeardown = pipWin ? pipWin.closed : null;
    });

    await act(async () => {
      await instance.open();
    });

    const pipWindow = instance.getState().pipWindow!;
    pipWindow.dispatchEvent(new Event('pagehide'));

    expect(wasClosedAtTeardown).toBe(false);
  });

  it('repatriates to the garage with no anchor', async () => {
    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <Probe />
      </PipProvider>
    );
    const instance = teleportApi!.getInstance('a')!;
    const shuttle = document.querySelector('[data-pip-shuttle="a"]') as HTMLElement;

    await act(async () => {
      await instance.open();
    });

    const pipWindow = instance.getState().pipWindow!;
    expect(shuttle.parentElement).toBe(pipWindow.document.body);

    pipWindow.dispatchEvent(new Event('pagehide'));

    expect(shuttle.parentElement).not.toBeNull();
    expect(shuttle.parentElement!.hasAttribute(GARAGE_ATTR)).toBe(true);
  });

  it('performs exactly one DOM move', async () => {
    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    const { container } = render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <PipAnchor id="a" />
        <Probe />
      </PipProvider>
    );
    const anchorBox = container.querySelector('[data-pip-anchor="a"]') as HTMLElement;
    const instance = teleportApi!.getInstance('a')!;
    const shuttle = document.querySelector('[data-pip-shuttle="a"]') as HTMLElement;

    await act(async () => {
      await instance.open();
    });

    const pipWindow = instance.getState().pipWindow!;
    expect(shuttle.parentElement).toBe(pipWindow.document.body);

    const observer = new MutationObserver(() => {});
    observer.observe(anchorBox, { childList: true });

    pipWindow.dispatchEvent(new Event('pagehide'));

    const records = observer.takeRecords();
    observer.disconnect();

    const childListRecords = records.filter(
      (r) => r.type === 'childList' && r.addedNodes.length > 0
    );
    expect(childListRecords.length).toBe(1);
    expect(childListRecords[0].addedNodes[0]).toBe(shuttle);
  });

  it('registers the hook once per entry', async () => {
    let registerTeardownSpy: MockInstance<[fn: core.PipTeardownHook], () => void> | null = null;
    const origCreatePip = core.createPip;
    const createPipSpy = vi.spyOn(core, 'createPip').mockImplementation((opts) => {
      const inst = origCreatePip(opts);
      const spy = vi.spyOn(inst, 'registerTeardown');
      registerTeardownSpy = spy;
      return inst;
    });

    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <PipAnchor id="a" />
        <Probe />
      </PipProvider>
    );
    const instance = teleportApi!.getInstance('a')!;

    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await instance.open();
      });
      const pipWindow = instance.getState().pipWindow!;
      pipWindow.dispatchEvent(new Event('pagehide'));
    }

    expect(registerTeardownSpy).toBeTruthy();
    expect(registerTeardownSpy!).toHaveBeenCalledTimes(1);
    createPipSpy.mockRestore();
  });

  it('belt-and-braces listener is bound to the instance signal', async () => {
    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <PipAnchor id="a" />
        <Probe />
      </PipProvider>
    );
    const instance = teleportApi!.getInstance('a')!;

    await act(async () => {
      await instance.open();
    });

    const pipWindow = instance.getState().pipWindow!;
    const moveHostSpy = vi.spyOn(garageModule, 'moveHost');

    instance.destroy();
    moveHostSpy.mockClear();

    pipWindow.dispatchEvent(new Event('pagehide'));

    expect(moveHostSpy).not.toHaveBeenCalled();
    moveHostSpy.mockRestore();
  });

  it('a throwing move does not block the close', async () => {
    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <PipAnchor id="a" />
        <Probe />
      </PipProvider>
    );
    const instance = teleportApi!.getInstance('a')!;

    await act(async () => {
      await instance.open();
    });

    const pipWindow = instance.getState().pipWindow!;
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const moveHostSpy = vi.spyOn(garageModule, 'moveHost').mockImplementationOnce(() => {
      throw new Error('Simulated DOM failure');
    });

    pipWindow.dispatchEvent(new Event('pagehide'));

    expect(pipWindow.closed).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    moveHostSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('placement effect no-ops after teardown', async () => {
    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    const { container } = render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <PipAnchor id="a" />
        <Probe />
      </PipProvider>
    );
    const anchorBox = container.querySelector('[data-pip-anchor="a"]') as HTMLElement;
    const instance = teleportApi!.getInstance('a')!;

    await act(async () => {
      await instance.open();
    });

    const pipWindow = instance.getState().pipWindow!;
    pipWindow.dispatchEvent(new Event('pagehide'));

    const observer = new MutationObserver(() => {});
    observer.observe(anchorBox, { childList: true });

    await act(async () => {});

    const records = observer.takeRecords();
    observer.disconnect();
    expect(records.length).toBe(0);
  });

  it('unmount while open repatriates then removes', async () => {
    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    const { unmount } = render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <PipAnchor id="a" />
        <Probe />
      </PipProvider>
    );
    const instance = teleportApi!.getInstance('a')!;
    const shuttle = document.querySelector('[data-pip-shuttle="a"]') as HTMLElement;

    await act(async () => {
      await instance.open();
    });

    const pipWindow = instance.getState().pipWindow!;
    expect(shuttle.parentElement).toBe(pipWindow.document.body);

    let leftPipBeforeRemoval = false;
    const origRemove = shuttle.remove.bind(shuttle);
    vi.spyOn(shuttle, 'remove').mockImplementation(() => {
      if (shuttle.parentElement !== pipWindow.document.body) {
        leftPipBeforeRemoval = true;
      }
      origRemove();
    });

    unmount();

    // The provider's sweep is deferred one macrotask so a Strict Mode remount can cancel it.
    // The repatriation itself is still synchronous (it runs in the core teardown hook), so the
    // shuttle has already left the PiP document by the time the deferred sweep removes it.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(leftPipBeforeRemoval).toBe(true);
    expect(shuttle.isConnected).toBe(false);
  });

  // The user-reported sequence: pop out, navigate to a route with NO anchor, close the PiP
  // window there, then navigate back. The widget must re-dock into its anchor automatically,
  // with no manual restore step. Nothing covered this specific ordering before.
  it('re-docks automatically after the PiP window is closed on an anchor-less route', async () => {
    let api: PipTeleportApi | null = null;
    function Probe() {
      api = useTeleport();
      return null;
    }

    function App() {
      const [route, setRoute] = React.useState<'a' | 'b'>('a');
      return (
        <PipProvider registry={{ w: <div data-testid="widget">W</div> }}>
          <Probe />
          <button onClick={() => setRoute('b')}>go-b</button>
          <button onClick={() => setRoute('a')}>go-a</button>
          {route === 'a' && <PipAnchor id="w" placeholder={<div data-testid="ph" />} />}
        </PipProvider>
      );
    }

    const { container, getByText } = render(<App />);

    // The shuttle moves between DOCUMENTS, so look in the opener and in any PiP document.
    const shuttle = (): HTMLElement => {
      const local = document.querySelector('[data-pip-shuttle="w"]') as HTMLElement | null;
      if (local) return local;
      const win = api!.getInstance('w')!.getState().pipWindow;
      const remote = win?.document.querySelector('[data-pip-shuttle="w"]') as HTMLElement | null;
      if (!remote) throw new Error('shuttle not found in either document');
      return remote;
    };
    const anchor = () =>
      container.querySelector('[data-pip-anchor="w"]') as HTMLElement | null;

    // 1. docked on route A
    expect(shuttle().parentElement).toBe(anchor());

    // 2. pop out
    const inst = api!.getInstance('w')!;
    await act(async () => {
      await inst.open();
    });
    const pipWin = inst.getState().pipWindow!;
    expect(shuttle().parentElement).toBe(pipWin.document.body);

    // 3. navigate to route B; the anchor unmounts but the window stays open
    await act(async () => {
      getByText('go-b').click();
    });
    expect(inst.isOpen()).toBe(true);
    expect(shuttle().parentElement).toBe(pipWin.document.body);
    expect(anchor()).toBeNull();

    // 4. close the PiP window WHILE ON ROUTE B: nowhere to dock, so it parks in the garage
    await act(async () => {
      inst.close();
    });
    expect(inst.isOpen()).toBe(false);
    expect(shuttle().parentElement?.hasAttribute(GARAGE_ATTR)).toBe(true);

    // 5. navigate back to route A: must re-dock with NO manual intervention
    await act(async () => {
      getByText('go-a').click();
    });
    expect(anchor()).not.toBeNull();
    expect(shuttle().parentElement).toBe(anchor());
    // Docked means not reserved, so the placeholder is gone.
    expect(anchor()!.querySelector('[data-pip-placeholder]')).toBeNull();
  });

  it('no flushSync in the package', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const srcDir = path.resolve(__dirname, '../src');
    const files = fs.readdirSync(srcDir);
    for (const file of files) {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
        expect(content).not.toContain('flushSync');
      }
    }
  });
});
