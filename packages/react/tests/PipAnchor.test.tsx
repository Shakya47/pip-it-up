import React from 'react';
import { render, act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PipAnchor } from '../src/PipAnchor';
import {
  PipTeleportContext,
  type PipTeleportApi,
  type Placement,
} from '../src/PipTeleportContext';
import { PipError } from '../src/errors';

function createMockTeleportApi(
  overrides?: Partial<PipTeleportApi>
): PipTeleportApi {
  return {
    claimAnchor: vi.fn(),
    releaseAnchor: vi.fn(),
    reportDockedSize: vi.fn(),
    getLastDockedSize: vi.fn().mockReturnValue(null),
    getPlacement: vi.fn().mockReturnValue('anchor'),
    getInstance: vi.fn().mockReturnValue(null),
    hasId: vi.fn().mockReturnValue(true),
    subscribePlacement: vi.fn().mockReturnValue(() => {}),
    ...overrides,
  };
}

describe('PipAnchor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('throws outside a provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let thrown: unknown;
    try {
      render(<PipAnchor id="x" />);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(PipError);
    expect((thrown as PipError).code).toBe('ERR_NO_PROVIDER');
    consoleSpy.mockRestore();
  });

  it('throws on an unknown id in dev', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = createMockTeleportApi({
      hasId: vi.fn().mockReturnValue(false),
    });

    let thrown: unknown;
    try {
      render(
        <PipTeleportContext.Provider value={api}>
          <PipAnchor id="x" />
        </PipTeleportContext.Provider>
      );
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(PipError);
    expect((thrown as PipError).code).toBe('ERR_UNKNOWN_ID');
    consoleSpy.mockRestore();
  });

  it('warns on an unknown id in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const api = createMockTeleportApi({
      hasId: vi.fn().mockReturnValue(false),
    });

    expect(() => {
      render(
        <PipTeleportContext.Provider value={api}>
          <PipAnchor id="x" />
        </PipTeleportContext.Provider>
      );
    }).not.toThrow();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('ERR_UNKNOWN_ID');
    warnSpy.mockRestore();
  });

  it('renders a real box', () => {
    const api = createMockTeleportApi({
      getPlacement: vi.fn().mockReturnValue('anchor'),
    });

    const { container } = render(
      <PipTeleportContext.Provider value={api}>
        <PipAnchor id="x" />
      </PipTeleportContext.Provider>
    );

    const el = container.querySelector('[data-pip-anchor="x"]') as HTMLElement;
    expect(el).toBeTruthy();
    const computed = getComputedStyle(el);
    expect(computed.position).toBe('relative');
    expect(computed.display).toBe('block');
  });

  it('warns in dev on display contents', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const api = createMockTeleportApi();

    render(
      <PipTeleportContext.Provider value={api}>
        <PipAnchor id="x" style={{ display: 'contents' }} />
      </PipTeleportContext.Provider>
    );

    expect(warnSpy).toHaveBeenCalled();
    const found = warnSpy.mock.calls.some((call) =>
      call.some(
        (arg) =>
          typeof arg === 'string' && arg.includes('must generate a real box')
      )
    );
    expect(found).toBe(true);
    warnSpy.mockRestore();
  });

  it('warns in dev on position static', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const api = createMockTeleportApi();

    render(
      <PipTeleportContext.Provider value={api}>
        <PipAnchor id="x" style={{ position: 'static' }} />
      </PipTeleportContext.Provider>
    );

    expect(warnSpy).toHaveBeenCalled();
    const found = warnSpy.mock.calls.some((call) =>
      call.some(
        (arg) =>
          typeof arg === 'string' &&
          arg.includes('must be a positioned element')
      )
    );
    expect(found).toBe(true);
    warnSpy.mockRestore();
  });

  it('claims on mount', () => {
    const claimAnchorSpy = vi.fn();
    const api = createMockTeleportApi({ claimAnchor: claimAnchorSpy });

    const { container } = render(
      <PipTeleportContext.Provider value={api}>
        <PipAnchor id="x" />
      </PipTeleportContext.Provider>
    );

    const el = container.querySelector('[data-pip-anchor="x"]') as HTMLElement;
    expect(claimAnchorSpy).toHaveBeenCalledWith('x', el);
  });

  it('releases the originally claimed node on unmount', () => {
    const releaseAnchorSpy = vi.fn();
    const api = createMockTeleportApi({ releaseAnchor: releaseAnchorSpy });

    const { container, rerender, unmount } = render(
      <PipTeleportContext.Provider value={api}>
        <PipAnchor id="x" className="initial" />
      </PipTeleportContext.Provider>
    );

    const originalEl = container.querySelector(
      '[data-pip-anchor="x"]'
    ) as HTMLElement;

    rerender(
      <PipTeleportContext.Provider value={api}>
        <PipAnchor id="x" className="updated" />
      </PipTeleportContext.Provider>
    );

    unmount();

    expect(releaseAnchorSpy).toHaveBeenCalledWith('x', originalEl);
  });

  it('renders the placeholder only while reserved', () => {
    let currentPlacement: Placement = 'garage';
    let listeners: Array<() => void> = [];
    const api = createMockTeleportApi({
      getPlacement: vi.fn(() => currentPlacement),
      subscribePlacement: vi.fn((id, fn) => {
        listeners.push(fn);
        return () => {
          listeners = listeners.filter((l) => l !== fn);
        };
      }),
    });

    const { container } = render(
      <PipTeleportContext.Provider value={api}>
        <PipAnchor id="x" placeholder={<span>Holding space</span>} />
      </PipTeleportContext.Provider>
    );

    expect(container.querySelector('[data-pip-placeholder]')).not.toBeNull();

    act(() => {
      currentPlacement = 'anchor';
      listeners.forEach((l) => l());
    });

    expect(container.querySelector('[data-pip-placeholder]')).toBeNull();
  });

  it('renders no wrapper when no placeholder is supplied', () => {
    const api = createMockTeleportApi({
      getPlacement: vi.fn().mockReturnValue('garage'),
    });

    const { container } = render(
      <PipTeleportContext.Provider value={api}>
        <PipAnchor id="x" />
      </PipTeleportContext.Provider>
    );

    expect(container.querySelector('[data-pip-placeholder]')).toBeNull();
  });

  it('placeholder is positioned out of flow', () => {
    const api = createMockTeleportApi({
      getPlacement: vi.fn().mockReturnValue('garage'),
    });

    const { container } = render(
      <PipTeleportContext.Provider value={api}>
        <PipAnchor id="x" placeholder={<div>Loading...</div>} />
      </PipTeleportContext.Provider>
    );

    const placeholderEl = container.querySelector(
      '[data-pip-placeholder]'
    ) as HTMLElement;
    expect(placeholderEl).toBeTruthy();
    expect(placeholderEl.style.position).toBe('absolute');
    expect(placeholderEl.style.inset).toBe('0px');
  });

  it('applies the reservation while reserved', () => {
    const api = createMockTeleportApi({
      getPlacement: vi.fn().mockReturnValue('garage'),
      getLastDockedSize: vi
        .fn()
        .mockReturnValue({ inlineSize: 300, blockSize: 200 }),
    });

    const { container } = render(
      <PipTeleportContext.Provider value={api}>
        <PipAnchor id="x" />
      </PipTeleportContext.Provider>
    );

    const el = container.querySelector('[data-pip-anchor="x"]') as HTMLElement;
    expect(el.style.minBlockSize).toBe('200px');
  });

  it('applies no reservation when docked', () => {
    const api = createMockTeleportApi({
      getPlacement: vi.fn().mockReturnValue('anchor'),
      getLastDockedSize: vi
        .fn()
        .mockReturnValue({ inlineSize: 300, blockSize: 200 }),
    });

    const { container } = render(
      <PipTeleportContext.Provider value={api}>
        <PipAnchor id="x" />
      </PipTeleportContext.Provider>
    );

    const el = container.querySelector('[data-pip-anchor="x"]') as HTMLElement;
    expect(el.style.minBlockSize).toBe('');
  });

  it('reserve none applies no reservation', () => {
    const api = createMockTeleportApi({
      getPlacement: vi.fn().mockReturnValue('garage'),
      getLastDockedSize: vi
        .fn()
        .mockReturnValue({ inlineSize: 300, blockSize: 200 }),
    });

    const { container } = render(
      <PipTeleportContext.Provider value={api}>
        <PipAnchor id="x" reserve="none" />
      </PipTeleportContext.Provider>
    );

    const el = container.querySelector('[data-pip-anchor="x"]') as HTMLElement;
    expect(el.style.minBlockSize).toBe('');
  });

  it('caller style overrides the base', () => {
    const api = createMockTeleportApi();

    const { container } = render(
      <PipTeleportContext.Provider value={api}>
        <PipAnchor id="x" style={{ display: 'inline-block' }} />
      </PipTeleportContext.Provider>
    );

    const el = container.querySelector('[data-pip-anchor="x"]') as HTMLElement;
    const computed = getComputedStyle(el);
    expect(computed.display).toBe('inline-block');
  });

  it('one net claim under Strict Mode', () => {
    const claimCalls: HTMLElement[] = [];
    const releaseCalls: (HTMLElement | null)[] = [];
    const api = createMockTeleportApi({
      claimAnchor: vi.fn((id, node) => claimCalls.push(node)),
      releaseAnchor: vi.fn((id, node) => releaseCalls.push(node)),
    });

    render(
      <React.StrictMode>
        <PipTeleportContext.Provider value={api}>
          <PipAnchor id="x" />
        </PipTeleportContext.Provider>
      </React.StrictMode>
    );

    const netClaims = claimCalls.length - releaseCalls.length;
    expect(netClaims).toBe(1);
  });

  it('SSR renders the box and placeholder without throwing', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = createMockTeleportApi({
      getPlacement: vi.fn().mockReturnValue('garage'),
    });

    const html = renderToString(
      <PipTeleportContext.Provider value={api}>
        <PipAnchor id="x" placeholder={<span>Loading</span>} />
      </PipTeleportContext.Provider>
    );

    expect(html).toContain('data-pip-anchor="x"');
    expect(html).toContain('data-pip-placeholder');
    errorSpy.mockRestore();
  });

  it('hydration logs no mismatch', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = createMockTeleportApi({
      getPlacement: vi.fn().mockReturnValue('garage'),
    });

    const markup = renderToString(
      <PipTeleportContext.Provider value={api}>
        <PipAnchor id="x" placeholder={<span>Loading</span>} />
      </PipTeleportContext.Provider>
    );
    errorSpy.mockClear();

    const container = document.createElement('div');
    container.innerHTML = markup;
    document.body.appendChild(container);

    let root: ReturnType<typeof hydrateRoot> | null = null;
    act(() => {
      root = hydrateRoot(
        container,
        <PipTeleportContext.Provider value={api}>
          <PipAnchor id="x" placeholder={<span>Loading</span>} />
        </PipTeleportContext.Provider>
      );
    });

    expect(errorSpy).not.toHaveBeenCalled();

    act(() => {
      root?.unmount();
    });
    container.remove();
    errorSpy.mockRestore();
  });

  it('as span produces a real box with display block', () => {
    const api = createMockTeleportApi();

    const { container } = render(
      <PipTeleportContext.Provider value={api}>
        <PipAnchor id="x" as="span" />
      </PipTeleportContext.Provider>
    );

    const el = container.querySelector('span[data-pip-anchor="x"]') as HTMLElement;
    expect(el).toBeTruthy();
    const computed = getComputedStyle(el);
    expect(computed.display).toBe('block');
    expect(computed.position).toBe('relative');
  });

  it('route handoff in either commit order leaves the newest anchor as the claim owner', () => {
    const claims: Array<{ id: string; node: HTMLElement }> = [];
    const releases: Array<{ id: string; node: HTMLElement | null }> = [];
    const api = createMockTeleportApi({
      claimAnchor: vi.fn((id, node) => claims.push({ id, node })),
      releaseAnchor: vi.fn((id, node) => releases.push({ id, node })),
    });

    const { unmount: unmountA, container: containerA } = render(
      <PipTeleportContext.Provider value={api}>
        <PipAnchor id="route-id" />
      </PipTeleportContext.Provider>
    );
    const nodeA = containerA.querySelector('[data-pip-anchor="route-id"]') as HTMLElement;

    const { container: containerB } = render(
      <PipTeleportContext.Provider value={api}>
        <PipAnchor id="route-id" />
      </PipTeleportContext.Provider>
    );
    const nodeB = containerB.querySelector('[data-pip-anchor="route-id"]') as HTMLElement;

    // A unmounts after B mounts
    unmountA();

    expect(claims).toHaveLength(2);
    expect(claims[0]).toEqual({ id: 'route-id', node: nodeA });
    expect(claims[1]).toEqual({ id: 'route-id', node: nodeB });
    expect(releases).toHaveLength(1);
    expect(releases[0]).toEqual({ id: 'route-id', node: nodeA });
  });
});
