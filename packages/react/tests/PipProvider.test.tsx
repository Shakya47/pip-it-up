import React, { useEffect, useCallback } from 'react';
import { render, screen, act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as core from '@pip-it-up/core';
import { PipProvider, resolveContentEl } from '../src/PipProvider';
import { PipAnchor } from '../src/PipAnchor';
import {
  useTeleport,
  useHost,
  type PipTeleportApi,
  type PipHostApi,
} from '../src/PipTeleportContext';
import { __resetGarageCacheForTests, GARAGE_ATTR } from '../src/garage';

describe('PipProvider', () => {
  afterEach(() => {
    document.querySelectorAll('[data-pip-shuttle]').forEach((el) => el.remove());
    document.querySelectorAll(`[${GARAGE_ATTR}]`).forEach((el) => el.remove());
    __resetGarageCacheForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('renders children', () => {
    render(
      <PipProvider registry={{}}>
        <div>Hello World</div>
      </PipProvider>
    );
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('creates one instance per registry key', () => {
    const createPipSpy = vi.spyOn(core, 'createPip');
    render(
      <PipProvider registry={{ a: <div>A</div>, b: <div>B</div> }}>
        <div>Children</div>
      </PipProvider>
    );
    expect(createPipSpy).toHaveBeenCalledTimes(2);
    expect(createPipSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a', mode: 'portal' })
    );
    expect(createPipSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b', mode: 'portal' })
    );
    createPipSpy.mockRestore();
  });

  it('forces mode portal over caller options', () => {
    const createPipSpy = vi.spyOn(core, 'createPip');
    render(
      <PipProvider
        registry={{ a: <div>A</div> }}
        options={{ a: { mode: 'move' } as never }}
      >
        <div>Children</div>
      </PipProvider>
    );
    expect(createPipSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a', mode: 'portal' })
    );
    createPipSpy.mockRestore();
  });

  it('api identity is stable across re-renders', () => {
    const apis: PipTeleportApi[] = [];
    function Probe() {
      const api = useTeleport();
      apis.push(api);
      return null;
    }
    const { rerender } = render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <Probe />
      </PipProvider>
    );
    rerender(
      <PipProvider registry={{ a: <div>A2</div> }}>
        <Probe />
      </PipProvider>
    );
    rerender(
      <PipProvider registry={{ a: <div>A3</div> }}>
        <Probe />
      </PipProvider>
    );
    expect(apis.length).toBe(3);
    expect(apis[0]).toBe(apis[1]);
    expect(apis[1]).toBe(apis[2]);
  });

  it('host api identity is stable', () => {
    const subscribes: Array<(fn: () => void) => () => void> = [];
    function HostProbe() {
      const host = useHost();
      subscribes.push(host.subscribe);
      return null;
    }
    const { rerender } = render(
      <PipProvider registry={{ a: <HostProbe /> }}>
        <div>Children</div>
      </PipProvider>
    );
    rerender(
      <PipProvider registry={{ a: <HostProbe /> }}>
        <div>Children rerender</div>
      </PipProvider>
    );
    expect(subscribes.length).toBe(2);
    expect(subscribes[0]).toBe(subscribes[1]);
  });

  it('inline registry literal does not remount', () => {
    let mountCount = 0;
    function Child() {
      useEffect(() => {
        mountCount++;
      }, []);
      return <div>Child</div>;
    }
    const { rerender } = render(
      <PipProvider registry={{ a: <Child /> }}>
        <div>App</div>
      </PipProvider>
    );
    rerender(
      <PipProvider registry={{ a: <Child /> }}>
        <div>App</div>
      </PipProvider>
    );
    rerender(
      <PipProvider registry={{ a: <Child /> }}>
        <div>App</div>
      </PipProvider>
    );
    expect(mountCount).toBe(1);
  });

  it('docks the shuttle into a mounted anchor', () => {
    const { container } = render(
      <PipProvider registry={{ a: <div data-testid="hosted">Inside A</div> }}>
        <PipAnchor id="a" />
      </PipProvider>
    );
    const anchorBox = container.querySelector('[data-pip-anchor="a"]') as HTMLElement;
    const shuttle = document.querySelector('[data-pip-shuttle="a"]') as HTMLElement;
    expect(anchorBox).toBeTruthy();
    expect(shuttle).toBeTruthy();
    expect(shuttle.parentElement).toBe(anchorBox);
  });

  // Regression: React Strict Mode simulates an unmount by re-running effects
  // (mount -> unmount -> mount) WITHOUT re-rendering. Entry creation lives in the provider's
  // render body, so a provider cleanup that swept entries synchronously destroyed every entry
  // with nothing left to recreate them: the Strict Mode remount's `claimAnchor` found no entry,
  // the shuttle stayed parked in the garage, and a mounted anchor showed its placeholder
  // forever. The sweep is now deferred by a macrotask and cancelled by the remount.
  it('docks the shuttle into a mounted anchor under Strict Mode', () => {
    const { container } = render(
      <React.StrictMode>
        <PipProvider registry={{ a: <div data-testid="hosted">Inside A</div> }}>
          <PipAnchor id="a" placeholder={<div data-testid="ph">placeholder</div>} />
        </PipProvider>
      </React.StrictMode>
    );

    const anchorBox = container.querySelector('[data-pip-anchor="a"]') as HTMLElement;
    const shuttle = document.querySelector('[data-pip-shuttle="a"]') as HTMLElement;

    expect(anchorBox).toBeTruthy();
    expect(shuttle).toBeTruthy();
    expect(shuttle.parentElement).toBe(anchorBox);
    // Docked means not reserved, so no placeholder is rendered.
    expect(anchorBox.querySelector('[data-pip-placeholder]')).toBeNull();
    expect(screen.getByTestId('hosted')).toBeTruthy();
  });

  it('does not destroy entries on a Strict Mode simulated unmount', () => {
    const createPipSpy = vi.spyOn(core, 'createPip');
    render(
      <React.StrictMode>
        <PipProvider registry={{ a: <div>Inside A</div> }}>
          <PipAnchor id="a" />
        </PipProvider>
      </React.StrictMode>
    );

    // One instance for the id, and it must still be alive after the simulated unmount cycle.
    const instances = createPipSpy.mock.results
      .map((r) => r.value as core.PipInstance)
      .filter((inst) => inst.id === 'a');
    expect(instances.length).toBeGreaterThan(0);
    expect(instances.every((inst) => inst.destroyed === false)).toBe(true);
  });

  it('parks in the garage with no anchor', () => {
    render(
      <PipProvider registry={{ a: <div data-testid="hosted">Inside A</div> }}>
        <div>App</div>
      </PipProvider>
    );
    const shuttle = document.querySelector('[data-pip-shuttle="a"]') as HTMLElement;
    expect(shuttle).toBeTruthy();
    expect(shuttle.parentElement).not.toBeNull();
    expect(shuttle.parentElement!.hasAttribute(GARAGE_ATTR)).toBe(true);
  });

  it('route handoff: unmount A then mount B', () => {
    function App({ activeRoute }: { activeRoute: 'A' | 'B' }) {
      return (
        <PipProvider registry={{ x: <div>Content</div> }}>
          {activeRoute === 'A' ? (
            <PipAnchor id="x" className="anchor-a" />
          ) : (
            <PipAnchor id="x" className="anchor-b" />
          )}
        </PipProvider>
      );
    }
    const { rerender, container } = render(<App activeRoute="A" />);
    const anchorA = container.querySelector('.anchor-a') as HTMLElement;
    const shuttle = document.querySelector('[data-pip-shuttle="x"]') as HTMLElement;
    expect(shuttle.parentElement).toBe(anchorA);

    rerender(<App activeRoute="B" />);
    const anchorB = container.querySelector('.anchor-b') as HTMLElement;
    expect(shuttle.parentElement).toBe(anchorB);
  });

  it('route handoff: mount B then unmount A', () => {
    function App({ showA, showB }: { showA: boolean; showB: boolean }) {
      return (
        <PipProvider registry={{ x: <div>Content</div> }}>
          {showA && <PipAnchor id="x" className="anchor-a" />}
          {showB && <PipAnchor id="x" className="anchor-b" />}
        </PipProvider>
      );
    }
    const { rerender, container } = render(<App showA={true} showB={false} />);
    const anchorA = container.querySelector('.anchor-a') as HTMLElement;
    const shuttle = document.querySelector('[data-pip-shuttle="x"]') as HTMLElement;
    expect(shuttle.parentElement).toBe(anchorA);

    // Mount B while A is still mounted
    rerender(<App showA={true} showB={true} />);
    const anchorB = container.querySelector('.anchor-b') as HTMLElement;
    expect(shuttle.parentElement).toBe(anchorB);

    // Unmount A
    rerender(<App showA={false} showB={true} />);
    expect(shuttle.parentElement).toBe(anchorB);
  });

  it('stale release is inert', () => {
    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    const nodeA = document.createElement('div');
    const nodeB = document.createElement('div');
    document.body.appendChild(nodeA);
    document.body.appendChild(nodeB);

    render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <Probe />
      </PipProvider>
    );

    const listener = vi.fn();
    teleportApi!.subscribePlacement('a', listener);

    act(() => {
      teleportApi!.claimAnchor('a', nodeA);
    });
    expect(listener).toHaveBeenCalledTimes(1);

    act(() => {
      teleportApi!.claimAnchor('a', nodeB);
    });
    // Placement stayed 'anchor', placement didn't change so listener not called again
    expect(teleportApi!.getPlacement('a')).toBe('anchor');

    listener.mockClear();

    // Release stale A
    act(() => {
      teleportApi!.releaseAnchor('a', nodeA);
    });
    expect(listener).not.toHaveBeenCalled();
    expect(teleportApi!.getPlacement('a')).toBe('anchor');

    nodeA.remove();
    nodeB.remove();
  });

  it('falls back to a remaining claim before parking', () => {
    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    const nodeA = document.createElement('div');
    const nodeB = document.createElement('div');
    document.body.appendChild(nodeA);
    document.body.appendChild(nodeB);

    render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <Probe />
      </PipProvider>
    );

    act(() => {
      teleportApi!.claimAnchor('a', nodeA);
      teleportApi!.claimAnchor('a', nodeB);
    });

    // Release B (the current owner)
    act(() => {
      teleportApi!.releaseAnchor('a', nodeB);
    });

    expect(teleportApi!.getPlacement('a')).toBe('anchor');

    nodeA.remove();
    nodeB.remove();
  });

  it('registers originEl per claim', () => {
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
    const registerElementsSpy = vi.spyOn(instance, 'registerElements');

    const boxElement = document.createElement('div');
    document.body.appendChild(boxElement);

    act(() => {
      teleportApi!.claimAnchor('a', boxElement);
    });

    expect(registerElementsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ originEl: boxElement })
    );

    boxElement.remove();
    registerElementsSpy.mockRestore();
  });

  it('releases the correct origin registration', () => {
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

    const nodeA = document.createElement('div');
    const nodeB = document.createElement('div');
    document.body.appendChild(nodeA);
    document.body.appendChild(nodeB);

    const handleA: core.ElementRegistration = {
      update: vi.fn(),
      release: vi.fn(),
      released: false,
    };
    const handleB: core.ElementRegistration = {
      update: vi.fn(),
      release: vi.fn(),
      released: false,
    };

    const registerElementsSpy = vi
      .spyOn(instance, 'registerElements')
      .mockImplementation((patch) => {
        if (patch.originEl === nodeA) return handleA;
        if (patch.originEl === nodeB) return handleB;
        return { update: vi.fn(), release: vi.fn(), released: false };
      });

    act(() => {
      teleportApi!.claimAnchor('a', nodeA);
      teleportApi!.claimAnchor('a', nodeB);
    });

    act(() => {
      teleportApi!.releaseAnchor('a', nodeA);
    });

    expect(handleA.release).toHaveBeenCalledTimes(1);
    expect(handleB.release).not.toHaveBeenCalled();

    nodeA.remove();
    nodeB.remove();
    registerElementsSpy.mockRestore();
  });

  it("registers contentEl as the shuttle's first element child", () => {
    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    render(
      <PipProvider registry={{ a: <div data-testid="root-el">Hosted Root</div> }}>
        <Probe />
      </PipProvider>
    );
    const shuttle = document.querySelector('[data-pip-shuttle="a"]') as HTMLElement;
    const hostedRoot = shuttle.querySelector('[data-testid="root-el"]') as HTMLElement;
    expect(hostedRoot).toBeTruthy();

    const instance = teleportApi!.getInstance('a')!;
    expect(instance.getDefaultElements().contentEl).toBe(hostedRoot);
  });

  it('falls back to the shuttle for a null subtree', () => {
    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    render(
      <PipProvider registry={{ a: null }}>
        <Probe />
      </PipProvider>
    );
    const shuttle = document.querySelector('[data-pip-shuttle="a"]') as HTMLElement;
    expect(shuttle).toBeTruthy();

    const instance = teleportApi!.getInstance('a')!;
    expect(instance.getDefaultElements().contentEl).toBe(shuttle);
  });

  it('re-registers contentEl when the subtree root changes', () => {
    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    const { rerender } = render(
      <PipProvider registry={{ a: <h1 data-testid="h1">Header</h1> }}>
        <Probe />
      </PipProvider>
    );
    const instance = teleportApi!.getInstance('a')!;
    const shuttle = document.querySelector('[data-pip-shuttle="a"]') as HTMLElement;
    const h1 = shuttle.querySelector('h1') as HTMLElement;
    expect(instance.getDefaultElements().contentEl).toBe(h1);

    rerender(
      <PipProvider registry={{ a: <p data-testid="p">Paragraph</p> }}>
        <Probe />
      </PipProvider>
    );
    const p = shuttle.querySelector('p') as HTMLElement;
    expect(instance.getDefaultElements().contentEl).toBe(p);
  });

  it('registers and unregisters with the instance', () => {
    const registerSpy = vi.spyOn(core, 'registerPip');
    const unregisterSpy = vi.spyOn(core, 'unregisterPip');

    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }

    const { unmount } = render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <Probe />
      </PipProvider>
    );

    const instance = teleportApi!.getInstance('a')!;
    expect(registerSpy).toHaveBeenCalledWith('a', instance);

    unmount();
    expect(unregisterSpy).toHaveBeenCalledWith('a', instance);

    registerSpy.mockRestore();
    unregisterSpy.mockRestore();
  });

  it('two providers share one garage', () => {
    render(
      <>
        <PipProvider registry={{ a: <div>A</div> }}>
          <div>Provider 1</div>
        </PipProvider>
        <PipProvider registry={{ b: <div>B</div> }}>
          <div>Provider 2</div>
        </PipProvider>
      </>
    );
    const garages = document.querySelectorAll(`[${GARAGE_ATTR}]`);
    expect(garages.length).toBe(1);
  });

  it('adds a registry key after mount', () => {
    let aCount = 0;
    function A() {
      useEffect(() => {
        aCount++;
      }, []);
      return <div>A</div>;
    }
    const { rerender } = render(
      <PipProvider registry={{ a: <A /> }}>
        <div>App</div>
      </PipProvider>
    );
    expect(document.querySelectorAll('[data-pip-shuttle]').length).toBe(1);
    expect(aCount).toBe(1);

    rerender(
      <PipProvider registry={{ a: <A />, b: <div>B</div> }}>
        <div>App</div>
      </PipProvider>
    );
    expect(document.querySelectorAll('[data-pip-shuttle]').length).toBe(2);
    expect(aCount).toBe(1);
  });

  it('hasId reflects the current registry', () => {
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
    expect(teleportApi!.hasId('a')).toBe(true);
    expect(teleportApi!.hasId('b')).toBe(false);

    rerender(
      <PipProvider registry={{ a: <div>A</div>, b: <div>B</div> }}>
        <Probe />
      </PipProvider>
    );
    expect(teleportApi!.hasId('b')).toBe(true);
  });

  it('duplicate anchors warn once after a frame in dev', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <PipAnchor id="a" className="anchor-1" />
        <PipAnchor id="a" className="anchor-2" />
      </PipProvider>
    );

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('ERR_DUPLICATE_ANCHOR');
    warnSpy.mockRestore();
  });

  it('duplicate anchors do not warn in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <PipAnchor id="a" className="anchor-1" />
        <PipAnchor id="a" className="anchor-2" />
      </PipProvider>
    );

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('opener visibility drives the store', () => {
    let hostApi: PipHostApi | null = null;
    function HostedChild() {
      hostApi = useHost();
      return <div>Hosted</div>;
    }
    render(
      <PipProvider registry={{ a: <HostedChild /> }}>
        <PipAnchor id="a" />
      </PipProvider>
    );
    expect(hostApi!.getSnapshot().level).toBe('active');

    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(hostApi!.getSnapshot().level).toBe('background');

    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(hostApi!.getSnapshot().level).toBe('active');
  });

  it('freeze freezes every host', () => {
    let hostApi: PipHostApi | null = null;
    function HostedChild() {
      hostApi = useHost();
      return <div>Hosted</div>;
    }
    render(
      <PipProvider registry={{ a: <HostedChild /> }}>
        <PipAnchor id="a" />
      </PipProvider>
    );
    expect(hostApi!.getSnapshot().level).toBe('active');

    act(() => {
      window.dispatchEvent(new Event('freeze'));
    });
    expect(hostApi!.getSnapshot().level).toBe('frozen');
  });

  it('resume restores the level', () => {
    let hostApi: PipHostApi | null = null;
    function HostedChild() {
      hostApi = useHost();
      return <div>Hosted</div>;
    }
    render(
      <PipProvider registry={{ a: <HostedChild /> }}>
        <PipAnchor id="a" />
      </PipProvider>
    );

    act(() => {
      window.dispatchEvent(new Event('freeze'));
    });
    expect(hostApi!.getSnapshot().level).toBe('frozen');

    act(() => {
      window.dispatchEvent(new Event('resume'));
    });
    expect(hostApi!.getSnapshot().level).toBe('active');
  });

  it('pauses dormant media by default', () => {
    const pauseSpy = vi.fn();
    function VideoChild() {
      const videoRef = useCallback((el: HTMLVideoElement | null) => {
        if (el) {
          Object.defineProperty(el, 'paused', { value: false, configurable: true });
          el.pause = pauseSpy;
        }
      }, []);
      return <video ref={videoRef} />;
    }
    function App({ docked }: { docked: boolean }) {
      return (
        <PipProvider registry={{ a: <VideoChild /> }}>
          {docked && <PipAnchor id="a" />}
        </PipProvider>
      );
    }
    const { rerender } = render(<App docked={true} />);
    expect(pauseSpy).not.toHaveBeenCalled();

    rerender(<App docked={false} />);
    expect(pauseSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps dormant media when configured', () => {
    const pauseSpy = vi.fn();
    function VideoChild() {
      const videoRef = useCallback((el: HTMLVideoElement | null) => {
        if (el) {
          Object.defineProperty(el, 'paused', { value: false, configurable: true });
          el.pause = pauseSpy;
        }
      }, []);
      return <video ref={videoRef} />;
    }
    function App({ docked }: { docked: boolean }) {
      return (
        <PipProvider registry={{ a: <VideoChild /> }} dormantMedia="keep">
          {docked && <PipAnchor id="a" />}
        </PipProvider>
      );
    }
    const { rerender } = render(<App docked={true} />);
    rerender(<App docked={false} />);
    expect(pauseSpy).not.toHaveBeenCalled();
  });

  it('resumes media on reveal', () => {
    const playSpy = vi.fn().mockReturnValue(Promise.resolve());
    function VideoChild() {
      const videoRef = useCallback((el: HTMLVideoElement | null) => {
        if (el) {
          Object.defineProperty(el, 'paused', { value: false, configurable: true });
          el.pause = vi.fn();
          el.play = playSpy;
        }
      }, []);
      return <video ref={videoRef} />;
    }
    function App({ docked }: { docked: boolean }) {
      return (
        <PipProvider registry={{ a: <VideoChild /> }}>
          {docked && <PipAnchor id="a" />}
        </PipProvider>
      );
    }
    const { rerender } = render(<App docked={true} />);
    rerender(<App docked={false} />);
    expect(playSpy).not.toHaveBeenCalled();

    rerender(<App docked={true} />);
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it('swallows a rejected play on reveal', async () => {
    const playSpy = vi
      .fn()
      .mockReturnValue(Promise.reject(new Error('Autoplay blocked')));
    function VideoChild() {
      const videoRef = useCallback((el: HTMLVideoElement | null) => {
        if (el) {
          Object.defineProperty(el, 'paused', { value: false, configurable: true });
          el.pause = vi.fn();
          el.play = playSpy;
        }
      }, []);
      return <video ref={videoRef} />;
    }
    function App({ docked }: { docked: boolean }) {
      return (
        <PipProvider registry={{ a: <VideoChild /> }}>
          {docked && <PipAnchor id="a" />}
        </PipProvider>
      );
    }
    const { rerender } = render(<App docked={true} />);
    rerender(<App docked={false} />);
    expect(() => {
      rerender(<App docked={true} />);
    }).not.toThrow();
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it('failed open leaves placement at anchor', async () => {
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
    expect(teleportApi!.getPlacement('a')).toBe('anchor');

    const mock = (
      window as unknown as {
        documentPictureInPicture: { requestWindow: () => Promise<Window> };
      }
    ).documentPictureInPicture;
    const originalRequest = mock.requestWindow;
    mock.requestWindow = vi
      .fn()
      .mockRejectedValue(new DOMException('Not allowed', 'NotAllowedError'));

    const instance = teleportApi!.getInstance('a')!;
    try {
      await instance.open();
    } catch {
      /* expected rejection */
    }

    expect(teleportApi!.getPlacement('a')).toBe('anchor');
    mock.requestWindow = originalRequest;
  });

  // The provider's sweep is deferred by one macrotask so a React Strict Mode remount can cancel
  // it (see the Strict Mode regression tests above). A real unmount is not followed by a mount,
  // so the sweep still runs - one macrotask later. The assertions below are unchanged; only the
  // wait was added.
  it('unmount destroys instances and removes shuttles', async () => {
    let teleportApi: PipTeleportApi | null = null;
    function Probe() {
      teleportApi = useTeleport();
      return null;
    }
    const { unmount } = render(
      <PipProvider registry={{ a: <div>A</div> }}>
        <Probe />
      </PipProvider>
    );
    const instance = teleportApi!.getInstance('a')!;
    const shuttle = document.querySelector('[data-pip-shuttle="a"]') as HTMLElement;
    expect(shuttle).toBeTruthy();
    expect(shuttle.isConnected).toBe(true);

    unmount();
    // Not swept yet: the provider could still be remounting (Strict Mode).
    expect(instance.destroyed).toBe(false);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(instance.destroyed).toBe(true);
    expect(shuttle.isConnected).toBe(false);
  });

  it('SSR renders children and no portals', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const html = renderToString(
      <PipProvider registry={{ a: <div>Inside Shuttle</div> }}>
        <div data-testid="child">Hello Server</div>
      </PipProvider>
    );
    expect(html).toContain('Hello Server');
    expect(html).not.toContain('data-pip-shuttle');
    expect(html).not.toContain('Inside Shuttle');
    errorSpy.mockRestore();
  });

  it('hydration logs no mismatch', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const container = document.createElement('div');
    document.body.appendChild(container);

    const html = renderToString(
      <PipProvider registry={{ a: <div>Inside Shuttle</div> }}>
        <div>Hydration Child</div>
      </PipProvider>
    );
    errorSpy.mockClear();

    container.innerHTML = html;

    let root: ReturnType<typeof hydrateRoot> | null = null;
    act(() => {
      root = hydrateRoot(
        container,
        <PipProvider registry={{ a: <div>Inside Shuttle</div> }}>
          <div>Hydration Child</div>
        </PipProvider>
      );
    });

    expect(errorSpy).not.toHaveBeenCalled();

    act(() => {
      root?.unmount();
    });
    container.remove();
    errorSpy.mockRestore();
  });

  it('Strict Mode yields one shuttle and one instance', () => {
    const createPipSpy = vi.spyOn(core, 'createPip');
    render(
      <React.StrictMode>
        <PipProvider registry={{ a: <div>A</div> }}>
          <div>Strict Mode Child</div>
        </PipProvider>
      </React.StrictMode>
    );
    const shuttles = document.querySelectorAll('[data-pip-shuttle="a"]');
    expect(shuttles.length).toBe(1);
    expect(createPipSpy).toHaveBeenCalledTimes(1);
    createPipSpy.mockRestore();
  });

  it('resolveContentEl returns first child or shuttle itself', () => {
    const shuttle = document.createElement('div');
    expect(resolveContentEl(shuttle)).toBe(shuttle);

    const child = document.createElement('span');
    shuttle.appendChild(child);
    expect(resolveContentEl(shuttle)).toBe(child);
  });

  it('claimAnchor for an unknown id is a no-op', () => {
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
    const orphanNode = document.createElement('div');
    expect(() => {
      teleportApi!.claimAnchor('unknown', orphanNode);
      teleportApi!.releaseAnchor('unknown', orphanNode);
    }).not.toThrow();
  });

  it('getPlacement for an unknown id returns garage, never undefined', () => {
    let api!: PipTeleportApi;
    function Probe() {
      api = useTeleport();
      return null;
    }
    render(
      <PipProvider registry={{ a: <div /> }}>
        <Probe />
      </PipProvider>
    );
    expect(api.getPlacement('does-not-exist')).toBe('garage');
    expect(api.getPlacement('does-not-exist')).not.toBeUndefined();
  });

  it('getLastDockedSize for an unknown id returns null, never undefined', () => {
    let api!: PipTeleportApi;
    function Probe() {
      api = useTeleport();
      return null;
    }
    render(
      <PipProvider registry={{ a: <div /> }}>
        <Probe />
      </PipProvider>
    );
    expect(api.getLastDockedSize('does-not-exist')).toBeNull();
    expect(api.getLastDockedSize('does-not-exist')).not.toBeUndefined();
  });

  it('subscribePlacement disposer is safe to call twice', () => {
    let api!: PipTeleportApi;
    function Probe() {
      api = useTeleport();
      return null;
    }
    render(
      <PipProvider registry={{ a: <div /> }}>
        <Probe />
      </PipProvider>
    );
    const un = api.subscribePlacement('a', vi.fn());
    expect(() => {
      un();
      un();
    }).not.toThrow();

    const unUnknown = api.subscribePlacement('nope', vi.fn());
    expect(() => {
      unUnknown();
      unUnknown();
    }).not.toThrow();
  });
});
