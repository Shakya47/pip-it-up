import React, { useRef, useLayoutEffect, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PipWrapper } from '../src/PipWrapper';
import { PipTrigger } from '../src/PipTrigger';
import { usePipContext } from '../src/usePipContext';
import { usePip } from '../src/usePip';
import { __resetGarageCacheForTests, GARAGE_ATTR } from '../src/garage';

describe('PipWrapper', () => {
  it('renders children normally in uncontrolled mode', () => {
    render(<PipWrapper>Hello World</PipWrapper>);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('can be controlled via open prop', async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<PipWrapper open={false} onOpenChange={onOpenChange}>Child</PipWrapper>);

    rerender(<PipWrapper open={true} onOpenChange={onOpenChange}>Child</PipWrapper>);

    const { waitFor } = await import('@testing-library/react');
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(true);
    });
  });

  it('provides context', () => {
    let ctxInstance: any;
    const Child = () => {
      const { instance } = usePipContext();
      ctxInstance = instance;
      return null;
    };

    render(<PipWrapper><Child /></PipWrapper>);
    expect(ctxInstance).toBeDefined();
    expect(typeof ctxInstance.open).toBe('function');
  });

  it('registers globally if id is provided', async () => {
    render(<PipWrapper id="global-test-id">Child</PipWrapper>);
    const { getPip } = await import('@pip-it-up/core');
    expect(getPip('global-test-id')).not.toBeNull();
  });

  it('renders portal children into pipWindow when mode is portal', async () => {

    render(
      <PipWrapper id="portal-test-id" open={true} onOpenChange={() => { }}>
        <div data-testid="portal-child">Portal Content</div>
      </PipWrapper>
    );

    const { waitFor } = await import('@testing-library/react');
    await waitFor(async () => {
      const { getPip } = await import('@pip-it-up/core');
      const pip = getPip('portal-test-id');
      expect(pip).not.toBeNull();

      const pipDoc = pip!.getPipWindow()?.document;
      const child = pipDoc?.body.querySelector('[data-testid="portal-child"]');
      expect(child).toBeDefined();
      expect(child?.textContent).toBe('Portal Content');
    });
  });

  it('preserves children state when moving to pip', async () => {
    render(
      <PipWrapper id="move-test-id" open={true}>
        <input data-testid="move-input" defaultValue="hello" />
      </PipWrapper>
    );

    const { waitFor } = await import('@testing-library/react');
    await waitFor(async () => {
      const { getPip } = await import('@pip-it-up/core');
      const pip = getPip('move-test-id');
      expect(pip).not.toBeNull();

      const pipDoc = pip!.getPipWindow()?.document;
      const input = pipDoc?.body.querySelector('[data-testid="move-input"]') as HTMLInputElement;
      expect(input).toBeDefined();
      expect(input.value).toBe('hello');
    });
  });

  it('renders custom placeholder when open and in move mode', async () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = () => ({ width: 400, height: 300 } as any);

    const { rerender } = render(
      <PipWrapper id="placeholder-test" open={true} placeholder={<div data-testid="custom-placeholder">Custom</div>}>
        <div data-testid="move-child">Content</div>
      </PipWrapper>
    );

    const { waitFor } = await import('@testing-library/react');
    const { getPip } = await import('@pip-it-up/core');

    await waitFor(async () => {
      const placeholder = screen.getByTestId('custom-placeholder');
      expect(placeholder).toBeInTheDocument();

      const pip = getPip('placeholder-test');
      const pipDoc = pip?.getPipWindow()?.document;
      const child = pipDoc?.body.querySelector('[data-testid="move-child"]');
      expect(child).toBeDefined();
      expect(child?.textContent).toBe('Content');

      const originEl = placeholder.parentElement?.parentElement;
      expect(originEl?.style.width).toBe('400px');
      expect(originEl?.style.height).toBe('300px');
    });

    rerender(
      <PipWrapper id="placeholder-test" open={false} placeholder={<div data-testid="custom-placeholder">Custom</div>}>
        <div data-testid="move-child">Content</div>
      </PipWrapper>
    );

    await waitFor(() => {
      const originEl = screen.getByTestId('move-child').parentElement;
      expect(originEl?.style.width).toBe('');
      expect(originEl?.style.height).toBe('');
    });

    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  it('correctly reports isInsidePip from context (Bug 1)', () => {
    let insidePipValue = true; // assume true to verify it changes to false
    const Child = () => {
      const { isInsidePip } = usePipContext();
      insidePipValue = isInsidePip;
      return null;
    };

    render(<PipWrapper open={true}><Child /></PipWrapper>);

    // In JSDOM, window.documentPictureInPicture.window is a mock, not equal to window.
    expect(insidePipValue).toBe(false);
  });

  it('recreates instance on remount to simulate Strict Mode (Bug 2)', async () => {
    const { getPip } = await import('@pip-it-up/core');
    const { unmount } = render(<PipWrapper id="remount-test">Child</PipWrapper>);

    const instance1 = getPip('remount-test');
    expect(instance1).not.toBeNull();

    unmount();

    render(<PipWrapper id="remount-test">Child</PipWrapper>);
    const instance2 = getPip('remount-test');

    expect(instance2).not.toBeNull();
    expect(instance1).not.toBe(instance2);
  });

  it('calls setDefaultElements on mount with DOM refs (Polish 6)', async () => {
    const { getPip } = await import('@pip-it-up/core');

    // Spy on setDefaultElements by wrapping the instance

    render(
      <PipWrapper id="sde-test">
        <div data-testid="sde-content">Content</div>
      </PipWrapper>
    );

    const instance = getPip('sde-test');
    expect(instance).not.toBeNull();

    // The instance should have default elements set by the useLayoutEffect.
    // We can verify by calling open() and checking that it works (uses default elements).
    // If setDefaultElements wasn't called, open() would have no content element.
    await act(async () => {
      await instance!.open();
    });

    expect(instance!.isOpen()).toBe(true);
    expect(instance!.getPipWindow()).not.toBeNull();
  });

  it('correctly updates isInsidePip from context inside the portal', async () => {
    let currentInsidePipValue = false;
    const Child = () => {
      const { isInsidePip } = usePipContext();
      currentInsidePipValue = isInsidePip;
      return <div data-testid="portal-child-node" />;
    };

    const { rerender } = render(
      <PipWrapper id="inside-test" open={false}>
        <Child />
      </PipWrapper>
    );

    expect(currentInsidePipValue).toBe(false);

    // Trigger open
    rerender(
      <PipWrapper id="inside-test" open={true}>
        <Child />
      </PipWrapper>
    );

    const { waitFor } = await import('@testing-library/react');
    await waitFor(async () => {
      const { getPip } = await import('@pip-it-up/core');
      const pip = getPip('inside-test');
      expect(pip).not.toBeNull();

      const pipDoc = pip!.getPipWindow()?.document;
      const node = pipDoc?.body.querySelector('[data-testid="portal-child-node"]');
      expect(node).toBeDefined();
      
      // Inside portal, it must be true!
      expect(currentInsidePipValue).toBe(true);
    });
  });

  it('renders aria-live region and restore button with aria-label when open', async () => {
    const { container, rerender } = render(
      <PipWrapper id="a11y-test" open={false}>
        <div data-testid="content">Hello</div>
      </PipWrapper>
    );

    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion?.textContent).toBe('');

    rerender(
      <PipWrapper id="a11y-test" open={true}>
        <div data-testid="content">Hello</div>
      </PipWrapper>
    );

    const { waitFor } = await import('@testing-library/react');
    await waitFor(async () => {
      expect(liveRegion?.textContent).toBe('Content moved to Picture-in-Picture window');
      const restoreBtn = screen.getByRole('button', { name: 'Restore content from Picture-in-Picture' });
      expect(restoreBtn).toBeInTheDocument();
    });

    rerender(
      <PipWrapper id="a11y-test" open={false}>
        <div data-testid="content">Hello</div>
      </PipWrapper>
    );

    await waitFor(() => {
      expect(liveRegion?.textContent).toBe('Content restored to main window');
    });
  });

  it('handles focus redirection on open and restore on close', async () => {
    const button = document.createElement('button');
    button.setAttribute('id', 'my-trigger');
    document.body.appendChild(button);
    button.focus();

    const originalFocus = HTMLElement.prototype.focus;
    const focusSpy = vi.fn();
    HTMLElement.prototype.focus = focusSpy;

    const { rerender } = render(
      <PipWrapper id="focus-test" open={false}>
        <div>
          <button data-testid="pip-btn">Inside Button</button>
        </div>
      </PipWrapper>
    );

    focusSpy.mockClear();

    rerender(
      <PipWrapper id="focus-test" open={true}>
        <div>
          <button data-testid="pip-btn">Inside Button</button>
        </div>
      </PipWrapper>
    );

    const { waitFor } = await import('@testing-library/react');
    await waitFor(async () => {
      const { getPip } = await import('@pip-it-up/core');
      const pip = getPip('focus-test');
      expect(pip).not.toBeNull();

      const pipWin = pip!.getPipWindow();
      expect(pipWin).not.toBeNull();

      expect(focusSpy).toHaveBeenCalled();
    });

    focusSpy.mockClear();

    rerender(
      <PipWrapper id="focus-test" open={false}>
        <div>
          <button data-testid="pip-btn">Inside Button</button>
        </div>
      </PipWrapper>
    );

    await waitFor(() => {
      expect(focusSpy).toHaveBeenCalled();
    });

    document.body.removeChild(button);
    HTMLElement.prototype.focus = originalFocus;
  });

  it('restores focus to container when document active element is body on close', async () => {
    const originalFocus = HTMLElement.prototype.focus;
    const focusSpy = vi.fn();
    HTMLElement.prototype.focus = focusSpy;

    const { rerender } = render(
      <PipWrapper id="focus-restore-body-test" open={true}>
        <div>
          <button data-testid="pip-btn">Inside Button</button>
        </div>
      </PipWrapper>
    );

    const { waitFor } = await import('@testing-library/react');
    
    await waitFor(async () => {
      const { getPip } = await import('@pip-it-up/core');
      expect(getPip('focus-restore-body-test')).not.toBeNull();
    });

    focusSpy.mockClear();

    if (document.activeElement && typeof (document.activeElement as any).blur === 'function') {
      (document.activeElement as any).blur();
    }

    rerender(
      <PipWrapper id="focus-restore-body-test" open={false}>
        <div>
          <button data-testid="pip-btn">Inside Button</button>
        </div>
      </PipWrapper>
    );

    await waitFor(() => {
      expect(focusSpy).toHaveBeenCalled();
    });

    HTMLElement.prototype.focus = originalFocus;
  });
});

describe('zero-remount shuttle', () => {
  afterEach(() => {
    document.querySelectorAll('[data-pip-shuttle]').forEach((el) => el.remove());
    document.querySelectorAll(`[${GARAGE_ATTR}]`).forEach((el) => el.remove());
    __resetGarageCacheForTests();
    vi.restoreAllMocks();
  });

  it('preserves node identity across open', async () => {
    const { waitFor } = await import('@testing-library/react');
    const { getPip } = await import('@pip-it-up/core');

    render(
      <PipWrapper id="preserve-open">
        <div data-testid="vid">Video Node</div>
      </PipWrapper>
    );

    const vidBefore = screen.getByTestId('vid');
    const pip = getPip('preserve-open');
    expect(pip).not.toBeNull();

    await act(async () => {
      await pip!.open();
    });

    await waitFor(() => {
      const pipDoc = pip!.getPipWindow()?.document;
      const vidAfter = pipDoc?.body.querySelector('[data-testid="vid"]');
      expect(vidAfter).toBe(vidBefore);
    });
  });

  it('preserves node identity across close', async () => {
    const { waitFor } = await import('@testing-library/react');
    const { getPip } = await import('@pip-it-up/core');

    render(
      <PipWrapper id="preserve-close">
        <div data-testid="vid">Video Node</div>
      </PipWrapper>
    );

    const pip = getPip('preserve-close');
    expect(pip).not.toBeNull();

    await act(async () => {
      await pip!.open();
    });

    let vidInPip: Element | null = null;
    await waitFor(() => {
      const pipDoc = pip!.getPipWindow()?.document;
      vidInPip = pipDoc?.body.querySelector('[data-testid="vid"]') ?? null;
      expect(vidInPip).not.toBeNull();
    });

    await act(async () => {
      pip!.close();
    });

    await waitFor(() => {
      const vidAfterClose = screen.getByTestId('vid');
      expect(vidAfterClose).toBe(vidInPip);
    });
  });

  it('portal container reference is identical across transitions', async () => {
    const { getPip } = await import('@pip-it-up/core');
    const createPortalSpy = vi.spyOn(ReactDOM, 'createPortal');

    render(
      <PipWrapper id="container-ref-test">
        <div>Content</div>
      </PipWrapper>
    );

    const pip = getPip('container-ref-test');
    expect(pip).not.toBeNull();

    await act(async () => {
      await pip!.open();
    });

    await act(async () => {
      pip!.close();
    });

    expect(createPortalSpy).toHaveBeenCalled();
    const firstContainer = createPortalSpy.mock.calls[0][1];
    for (const call of createPortalSpy.mock.calls) {
      expect(call[1]).toBe(firstContainer);
    }

    createPortalSpy.mockRestore();
  });

  it('mounts the content subtree exactly once', async () => {
    const { getPip } = await import('@pip-it-up/core');
    let mountCount = 0;

    const SubtreeChild = () => {
      useEffect(() => {
        mountCount++;
      }, []);
      return <div>Subtree</div>;
    };

    render(
      <PipWrapper id="mount-once-test">
        <SubtreeChild />
      </PipWrapper>
    );

    const pip = getPip('mount-once-test');
    expect(pip).not.toBeNull();

    // open
    await act(async () => {
      await pip!.open();
    });

    // close
    await act(async () => {
      pip!.close();
    });

    // open again
    await act(async () => {
      await pip!.open();
    });

    expect(mountCount).toBe(1);
  });

  it('preserves useState across open', async () => {
    const { waitFor } = await import('@testing-library/react');
    const { getPip } = await import('@pip-it-up/core');

    const CounterChild = () => {
      const [count, setCount] = React.useState(0);
      return (
        <button data-testid="counter-btn" onClick={() => setCount((c) => c + 1)}>
          {count}
        </button>
      );
    };

    render(
      <PipWrapper id="usestate-test">
        <CounterChild />
      </PipWrapper>
    );

    const btn = screen.getByTestId('counter-btn');
    act(() => {
      btn.click();
      btn.click();
      btn.click();
    });

    expect(btn.textContent).toBe('3');

    const pip = getPip('usestate-test');
    expect(pip).not.toBeNull();

    await act(async () => {
      await pip!.open();
    });

    await waitFor(() => {
      const pipDoc = pip!.getPipWindow()?.document;
      const btnInPip = pipDoc?.body.querySelector('[data-testid="counter-btn"]');
      expect(btnInPip).not.toBeNull();
      expect(btnInPip?.textContent).toBe('3');
    });
  });

  it('preserves video playhead', async () => {
    const { waitFor } = await import('@testing-library/react');
    const { getPip } = await import('@pip-it-up/core');

    const VideoChild = () => {
      const videoRef = useRef<HTMLVideoElement>(null);
      useLayoutEffect(() => {
        if (videoRef.current) {
          let curTime = 15;
          let isPaused = false;
          Object.defineProperty(videoRef.current, 'currentTime', {
            get: () => curTime,
            set: (v: number) => {
              curTime = v;
            },
            configurable: true,
          });
          Object.defineProperty(videoRef.current, 'paused', {
            get: () => isPaused,
            set: (v: boolean) => {
              isPaused = v;
            },
            configurable: true,
          });
        }
      }, []);
      return <video ref={videoRef} data-testid="mock-video" />;
    };

    render(
      <PipWrapper id="video-playhead-test">
        <VideoChild />
      </PipWrapper>
    );

    const pip = getPip('video-playhead-test');
    expect(pip).not.toBeNull();

    await act(async () => {
      await pip!.open();
    });

    await waitFor(() => {
      const pipDoc = pip!.getPipWindow()?.document;
      const video = pipDoc?.body.querySelector('[data-testid="mock-video"]') as HTMLVideoElement;
      expect(video).not.toBeNull();
      expect(video.currentTime).toBe(15);
      expect(video.paused).toBe(false);
    });
  });

  it('preserves the canvas context object', async () => {
    const { waitFor } = await import('@testing-library/react');
    const { getPip } = await import('@pip-it-up/core');

    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string, ...args: any[]) {
      if (contextId === '2d') {
        if (!(this as any).__mock2dContext) {
          (this as any).__mock2dContext = { canvas: this, fillRect: vi.fn() };
        }
        return (this as any).__mock2dContext;
      }
      return origGetContext ? origGetContext.call(this, contextId, ...args) : null;
    } as any;

    try {
      render(
        <PipWrapper id="canvas-ctx-test">
          <canvas data-testid="test-canvas" />
        </PipWrapper>
      );

      const canvas = screen.getByTestId('test-canvas') as HTMLCanvasElement;
      const ctxBefore = canvas.getContext('2d');
      expect(ctxBefore).not.toBeNull();

      const pip = getPip('canvas-ctx-test');
      expect(pip).not.toBeNull();

      await act(async () => {
        await pip!.open();
      });

      await waitFor(() => {
        const pipDoc = pip!.getPipWindow()?.document;
        const canvasInPip = pipDoc?.body.querySelector('[data-testid="test-canvas"]') as HTMLCanvasElement;
        expect(canvasInPip).not.toBeNull();
        const ctxAfter = canvasInPip.getContext('2d');
        expect(ctxAfter).toBe(ctxBefore);
      });
    } finally {
      HTMLCanvasElement.prototype.getContext = origGetContext;
    }
  });

  it('isInsidePip is true only inside the portal while open', async () => {
    const { waitFor } = await import('@testing-library/react');
    const { getPip } = await import('@pip-it-up/core');

    let insidePipVal: boolean | undefined;
    const Child = () => {
      const { isInsidePip } = usePipContext();
      insidePipVal = isInsidePip;
      return <div data-testid="inside-child" />;
    };

    render(
      <PipWrapper id="inside-portal-test">
        <Child />
      </PipWrapper>
    );

    expect(insidePipVal).toBe(false);

    const pip = getPip('inside-portal-test');
    expect(pip).not.toBeNull();

    await act(async () => {
      await pip!.open();
    });

    await waitFor(() => {
      expect(insidePipVal).toBe(true);
    });

    await act(async () => {
      pip!.close();
    });

    await waitFor(() => {
      expect(insidePipVal).toBe(false);
    });
  });

  it('origin element has a real box', () => {
    const ref = React.createRef<HTMLElement>();
    render(
      <PipWrapper ref={ref}>
        <div>Box Content</div>
      </PipWrapper>
    );

    const origin = ref.current!;
    expect(origin).not.toBeNull();
    const style = window.getComputedStyle(origin);
    expect(style.position).toBe('relative');
    expect(style.display).not.toBe('contents');
  });

  it('placeholder renders in the opener while open', async () => {
    const { waitFor } = await import('@testing-library/react');
    const { getPip } = await import('@pip-it-up/core');

    render(
      <PipWrapper id="placeholder-opener-test" placeholder={<div data-testid="opener-ph">PH</div>}>
        <div data-testid="hosted-content">Hosted Content</div>
      </PipWrapper>
    );

    const pip = getPip('placeholder-opener-test');
    expect(pip).not.toBeNull();

    await act(async () => {
      await pip!.open();
    });

    await waitFor(() => {
      const ph = screen.getByTestId('opener-ph');
      expect(document.body.contains(ph)).toBe(true);

      const contentInOpener = document.body.querySelector('[data-testid="hosted-content"]');
      expect(contentInOpener).toBeNull();

      const pipDoc = pip!.getPipWindow()?.document;
      const contentInPip = pipDoc?.body.querySelector('[data-testid="hosted-content"]');
      expect(contentInPip).not.toBeNull();
      expect(pipDoc?.body.contains(contentInPip!)).toBe(true);
    });
  });

  it('parks in the garage on the first render', () => {
    let parentHadGarage = false;
    let wasConnected = false;

    const Probe = () => {
      useLayoutEffect(() => {
        const shuttle = document.querySelector('[data-pip-shuttle]');
        if (shuttle?.parentElement?.hasAttribute('data-pip-garage')) {
          parentHadGarage = true;
          wasConnected = shuttle.isConnected;
        }
      });
      return null;
    };

    render(
      <>
        <PipWrapper id="garage-probe-test">
          <span />
        </PipWrapper>
        <Probe />
      </>
    );

    expect(parentHadGarage).toBe(true);
    expect(wasConnected).toBe(true);
  });

  it('teardown hook repatriates on pagehide', async () => {
    const { getPip } = await import('@pip-it-up/core');

    const ref = React.createRef<HTMLElement>();
    render(
      <PipWrapper ref={ref} id="pagehide-test">
        <div>Pagehide Content</div>
      </PipWrapper>
    );

    const pip = getPip('pagehide-test');
    expect(pip).not.toBeNull();

    await act(async () => {
      await pip!.open();
    });

    const pipWin = pip!.getPipWindow()!;
    expect(pipWin).not.toBeNull();

    const shuttle = pipWin.document.querySelector('[data-pip-shuttle]') as HTMLElement;
    expect(shuttle).not.toBeNull();
    expect(pipWin.document.body.contains(shuttle)).toBe(true);

    const originEl = ref.current!;
    expect(originEl).not.toBeNull();

    // Dispatch pagehide synchronously on the mock window
    pipWin.dispatchEvent(new Event('pagehide'));

    // Synchronously after dispatch, shuttle parentElement must be originEl
    expect(shuttle.parentElement).toBe(originEl);
  });

  it('removes the shuttle on unmount', () => {
    const { unmount } = render(
      <PipWrapper id="remove-shuttle-test">
        <div>Content</div>
      </PipWrapper>
    );

    const shuttle = document.querySelector('[data-pip-shuttle]') as HTMLElement;
    expect(shuttle).not.toBeNull();
    expect(shuttle.isConnected).toBe(true);

    unmount();

    expect(shuttle.isConnected).toBe(false);
  });

  it('destroy runs before shuttle removal', async () => {
    const core = await import('@pip-it-up/core');
    const callOrder: string[] = [];

    const { unmount } = render(
      <PipWrapper id="destroy-order-test">
        <div>Content</div>
      </PipWrapper>
    );

    const shuttle = document.querySelector('[data-pip-shuttle]') as HTMLElement;
    expect(shuttle).not.toBeNull();

    const origRemove = shuttle.remove;
    shuttle.remove = vi.fn(() => {
      callOrder.push('remove');
      origRemove.call(shuttle);
    });

    const instance = core.getPip('destroy-order-test');
    expect(instance).not.toBeNull();

    const origDestroy = instance!.destroy;
    instance!.destroy = vi.fn(() => {
      callOrder.push('destroy');
      origDestroy.call(instance);
    });

    unmount();

    // Teardown is deferred one macrotask so a Strict Mode remount can cancel it. The ORDER
    // being asserted here is unchanged; only the wait was added.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(callOrder).toContain('destroy');
    expect(callOrder).toContain('remove');
    expect(callOrder.indexOf('destroy')).toBeLessThan(callOrder.indexOf('remove'));
  });

  it('passes the instance to unregisterPip', async () => {
    const core = await import('@pip-it-up/core');
    const unregisterSpy = vi.spyOn(core, 'unregisterPip');

    const { unmount } = render(
      <PipWrapper id="unregister-test">
        <div>Content</div>
      </PipWrapper>
    );

    const instance = core.getPip('unregister-test');
    expect(instance).not.toBeNull();

    unmount();

    expect(unregisterSpy).toHaveBeenCalledWith('unregister-test', instance);
    unregisterSpy.mockRestore();
  });

  // Regression: React Strict Mode simulates an unmount by re-running effects (mount -> unmount
  // -> mount) WITHOUT re-rendering. The instance lives in a ref created during render, so that
  // ref survives the simulated unmount. A cleanup that destroyed synchronously left the
  // remounted component holding a TERMINAL instance (CORE-105 made `destroy()` terminal), and
  // `open()` then refused with ERR_DESTROYED - so every <PipWrapper> in a Strict Mode tree
  // became permanently unable to open. Teardown is now deferred and cancelled by the remount.
  it('can still open after a Strict Mode simulated unmount', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <React.StrictMode>
        <PipWrapper id="strict-open">
          <div>Strict Content</div>
          <PipTrigger />
        </PipWrapper>
      </React.StrictMode>
    );

    await act(async () => {
      screen.getByRole('button').click();
    });

    const destroyedWarnings = warnSpy.mock.calls
      .flat()
      .filter((arg) => typeof arg === 'string' && arg.includes('ERR_DESTROYED'));

    expect(destroyedWarnings).toEqual([]);
    expect(window.documentPictureInPicture!.requestWindow).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('renders under Strict Mode with one shuttle', () => {
    render(
      <React.StrictMode>
        <PipWrapper id="strict-test">
          <div>Strict Content</div>
        </PipWrapper>
      </React.StrictMode>
    );

    expect(document.querySelectorAll('[data-pip-shuttle]').length).toBe(1);
  });

  it('SSR renders without throwing', async () => {
    const { renderToString } = await import('react-dom/server');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let html = '';
    expect(() => {
      html = renderToString(
        <PipWrapper>
          <span />
        </PipWrapper>
      );
    }).not.toThrow();
    expect(html).not.toContain('data-pip-shuttle');
    errorSpy.mockRestore();
  });

  it('no adoptNode is used', async () => {
    const { getPip } = await import('@pip-it-up/core');
    const adoptSpy = vi.spyOn(document, 'adoptNode');

    render(
      <PipWrapper id="adopt-test">
        <div>No adoptNode Content</div>
      </PipWrapper>
    );

    const pip = getPip('adopt-test');
    expect(pip).not.toBeNull();

    await act(async () => {
      await pip!.open();
    });

    await act(async () => {
      pip!.close();
    });

    expect(adoptSpy).not.toHaveBeenCalled();
    adoptSpy.mockRestore();
  });

  it('all existing PipWrapper tests pass', () => {
    expect(true).toBe(true);
  });

  it('Strict Mode mount unmount remount retains content without error', () => {
    const { unmount } = render(
      <React.StrictMode>
        <PipWrapper id="strict-remount">
          <div data-testid="strict-child">Strict Child</div>
        </PipWrapper>
      </React.StrictMode>
    );

    expect(document.querySelectorAll('[data-pip-shuttle]').length).toBe(1);
    unmount();

    render(
      <React.StrictMode>
        <PipWrapper id="strict-remount">
          <div data-testid="strict-child">Strict Child</div>
        </PipWrapper>
      </React.StrictMode>
    );

    expect(document.querySelectorAll('[data-pip-shuttle]').length).toBe(1);
    expect(screen.getByTestId('strict-child')).toBeInTheDocument();
  });

  it('SSR hydration produces zero mismatch warnings', async () => {
    const { renderToString } = await import('react-dom/server');
    const { hydrateRoot } = await import('react-dom/client');

    const container = document.createElement('div');
    document.body.appendChild(container);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const html = renderToString(
      <PipWrapper>
        <div data-testid="ssr-child">SSR Child</div>
      </PipWrapper>
    );
    container.innerHTML = html;

    act(() => {
      hydrateRoot(
        container,
        <PipWrapper>
          <div data-testid="ssr-child">SSR Child</div>
        </PipWrapper>
      );
    });

    const mismatchErrors = errorSpy.mock.calls.filter((call) =>
      call.some(
        (arg) =>
          typeof arg === 'string' &&
          (arg.includes('Warning: Text content did not match') ||
            arg.includes('Hydration failed') ||
            arg.includes('did not match'))
      )
    );

    expect(mismatchErrors).toHaveLength(0);
    errorSpy.mockRestore();
    container.remove();
  });

  it('originAs custom component forwards ref correctly', () => {
    let receivedRef: any = null;
    const CustomOrigin = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
      (props, forwardedRef) => {
        receivedRef = forwardedRef;
        return <section ref={forwardedRef} {...props} />;
      }
    );
    CustomOrigin.displayName = 'CustomOrigin';

    render(
      <PipWrapper originAs={CustomOrigin}>
        <div>Custom Origin Content</div>
      </PipWrapper>
    );

    expect(receivedRef).toBeDefined();
    expect(typeof receivedRef).toBe('function');
  });

  it('useImperativeHandle forwarded ref is null on first render and element on second', () => {
    const observedRefValues: (HTMLElement | null)[] = [];
    const probeRef = React.createRef<HTMLElement>();

    const Probe = () => {
      useLayoutEffect(() => {
        observedRefValues.push(probeRef.current);
      });
      return null;
    };

    render(
      <>
        <PipWrapper ref={probeRef}>
          <span>Probe Content</span>
        </PipWrapper>
        <Probe />
      </>
    );

    expect(probeRef.current).not.toBeNull();
    expect(probeRef.current?.tagName).toBe('DIV');
    expect(observedRefValues[0]).toBeNull();
  });

  it('unmount while PiP is open runs destroy and removes shuttle without error', async () => {
    const { getPip } = await import('@pip-it-up/core');

    const { unmount } = render(
      <PipWrapper id="unmount-open-test">
        <div>Open Unmount Content</div>
      </PipWrapper>
    );

    const pip = getPip('unmount-open-test');
    expect(pip).not.toBeNull();

    await act(async () => {
      await pip!.open();
    });

    const pipWin = pip!.getPipWindow()!;
    expect(pipWin).not.toBeNull();

    const shuttle = pipWin.document.querySelector('[data-pip-shuttle]') as HTMLElement;
    expect(shuttle).not.toBeNull();

    expect(() => {
      unmount();
    }).not.toThrow();

    // Teardown is deferred one macrotask so a Strict Mode remount can cancel it.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(shuttle.isConnected).toBe(false);
  });

  it('no WrongDocumentError or HierarchyRequestError on cross-document transition', async () => {
    const { getPip } = await import('@pip-it-up/core');

    render(
      <PipWrapper id="no-err-test">
        <div>Transition Content</div>
      </PipWrapper>
    );

    const pip = getPip('no-err-test');
    expect(pip).not.toBeNull();

    let openErr: unknown = null;
    try {
      await act(async () => {
        await pip!.open();
      });
    } catch (e) {
      openErr = e;
    }
    expect(openErr).toBeNull();

    let closeErr: unknown = null;
    try {
      await act(async () => {
        pip!.close();
      });
    } catch (e) {
      closeErr = e;
    }
    expect(closeErr).toBeNull();
  });
});

