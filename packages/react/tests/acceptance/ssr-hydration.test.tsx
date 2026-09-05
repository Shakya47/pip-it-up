import React, { act } from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import * as core from '@pip-it-up/core';
import {
  PipProvider,
  PipAnchor,
  useDormancy,
} from '../../src/index';
import { PipHostContext, PipTeleportContext, type PipHostApi, type PipTeleportApi } from '../../src/PipTeleportContext';
import { createDormancyStore } from '../../src/dormancy';
import { __latestEntriesForTests } from '../../src/PipProvider';
import { __resetGarageCacheForTests, GARAGE_ATTR } from '../../src/garage';

// @ts-expect-error React 18 testing environment flag for act(...)
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** Captures every console.error during `fn` and returns them. React reports hydration mismatches there. */
async function captureConsoleErrors(fn: () => Promise<void> | void): Promise<string[]> {
  const errors: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args.map((a) => (typeof a === 'string' ? a : String(a))).join(' '));
  };
  try {
    await fn();
  } finally {
    console.error = original;
  }
  return errors;
}

describe('SSR, hydration, and Strict Mode survival suite (TEST-805)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const msg = args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ');
      if (msg.includes('useLayoutEffect does nothing on the server')) {
        return;
      }
      // eslint-disable-next-line no-console
      console.warn('[captured console.error]', msg);
    });
  });

  afterEach(() => {
    document.querySelectorAll(`[${GARAGE_ATTR}]`).forEach((el) => el.remove());
    document.querySelectorAll('[data-pip-shuttle]').forEach((el) => el.remove());
    __resetGarageCacheForTests();
    vi.restoreAllMocks();
  });

  it('renderToString does not throw', () => {
    expect(() => {
      renderToString(
        <PipProvider
          registry={{
            a: <video src="test.mp4" data-testid="hosted-video" />,
          }}
        >
          <div>
            <h1>Page</h1>
            <PipAnchor id="a" placeholder={<div data-testid="ph">Loading</div>} />
          </div>
        </PipProvider>
      );
    }).not.toThrow();
  });

  it('server output has no shuttle', () => {
    const html = renderToString(
      <PipProvider
        registry={{
          a: <video src="test.mp4" data-testid="hosted-video" />,
        }}
      >
        <div>
          <h1>Page</h1>
          <PipAnchor id="a" placeholder={<div data-testid="ph">Loading</div>} />
        </div>
      </PipProvider>
    );

    expect(html).not.toContain('data-pip-shuttle');
  });

  it('server output has no garage', () => {
    const html = renderToString(
      <PipProvider
        registry={{
          a: <video src="test.mp4" data-testid="hosted-video" />,
        }}
      >
        <div>
          <h1>Page</h1>
          <PipAnchor id="a" placeholder={<div data-testid="ph">Loading</div>} />
        </div>
      </PipProvider>
    );

    expect(html).not.toContain('data-pip-garage');
  });

  it('server output has the anchor and placeholder', () => {
    const html = renderToString(
      <PipProvider
        registry={{
          a: <video src="test.mp4" data-testid="hosted-video" />,
        }}
      >
        <div>
          <h1>Page</h1>
          <PipAnchor id="a" placeholder={<div data-testid="ph">Loading</div>} />
        </div>
      </PipProvider>
    );

    expect(html).toContain('data-pip-anchor="a"');
    expect(html).toContain('data-pip-placeholder');
    expect(html).toContain('Loading');
  });

  it('server pass creates no DOM nodes', () => {
    const createElementSpy = vi.spyOn(document, 'createElement');
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');

    renderToString(
      <PipProvider
        registry={{
          a: <video src="test.mp4" data-testid="hosted-video" />,
        }}
      >
        <PipAnchor id="a" placeholder={<div>Loading</div>} />
      </PipProvider>
    );

    // In renderToString, document.createElement and document.body.appendChild are not invoked
    expect(appendChildSpy).not.toHaveBeenCalled();
    const createdPipElement = createElementSpy.mock.calls.some(([tag]) => tag === 'div');
    expect(createdPipElement).toBe(false);
  });

  it('hydration logs zero errors', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const vdom = (
      <PipProvider
        registry={{
          a: <video src="test.mp4" data-testid="hosted-video" />,
        }}
      >
        <div>
          <h1>Page</h1>
          <PipAnchor id="a" placeholder={<div data-testid="ph">Loading</div>} />
        </div>
      </PipProvider>
    );

    const html = renderToString(vdom);
    container.innerHTML = html;

    let root: ReturnType<typeof hydrateRoot> | null = null;
    const errors = await captureConsoleErrors(() => {
      act(() => {
        root = hydrateRoot(container, vdom);
      });
    });

    expect(errors).toHaveLength(0);

    act(() => {
      root?.unmount();
    });
    container.remove();
  });

  it('negative control does log an error', async () => {
    let isServerPass = true;

    function BranchingSubtree() {
      // Intentionally create mismatch between SSR markup and client hydration
      return <div data-testid="branch">{isServerPass ? 'Server Rendered' : 'Client Hydrated'}</div>;
    }

    const container = document.createElement('div');
    document.body.appendChild(container);

    isServerPass = true;
    const serverVdom = (
      <PipProvider registry={{ a: <div>Hosted</div> }}>
        <BranchingSubtree />
      </PipProvider>
    );
    const html = renderToString(serverVdom);
    container.innerHTML = html;

    isServerPass = false;
    const clientVdom = (
      <PipProvider registry={{ a: <div>Hosted</div> }}>
        <BranchingSubtree />
      </PipProvider>
    );

    let root: ReturnType<typeof hydrateRoot> | null = null;
    const errors = await captureConsoleErrors(() => {
      act(() => {
        root = hydrateRoot(container, clientVdom);
      });
    });

    expect(errors.length).toBeGreaterThanOrEqual(1);

    act(() => {
      root?.unmount();
    });
    container.remove();
  });

  it('shuttle attaches only after hydration', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const vdom = (
      <PipProvider registry={{ a: <video src="test.mp4" /> }}>
        <div>
          <PipAnchor id="a" placeholder={<div>Loading</div>} />
        </div>
      </PipProvider>
    );

    const html = renderToString(vdom);
    container.innerHTML = html;

    // Immediately before hydrateRoot, no shuttle exists in DOM
    expect(document.querySelector('[data-pip-shuttle="a"]')).toBeNull();

    let root: ReturnType<typeof hydrateRoot> | null = null;
    act(() => {
      root = hydrateRoot(container, vdom);
    });

    // After hydration flushes, exactly one shuttle attaches
    expect(document.querySelectorAll('[data-pip-shuttle="a"]').length).toBe(1);

    act(() => {
      root?.unmount();
    });
    container.remove();
  });

  it('Strict Mode yields one shuttle per id', () => {
    render(
      <React.StrictMode>
        <PipProvider
          registry={{
            a: <div data-testid="hosted-a">Hosted A</div>,
            b: <div data-testid="hosted-b">Hosted B</div>,
          }}
        >
          <PipAnchor id="a" />
          <PipAnchor id="b" />
        </PipProvider>
      </React.StrictMode>
    );

    expect(document.querySelectorAll('[data-pip-shuttle="a"]').length).toBe(1);
    expect(document.querySelectorAll('[data-pip-shuttle="b"]').length).toBe(1);
    expect(document.querySelectorAll('[data-pip-shuttle]').length).toBe(2);
  });

  it('Strict Mode yields one garage', () => {
    render(
      <React.StrictMode>
        <PipProvider
          registry={{
            a: <div>Hosted A</div>,
          }}
        >
          <PipAnchor id="a" />
        </PipProvider>
      </React.StrictMode>
    );

    expect(document.querySelectorAll(`[${GARAGE_ATTR}]`).length).toBe(1);
  });

  it('Strict Mode creates one instance per id', () => {
    const createPipSpy = vi.spyOn(core, 'createPip');

    render(
      <React.StrictMode>
        <PipProvider
          registry={{
            a: <div>Hosted A</div>,
          }}
        >
          <div>Page</div>
        </PipProvider>
      </React.StrictMode>
    );

    const callsForIdA = createPipSpy.mock.calls.filter(([opts]) => opts?.id === 'a');
    expect(callsForIdA.length).toBe(1);
  });

  it('Strict Mode leaves no orphaned claims', () => {
    const claimCalls: HTMLElement[] = [];
    const releaseCalls: (HTMLElement | null)[] = [];

    const mockApi: PipTeleportApi = {
      claimAnchor: vi.fn((_id: string, node: HTMLElement) => {
        claimCalls.push(node);
      }),
      releaseAnchor: vi.fn((_id: string, node: HTMLElement | null) => {
        releaseCalls.push(node);
      }),
      reportDockedSize: vi.fn(),
      getLastDockedSize: vi.fn().mockReturnValue(null),
      getPlacement: vi.fn().mockReturnValue('anchor'),
      getInstance: vi.fn().mockReturnValue(null),
      hasId: vi.fn().mockReturnValue(true),
      subscribePlacement: vi.fn().mockReturnValue(() => {}),
    };

    render(
      <React.StrictMode>
        <PipTeleportContext.Provider value={mockApi}>
          <PipAnchor id="a" />
        </PipTeleportContext.Provider>
      </React.StrictMode>
    );

    const netClaims = claimCalls.length - releaseCalls.length;
    expect(netClaims).toBe(1);
  });

  it('useDormancy returns the server snapshot during SSR', () => {
    const store = createDormancyStore();
    const hostApi: PipHostApi = {
      id: 'test-host',
      subscribe: (fn) => store.subscribe('test-host', fn),
      getSnapshot: () => store.getSnapshot('test-host'),
      getServerSnapshot: () => store.getServerSnapshot('test-host'),
    };

    function HostedComponent() {
      const snapshot = useDormancy();
      return <div data-testid="level-indicator">{snapshot.level}</div>;
    }

    let html = '';
    expect(() => {
      html = renderToString(
        <PipHostContext.Provider value={hostApi}>
          <HostedComponent />
        </PipHostContext.Provider>
      );
    }).not.toThrow();

    expect(html).toContain('dormant');
  });

  it('two hydrated roots share one garage', () => {
    const container1 = document.createElement('div');
    const container2 = document.createElement('div');
    document.body.appendChild(container1);
    document.body.appendChild(container2);

    const vdom1 = (
      <PipProvider registry={{ a: <div>A</div> }}>
        <PipAnchor id="a" />
      </PipProvider>
    );
    const vdom2 = (
      <PipProvider registry={{ b: <div>B</div> }}>
        <PipAnchor id="b" />
      </PipProvider>
    );

    container1.innerHTML = renderToString(vdom1);
    container2.innerHTML = renderToString(vdom2);

    let root1: ReturnType<typeof hydrateRoot> | null = null;
    let root2: ReturnType<typeof hydrateRoot> | null = null;

    act(() => {
      root1 = hydrateRoot(container1, vdom1);
    });
    act(() => {
      root2 = hydrateRoot(container2, vdom2);
    });

    expect(document.querySelectorAll(`[${GARAGE_ATTR}]`).length).toBe(1);

    act(() => {
      root1?.unmount();
      root2?.unmount();
    });
    container1.remove();
    container2.remove();
  });

  it('unmounting a hydrated root cleans up', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const vdom = (
      <PipProvider registry={{ a: <div>Hosted</div> }}>
        <PipAnchor id="a" />
      </PipProvider>
    );

    container.innerHTML = renderToString(vdom);
    let root: ReturnType<typeof hydrateRoot> | null = null;

    act(() => {
      root = hydrateRoot(container, vdom);
    });

    const entry = __latestEntriesForTests?.get('a');
    expect(entry).toBeDefined();
    expect(entry?.instance.signal.aborted).toBe(false);
    expect(document.querySelectorAll('[data-pip-shuttle="a"]').length).toBe(1);

    act(() => {
      root?.unmount();
    });

    // The provider's sweep is deferred one macrotask so a Strict Mode remount can cancel it.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(document.querySelectorAll('[data-pip-shuttle="a"]').length).toBe(0);
    expect(entry?.instance.signal.aborted).toBe(true);
    container.remove();
  });
});
