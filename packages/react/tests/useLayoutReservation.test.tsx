import React, { useRef, type CSSProperties } from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  useLayoutReservation,
  buildReservationStyle,
} from '../src/useLayoutReservation';
import {
  PipTeleportContext,
  type PipTeleportApi,
} from '../src/PipTeleportContext';
import { HANDOFF_MS } from '../src/constants';
import { getActiveResizeObserverController } from './helpers/mockResizeObserver';

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

describe('useLayoutReservation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('buildReservationStyle size and block', () => {
    const result = buildReservationStyle(
      { inlineSize: 300, blockSize: 200 },
      'size',
      'block'
    );
    expect(result).toEqual({ minBlockSize: '200px' });
  });

  it('buildReservationStyle size and inline', () => {
    const result = buildReservationStyle(
      { inlineSize: 300, blockSize: 200 },
      'size',
      'inline'
    );
    expect(result).toEqual({ minInlineSize: '300px' });
  });

  it('buildReservationStyle size and both', () => {
    const result = buildReservationStyle(
      { inlineSize: 300, blockSize: 200 },
      'size',
      'both'
    );
    expect(result).toEqual({
      minBlockSize: '200px',
      minInlineSize: '300px',
    });
  });

  it('buildReservationStyle ratio', () => {
    const result = buildReservationStyle(
      { inlineSize: 300, blockSize: 200 },
      'ratio',
      'block'
    );
    expect(result).toEqual({ aspectRatio: '300 / 200' });
  });

  it('buildReservationStyle none returns the shared empty object', () => {
    const a = buildReservationStyle(
      { inlineSize: 300, blockSize: 200 },
      'none',
      'block'
    );
    const b = buildReservationStyle(
      { inlineSize: 100, blockSize: 100 },
      'none',
      'inline'
    );
    expect(a).toBe(b);
    expect(a).toEqual({});
  });

  it('pre-reserves from the provider cache on first render', () => {
    const api = createMockTeleportApi({
      getLastDockedSize: vi
        .fn()
        .mockReturnValue({ inlineSize: 300, blockSize: 200 }),
    });

    let firstRenderStyle: CSSProperties | undefined;
    function TestComponent() {
      const boxRef = useRef<HTMLDivElement | null>(null);
      const { reservationStyle } = useLayoutReservation({
        id: 'test-id',
        boxRef,
        isReserved: true,
        mode: 'size',
        axis: 'block',
        handoffMs: HANDOFF_MS,
      });
      if (firstRenderStyle === undefined) {
        firstRenderStyle = reservationStyle;
      }
      return <div ref={boxRef} style={reservationStyle} />;
    }

    render(
      <PipTeleportContext.Provider value={api}>
        <TestComponent />
      </PipTeleportContext.Provider>
    );

    expect(firstRenderStyle).toEqual({ minBlockSize: '200px' });
  });

  it('empty cache yields a stable empty style', () => {
    const api = createMockTeleportApi({
      getLastDockedSize: vi.fn().mockReturnValue(null),
    });

    const styles: CSSProperties[] = [];
    function TestComponent({ isReserved }: { isReserved: boolean }) {
      const boxRef = useRef<HTMLDivElement | null>(null);
      const { reservationStyle } = useLayoutReservation({
        id: 'test-id',
        boxRef,
        isReserved,
        mode: 'size',
        axis: 'block',
        handoffMs: HANDOFF_MS,
      });
      styles.push(reservationStyle);
      return <div ref={boxRef} style={reservationStyle} />;
    }

    const { rerender } = render(
      <PipTeleportContext.Provider value={api}>
        <TestComponent isReserved={true} />
      </PipTeleportContext.Provider>
    );

    rerender(
      <PipTeleportContext.Provider value={api}>
        <TestComponent isReserved={true} />
      </PipTeleportContext.Provider>
    );

    expect(styles.length).toBe(2);
    expect(styles[0]).toBe(styles[1]);
    expect(styles[0]).toEqual({});
  });

  it('observes with box border-box while docked', () => {
    const api = createMockTeleportApi();
    const observeSpy = vi.spyOn(ResizeObserver.prototype, 'observe');

    let element: HTMLDivElement | null = null;
    function TestComponent() {
      const boxRef = useRef<HTMLDivElement | null>(null);
      useLayoutReservation({
        id: 'test-id',
        boxRef,
        isReserved: false,
        mode: 'size',
        axis: 'block',
        handoffMs: HANDOFF_MS,
      });
      return (
        <div
          ref={(node) => {
            boxRef.current = node;
            element = node;
          }}
        />
      );
    }

    render(
      <PipTeleportContext.Provider value={api}>
        <TestComponent />
      </PipTeleportContext.Provider>
    );

    expect(observeSpy).toHaveBeenCalledWith(element, { box: 'border-box' });
  });

  it('does not observe while reserved', () => {
    const api = createMockTeleportApi();
    const observeSpy = vi.spyOn(ResizeObserver.prototype, 'observe');

    function TestComponent() {
      const boxRef = useRef<HTMLDivElement | null>(null);
      useLayoutReservation({
        id: 'test-id',
        boxRef,
        isReserved: true,
        mode: 'size',
        axis: 'block',
        handoffMs: HANDOFF_MS,
      });
      return <div ref={boxRef} />;
    }

    render(
      <PipTeleportContext.Provider value={api}>
        <TestComponent />
      </PipTeleportContext.Provider>
    );

    expect(observeSpy).not.toHaveBeenCalled();
  });

  it('disconnects when transitioning to reserved', () => {
    const api = createMockTeleportApi();
    const disconnectSpy = vi.spyOn(ResizeObserver.prototype, 'disconnect');

    function TestComponent({ isReserved }: { isReserved: boolean }) {
      const boxRef = useRef<HTMLDivElement | null>(null);
      useLayoutReservation({
        id: 'test-id',
        boxRef,
        isReserved,
        mode: 'size',
        axis: 'block',
        handoffMs: HANDOFF_MS,
      });
      return <div ref={boxRef} />;
    }

    const { rerender } = render(
      <PipTeleportContext.Provider value={api}>
        <TestComponent isReserved={false} />
      </PipTeleportContext.Provider>
    );

    expect(disconnectSpy).not.toHaveBeenCalled();

    rerender(
      <PipTeleportContext.Provider value={api}>
        <TestComponent isReserved={true} />
      </PipTeleportContext.Provider>
    );

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });

  it('zero callbacks fire between reserve and restore', () => {
    const api = createMockTeleportApi();
    const controller = getActiveResizeObserverController()!;

    let element: HTMLDivElement | null = null;
    function TestComponent({ isReserved }: { isReserved: boolean }) {
      const boxRef = useRef<HTMLDivElement | null>(null);
      useLayoutReservation({
        id: 'test-id',
        boxRef,
        isReserved,
        mode: 'size',
        axis: 'block',
        handoffMs: HANDOFF_MS,
      });
      return (
        <div
          ref={(node) => {
            boxRef.current = node;
            element = node;
          }}
        />
      );
    }

    const { rerender } = render(
      <PipTeleportContext.Provider value={api}>
        <TestComponent isReserved={true} />
      </PipTeleportContext.Provider>
    );

    expect(controller.observerCount(element!)).toBe(0);
    controller.emit(element!, { inlineSize: 400, blockSize: 400 });

    expect(api.reportDockedSize).not.toHaveBeenCalled();

    rerender(
      <PipTeleportContext.Provider value={api}>
        <TestComponent isReserved={false} />
      </PipTeleportContext.Provider>
    );

    expect(api.reportDockedSize).not.toHaveBeenCalled();
  });

  it('ignores a zero measurement', () => {
    const api = createMockTeleportApi();
    const controller = getActiveResizeObserverController()!;

    let element: HTMLDivElement | null = null;
    function TestComponent() {
      const boxRef = useRef<HTMLDivElement | null>(null);
      useLayoutReservation({
        id: 'test-id',
        boxRef,
        isReserved: false,
        mode: 'size',
        axis: 'block',
        handoffMs: HANDOFF_MS,
      });
      return (
        <div
          ref={(node) => {
            boxRef.current = node;
            element = node;
          }}
        />
      );
    }

    render(
      <PipTeleportContext.Provider value={api}>
        <TestComponent />
      </PipTeleportContext.Provider>
    );

    controller.emit(element!, { inlineSize: 0, blockSize: 0 });
    expect(api.reportDockedSize).not.toHaveBeenCalled();
  });

  it('reports measurements to the provider', () => {
    const api = createMockTeleportApi();
    const controller = getActiveResizeObserverController()!;

    let element: HTMLDivElement | null = null;
    function TestComponent() {
      const boxRef = useRef<HTMLDivElement | null>(null);
      useLayoutReservation({
        id: 'test-id',
        boxRef,
        isReserved: false,
        mode: 'size',
        axis: 'block',
        handoffMs: HANDOFF_MS,
      });
      return (
        <div
          ref={(node) => {
            boxRef.current = node;
            element = node;
          }}
        />
      );
    }

    render(
      <PipTeleportContext.Provider value={api}>
        <TestComponent />
      </PipTeleportContext.Provider>
    );

    controller.emit(element!, { inlineSize: 300, blockSize: 200 });
    expect(api.reportDockedSize).toHaveBeenCalledWith('test-id', {
      inlineSize: 300,
      blockSize: 200,
    });
  });

  it('disconnects on unmount', () => {
    const api = createMockTeleportApi();
    const disconnectSpy = vi.spyOn(ResizeObserver.prototype, 'disconnect');

    function TestComponent() {
      const boxRef = useRef<HTMLDivElement | null>(null);
      useLayoutReservation({
        id: 'test-id',
        boxRef,
        isReserved: false,
        mode: 'size',
        axis: 'block',
        handoffMs: HANDOFF_MS,
      });
      return <div ref={boxRef} />;
    }

    const { unmount } = render(
      <PipTeleportContext.Provider value={api}>
        <TestComponent />
      </PipTeleportContext.Provider>
    );

    expect(disconnectSpy).not.toHaveBeenCalled();

    unmount();

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });

  it('mode none constructs no observer', () => {
    const api = createMockTeleportApi();
    const controller = getActiveResizeObserverController()!;

    function TestComponent() {
      const boxRef = useRef<HTMLDivElement | null>(null);
      useLayoutReservation({
        id: 'test-id',
        boxRef,
        isReserved: false,
        mode: 'none',
        axis: 'block',
        handoffMs: HANDOFF_MS,
      });
      return <div ref={boxRef} />;
    }

    render(
      <PipTeleportContext.Provider value={api}>
        <TestComponent />
      </PipTeleportContext.Provider>
    );

    expect(controller.liveObservers()).toBe(0);
    expect(controller.observeCalls.length).toBe(0);
  });

  it('animates the restore handoff', () => {
    const api = createMockTeleportApi();
    let animateSpy: ReturnType<typeof vi.fn> | undefined;

    let callCount = 0;
    function TestComponent({ isReserved }: { isReserved: boolean }) {
      const boxRef = useRef<HTMLDivElement | null>(null);
      useLayoutReservation({
        id: 'test-id',
        boxRef,
        isReserved,
        mode: 'size',
        axis: 'block',
        handoffMs: HANDOFF_MS,
      });
      return (
        <div
          ref={(node) => {
            if (node) {
              boxRef.current = node;
              if (!animateSpy) {
                animateSpy = vi.fn().mockReturnValue({
                  finished: Promise.resolve(),
                  cancel: vi.fn(),
                });
                (node as HTMLElement).animate =
                  animateSpy as unknown as typeof node.animate;
                vi.spyOn(node, 'getBoundingClientRect').mockImplementation(
                  () => {
                    callCount++;
                    const height = callCount === 1 ? 200 : 400;
                    return {
                      height,
                      width: 300,
                      top: 0,
                      left: 0,
                      bottom: height,
                      right: 300,
                      x: 0,
                      y: 0,
                      toJSON: () => ({}),
                    } as DOMRect;
                  }
                );
              }
            }
          }}
        />
      );
    }

    const { rerender } = render(
      <PipTeleportContext.Provider value={api}>
        <TestComponent isReserved={true} />
      </PipTeleportContext.Provider>
    );

    rerender(
      <PipTeleportContext.Provider value={api}>
        <TestComponent isReserved={false} />
      </PipTeleportContext.Provider>
    );

    expect(animateSpy).toHaveBeenCalledWith(
      [{ blockSize: '200px' }, { blockSize: '400px' }],
      { duration: 200, easing: 'ease-out', fill: 'none' }
    );
  });

  it('skips the animation below the epsilon', () => {
    const api = createMockTeleportApi();
    const animateSpy = vi.fn().mockReturnValue({
      finished: Promise.resolve(),
      cancel: vi.fn(),
    });

    let callCount = 0;
    function TestComponent({ isReserved }: { isReserved: boolean }) {
      const boxRef = useRef<HTMLDivElement | null>(null);
      useLayoutReservation({
        id: 'test-id',
        boxRef,
        isReserved,
        mode: 'size',
        axis: 'block',
        handoffMs: HANDOFF_MS,
      });
      return (
        <div
          ref={(node) => {
            if (node) {
              boxRef.current = node;
              (node as HTMLElement).animate =
                animateSpy as unknown as typeof node.animate;
              vi.spyOn(node, 'getBoundingClientRect').mockImplementation(() => {
                callCount++;
                const height = callCount === 1 ? 200 : 200.5;
                return {
                  height,
                  width: 300,
                  top: 0,
                  left: 0,
                  bottom: height,
                  right: 300,
                  x: 0,
                  y: 0,
                  toJSON: () => ({}),
                } as DOMRect;
              });
            }
          }}
        />
      );
    }

    const { rerender } = render(
      <PipTeleportContext.Provider value={api}>
        <TestComponent isReserved={true} />
      </PipTeleportContext.Provider>
    );

    rerender(
      <PipTeleportContext.Provider value={api}>
        <TestComponent isReserved={false} />
      </PipTeleportContext.Provider>
    );

    expect(animateSpy).not.toHaveBeenCalled();
  });

  it('skips the animation under reduced motion', () => {
    const api = createMockTeleportApi();
    const animateSpy = vi.fn().mockReturnValue({
      finished: Promise.resolve(),
      cancel: vi.fn(),
    });

    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );

    let callCount = 0;
    function TestComponent({ isReserved }: { isReserved: boolean }) {
      const boxRef = useRef<HTMLDivElement | null>(null);
      useLayoutReservation({
        id: 'test-id',
        boxRef,
        isReserved,
        mode: 'size',
        axis: 'block',
        handoffMs: HANDOFF_MS,
      });
      return (
        <div
          ref={(node) => {
            if (node) {
              boxRef.current = node;
              (node as HTMLElement).animate =
                animateSpy as unknown as typeof node.animate;
              vi.spyOn(node, 'getBoundingClientRect').mockImplementation(() => {
                callCount++;
                const height = callCount === 1 ? 200 : 400;
                return {
                  height,
                  width: 300,
                  top: 0,
                  left: 0,
                  bottom: height,
                  right: 300,
                  x: 0,
                  y: 0,
                  toJSON: () => ({}),
                } as DOMRect;
              });
            }
          }}
        />
      );
    }

    const { rerender } = render(
      <PipTeleportContext.Provider value={api}>
        <TestComponent isReserved={true} />
      </PipTeleportContext.Provider>
    );

    rerender(
      <PipTeleportContext.Provider value={api}>
        <TestComponent isReserved={false} />
      </PipTeleportContext.Provider>
    );

    expect(animateSpy).not.toHaveBeenCalled();
  });

  it('degrades when animate is missing', () => {
    const api = createMockTeleportApi();

    const elementRef: { current: HTMLDivElement | null } = { current: null };
    function TestComponent({ isReserved }: { isReserved: boolean }) {
      const boxRef = useRef<HTMLDivElement | null>(null);
      useLayoutReservation({
        id: 'test-id',
        boxRef,
        isReserved,
        mode: 'size',
        axis: 'block',
        handoffMs: HANDOFF_MS,
      });
      return (
        <div
          ref={(node) => {
            if (node) {
              boxRef.current = node;
              elementRef.current = node;
              (node as unknown as { animate?: unknown }).animate = undefined;
            }
          }}
        />
      );
    }

    const { rerender } = render(
      <PipTeleportContext.Provider value={api}>
        <TestComponent isReserved={true} />
      </PipTeleportContext.Provider>
    );

    expect(() => {
      rerender(
        <PipTeleportContext.Provider value={api}>
          <TestComponent isReserved={false} />
        </PipTeleportContext.Provider>
      );
    }).not.toThrow();

    expect(elementRef.current?.style.minBlockSize).toBe('');
  });

  it('cancels the animation on unmount', () => {
    const api = createMockTeleportApi();
    const cancelSpy = vi.fn();
    const rejectedFinished = Promise.reject(new Error('cancelled'));
    const animateSpy = vi.fn().mockReturnValue({
      finished: rejectedFinished,
      cancel: cancelSpy,
    });

    let callCount = 0;
    function TestComponent({ isReserved }: { isReserved: boolean }) {
      const boxRef = useRef<HTMLDivElement | null>(null);
      useLayoutReservation({
        id: 'test-id',
        boxRef,
        isReserved,
        mode: 'size',
        axis: 'block',
        handoffMs: HANDOFF_MS,
      });
      return (
        <div
          ref={(node) => {
            if (node) {
              boxRef.current = node;
              (node as HTMLElement).animate =
                animateSpy as unknown as typeof node.animate;
              vi.spyOn(node, 'getBoundingClientRect').mockImplementation(() => {
                callCount++;
                const height = callCount === 1 ? 200 : 400;
                return {
                  height,
                  width: 300,
                  top: 0,
                  left: 0,
                  bottom: height,
                  right: 300,
                  x: 0,
                  y: 0,
                  toJSON: () => ({}),
                } as DOMRect;
              });
            }
          }}
        />
      );
    }

    const { rerender, unmount } = render(
      <PipTeleportContext.Provider value={api}>
        <TestComponent isReserved={true} />
      </PipTeleportContext.Provider>
    );

    rerender(
      <PipTeleportContext.Provider value={api}>
        <TestComponent isReserved={false} />
      </PipTeleportContext.Provider>
    );

    expect(cancelSpy).not.toHaveBeenCalled();

    unmount();

    expect(cancelSpy).toHaveBeenCalledTimes(1);
  });

  it('clears reservation styles before measuring the natural size', () => {
    const api = createMockTeleportApi();
    const elementRef: { current: HTMLDivElement | null } = { current: null };

    function TestComponent({ isReserved }: { isReserved: boolean }) {
      const boxRef = useRef<HTMLDivElement | null>(null);
      const { reservationStyle } = useLayoutReservation({
        id: 'test-id',
        boxRef,
        isReserved,
        mode: 'size',
        axis: 'block',
        handoffMs: HANDOFF_MS,
      });
      return (
        <div
          ref={(node) => {
            if (node) {
              boxRef.current = node;
              elementRef.current = node;
              vi.spyOn(node, 'getBoundingClientRect').mockImplementation(() => {
                return {
                  height: 200,
                  width: 300,
                  top: 0,
                  left: 0,
                  bottom: 200,
                  right: 300,
                  x: 0,
                  y: 0,
                  toJSON: () => ({}),
                } as DOMRect;
              });
            }
          }}
          style={reservationStyle}
        />
      );
    }

    const { rerender } = render(
      <PipTeleportContext.Provider value={api}>
        <TestComponent isReserved={true} />
      </PipTeleportContext.Provider>
    );

    rerender(
      <PipTeleportContext.Provider value={api}>
        <TestComponent isReserved={false} />
      </PipTeleportContext.Provider>
    );

    expect(elementRef.current?.style.minBlockSize).toBe('');
  });

  it('two rapid reserve-restore cycles tracks only latest animation', () => {
    const api = createMockTeleportApi();
    const cancel1 = vi.fn();
    const cancel2 = vi.fn();
    const anim1 = { finished: Promise.resolve(), cancel: cancel1 };
    const anim2 = { finished: Promise.resolve(), cancel: cancel2 };

    let animCall = 0;
    const animateSpy = vi.fn().mockImplementation(() => {
      animCall++;
      return animCall === 1 ? anim1 : anim2;
    });

    let getRectCall = 0;
    function TestComponent({ isReserved }: { isReserved: boolean }) {
      const boxRef = useRef<HTMLDivElement | null>(null);
      useLayoutReservation({
        id: 'test-id',
        boxRef,
        isReserved,
        mode: 'size',
        axis: 'block',
        handoffMs: HANDOFF_MS,
      });
      return (
        <div
          ref={(node) => {
            if (node) {
              boxRef.current = node;
              (node as HTMLElement).animate =
                animateSpy as unknown as typeof node.animate;
              vi.spyOn(node, 'getBoundingClientRect').mockImplementation(() => {
                getRectCall++;
                const height = getRectCall % 2 === 1 ? 200 : 400;
                return {
                  height,
                  width: 300,
                  top: 0,
                  left: 0,
                  bottom: height,
                  right: 300,
                  x: 0,
                  y: 0,
                  toJSON: () => ({}),
                } as DOMRect;
              });
            }
          }}
        />
      );
    }

    const { rerender, unmount } = render(
      <PipTeleportContext.Provider value={api}>
        <TestComponent isReserved={true} />
      </PipTeleportContext.Provider>
    );

    // First restore
    rerender(
      <PipTeleportContext.Provider value={api}>
        <TestComponent isReserved={false} />
      </PipTeleportContext.Provider>
    );

    // Reserve again
    rerender(
      <PipTeleportContext.Provider value={api}>
        <TestComponent isReserved={true} />
      </PipTeleportContext.Provider>
    );

    // Second restore
    rerender(
      <PipTeleportContext.Provider value={api}>
        <TestComponent isReserved={false} />
      </PipTeleportContext.Provider>
    );

    expect(animateSpy).toHaveBeenCalledTimes(2);

    // On unmount, only the latest animation cancel is called
    unmount();
    expect(cancel2).toHaveBeenCalledTimes(1);
  });

  it('null boxRef is a no-op in all effects', () => {
    const api = createMockTeleportApi();
    const observeSpy = vi.spyOn(ResizeObserver.prototype, 'observe');

    function TestComponent({ isReserved }: { isReserved: boolean }) {
      const boxRef = useRef<HTMLDivElement | null>(null);
      useLayoutReservation({
        id: 'test-id',
        boxRef,
        isReserved,
        mode: 'size',
        axis: 'block',
        handoffMs: HANDOFF_MS,
      });
      return null;
    }

    const { rerender, unmount } = render(
      <PipTeleportContext.Provider value={api}>
        <TestComponent isReserved={false} />
      </PipTeleportContext.Provider>
    );

    expect(observeSpy).not.toHaveBeenCalled();

    expect(() => {
      rerender(
        <PipTeleportContext.Provider value={api}>
          <TestComponent isReserved={true} />
        </PipTeleportContext.Provider>
      );
      rerender(
        <PipTeleportContext.Provider value={api}>
          <TestComponent isReserved={false} />
        </PipTeleportContext.Provider>
      );
      unmount();
    }).not.toThrow();
  });
});
