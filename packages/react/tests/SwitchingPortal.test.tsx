import React, { useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SwitchingPortal } from '../src/SwitchingPortal';
import { __resetGarageCacheForTests, GARAGE_ATTR } from '../src/garage';

describe('SwitchingPortal', () => {
  afterEach(() => {
    document.querySelectorAll('[data-pip-shuttle]').forEach((el) => el.remove());
    document.querySelectorAll(`[${GARAGE_ATTR}]`).forEach((el) => el.remove());
    __resetGarageCacheForTests();
    vi.restoreAllMocks();
  });

  it('renders children into the shuttle', () => {
    const hostEl = document.createElement('div');
    document.body.appendChild(hostEl);

    render(
      <SwitchingPortal id="a" target={hostEl}>
        <span data-testid="c" />
      </SwitchingPortal>
    );

    expect(
      hostEl.querySelector('[data-pip-shuttle="a"] [data-testid="c"]')
    ).toBeTruthy();

    hostEl.remove();
  });

  it('portal container reference never changes', () => {
    const hostA = document.createElement('div');
    const hostB = document.createElement('div');
    document.body.appendChild(hostA);
    document.body.appendChild(hostB);

    const createPortalSpy = vi.spyOn(ReactDOM, 'createPortal');
    const { rerender } = render(
      <SwitchingPortal id="a" target={hostA}>
        <span>child</span>
      </SwitchingPortal>
    );

    rerender(
      <SwitchingPortal id="a" target={hostB}>
        <span>child</span>
      </SwitchingPortal>
    );
    rerender(
      <SwitchingPortal id="a" target={null}>
        <span>child</span>
      </SwitchingPortal>
    );
    rerender(
      <SwitchingPortal id="a" target={hostA}>
        <span>child</span>
      </SwitchingPortal>
    );

    expect(createPortalSpy).toHaveBeenCalled();
    const firstContainer = createPortalSpy.mock.calls[0][1];
    for (const call of createPortalSpy.mock.calls) {
      expect(call[1]).toBe(firstContainer);
    }

    hostA.remove();
    hostB.remove();
  });

  it('does not remount children across target changes', () => {
    let mountCount = 0;
    function Child() {
      useEffect(() => {
        mountCount++;
      }, []);
      return <span>child</span>;
    }

    const hostA = document.createElement('div');
    const hostB = document.createElement('div');
    document.body.appendChild(hostA);
    document.body.appendChild(hostB);

    const { rerender } = render(
      <SwitchingPortal id="a" target={hostA}>
        <Child />
      </SwitchingPortal>
    );

    rerender(
      <SwitchingPortal id="a" target={hostB}>
        <Child />
      </SwitchingPortal>
    );
    rerender(
      <SwitchingPortal id="a" target={null}>
        <Child />
      </SwitchingPortal>
    );
    rerender(
      <SwitchingPortal id="a" target={hostA}>
        <Child />
      </SwitchingPortal>
    );

    expect(mountCount).toBe(1);

    hostA.remove();
    hostB.remove();
  });

  it('parks in the garage when target is null', () => {
    render(
      <SwitchingPortal id="a" target={null}>
        <span>child</span>
      </SwitchingPortal>
    );

    const shuttle = document.querySelector('[data-pip-shuttle="a"]') as HTMLElement;
    expect(shuttle).toBeTruthy();
    expect(shuttle.parentElement?.hasAttribute('data-pip-garage')).toBe(true);
    expect(shuttle.isConnected).toBe(true);
  });

  it('moves out of the garage when a target appears', () => {
    const hostEl = document.createElement('div');
    document.body.appendChild(hostEl);

    const { rerender } = render(
      <SwitchingPortal id="a" target={null}>
        <span>child</span>
      </SwitchingPortal>
    );

    const shuttle = document.querySelector('[data-pip-shuttle="a"]') as HTMLElement;
    expect(shuttle.parentElement?.hasAttribute('data-pip-garage')).toBe(true);

    rerender(
      <SwitchingPortal id="a" target={hostEl}>
        <span>child</span>
      </SwitchingPortal>
    );

    expect(shuttle.parentElement).toBe(hostEl);

    hostEl.remove();
  });

  it('allocates exactly one shuttle under Strict Mode', () => {
    render(
      <React.StrictMode>
        <SwitchingPortal id="a" target={null}>
          <span>child</span>
        </SwitchingPortal>
      </React.StrictMode>
    );

    expect(document.querySelectorAll('[data-pip-shuttle="a"]').length).toBe(1);
  });

  it('shuttle uses display contents', () => {
    render(
      <SwitchingPortal id="a" target={null}>
        <span>child</span>
      </SwitchingPortal>
    );

    const shuttle = document.querySelector('[data-pip-shuttle="a"]') as HTMLElement;
    expect(shuttle.style.display).toBe('contents');
  });

  it('renderToString produces no portal markup and does not throw', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      const html = renderToString(
        <SwitchingPortal id="a" target={null}>
          <span>child</span>
        </SwitchingPortal>
      );
      expect(html).toBe('');
    }).not.toThrow();
    errorSpy.mockRestore();
  });

  it('hydration logs no mismatch warnings', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const markup = renderToString(
      <SwitchingPortal id="a" target={null}>
        <span>child</span>
      </SwitchingPortal>
    );
    errorSpy.mockClear();

    const container = document.createElement('div');
    container.innerHTML = markup;
    document.body.appendChild(container);

    let root: ReturnType<typeof hydrateRoot> | null = null;
    act(() => {
      root = hydrateRoot(
        container,
        <SwitchingPortal id="a" target={null}>
          <span>child</span>
        </SwitchingPortal>
      );
    });

    expect(errorSpy).not.toHaveBeenCalled();

    act(() => {
      root?.unmount();
    });
    container.remove();
    errorSpy.mockRestore();
  });

  it('onShuttleReady fires once with the element', () => {
    const spy = vi.fn();
    function Wrapper() {
      const handleReady = useCallback((shuttle: HTMLDivElement | null) => {
        spy(shuttle);
      }, []);
      return (
        <SwitchingPortal id="a" target={null} onShuttleReady={handleReady}>
          <span>child</span>
        </SwitchingPortal>
      );
    }

    render(<Wrapper />);
    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0];
    expect(arg).toBeInstanceOf(HTMLDivElement);
    expect(arg.dataset.pipShuttle).toBe('a');
  });

  it('onShuttleReady fires with null on unmount', () => {
    const spy = vi.fn();
    function Wrapper() {
      const handleReady = useCallback((shuttle: HTMLDivElement | null) => {
        spy(shuttle);
      }, []);
      return (
        <SwitchingPortal id="a" target={null} onShuttleReady={handleReady}>
          <span>child</span>
        </SwitchingPortal>
      );
    }

    const { unmount } = render(<Wrapper />);
    unmount();
    expect(spy.mock.calls[spy.mock.calls.length - 1][0]).toBeNull();
  });

  it('onShuttleReady is not called on placement changes', () => {
    const spy = vi.fn();
    const hostA = document.createElement('div');
    const hostB = document.createElement('div');
    document.body.appendChild(hostA);
    document.body.appendChild(hostB);

    function Wrapper({ target }: { target: HTMLElement | null }) {
      const handleReady = useCallback((shuttle: HTMLDivElement | null) => {
        spy(shuttle);
      }, []);
      return (
        <SwitchingPortal id="a" target={target} onShuttleReady={handleReady}>
          <span>child</span>
        </SwitchingPortal>
      );
    }

    const { rerender } = render(<Wrapper target={hostA} />);
    expect(spy).toHaveBeenCalledTimes(1);

    rerender(<Wrapper target={hostB} />);
    rerender(<Wrapper target={null} />);

    expect(spy).toHaveBeenCalledTimes(1);

    hostA.remove();
    hostB.remove();
  });

  it('does not remove the shuttle on unmount', () => {
    let capturedShuttle: HTMLDivElement | null = null;
    const { unmount } = render(
      <SwitchingPortal
        id="a"
        target={null}
        onShuttleReady={(s) => {
          if (s) capturedShuttle = s;
        }}
      >
        <span>child</span>
      </SwitchingPortal>
    );

    expect(capturedShuttle).toBeTruthy();
    expect((capturedShuttle as unknown as HTMLDivElement).isConnected).toBe(true);

    unmount();

    expect((capturedShuttle as unknown as HTMLDivElement).isConnected).toBe(true);
  });
});
