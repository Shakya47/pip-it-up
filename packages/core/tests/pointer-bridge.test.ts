import { describe, it, expect, vi } from 'vitest';
import { startPointerBridge } from '../src/pointer-bridge';

function createFakePointerEvent(
  type: string,
  opts: PointerEventInit & { isTrusted?: boolean } = {}
): PointerEvent {
  return {
    type,
    pointerId: opts.pointerId ?? 1,
    width: opts.width ?? 1,
    height: opts.height ?? 1,
    pressure: opts.pressure ?? 0.5,
    pointerType: opts.pointerType ?? 'mouse',
    isPrimary: opts.isPrimary ?? true,
    screenX: opts.screenX ?? 100,
    screenY: opts.screenY ?? 200,
    clientX: opts.clientX ?? 50,
    clientY: opts.clientY ?? 60,
    ctrlKey: opts.ctrlKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    altKey: opts.altKey ?? false,
    metaKey: opts.metaKey ?? false,
    button: opts.button ?? 0,
    buttons: opts.buttons ?? 1,
    bubbles: opts.bubbles ?? true,
    cancelable: opts.cancelable ?? true,
    composed: opts.composed ?? true,
    isTrusted: opts.isTrusted ?? false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    stopImmediatePropagation: vi.fn(),
  } as unknown as PointerEvent;
}

describe('pointer-bridge', () => {
  it('dispatches synthesized PointerEvent to opener document for trusted input', () => {
    const mockDoc = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const pipWin: any = {
      document: mockDoc,
    };

    const openerDoc = document.createElement('div');
    const dispatchSpy = vi.spyOn(openerDoc, 'dispatchEvent');

    const openerWin: any = {
      document: openerDoc,
    };

    const cleanup = startPointerBridge(pipWin, openerWin);
    expect(mockDoc.addEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function), expect.any(Object));

    const calls = mockDoc.addEventListener.mock.calls;
    const pointerDownCall = calls.find((c: any) => c[0] === 'pointerdown');
    expect(pointerDownCall).toBeDefined();
    const handler = pointerDownCall[1];

    const eventToDispatch = createFakePointerEvent('pointerdown', {
      pointerId: 42,
      clientX: 123,
      clientY: 456,
      isTrusted: true,
    });

    handler(eventToDispatch);

    expect(dispatchSpy).toHaveBeenCalled();
    const dispatchedEvent = dispatchSpy.mock.calls[0][0] as PointerEvent;
    expect(dispatchedEvent.type).toBe('pointerdown');
    expect(dispatchedEvent.pointerId).toBe(42);
    expect(dispatchedEvent.clientX).toBe(123);
    expect(dispatchedEvent.clientY).toBe(456);

    cleanup();
  });

  it('does NOT forward synthetic pointer events', () => {
    const mockDoc = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const pipWin: any = {
      document: mockDoc,
    };

    const openerDoc = document.createElement('div');
    const dispatchSpy = vi.spyOn(openerDoc, 'dispatchEvent');

    const openerWin: any = {
      document: openerDoc,
    };

    const cleanup = startPointerBridge(pipWin, openerWin);

    const calls = mockDoc.addEventListener.mock.calls;
    const pointerMoveCall = calls.find((c: any) => c[0] === 'pointermove');
    const handler = pointerMoveCall[1];

    const eventToDispatch = createFakePointerEvent('pointermove', {
      isTrusted: false,
    });

    handler(eventToDispatch);

    expect(dispatchSpy).not.toHaveBeenCalled();

    cleanup();
  });

  it('dispatches synthesized MouseEvent to opener document for trusted mouse input', () => {
    const mockDoc = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const pipWin: any = {
      document: mockDoc,
    };

    const openerDoc = document.createElement('div');
    const dispatchSpy = vi.spyOn(openerDoc, 'dispatchEvent');

    const openerWin: any = {
      document: openerDoc,
    };

    const cleanup = startPointerBridge(pipWin, openerWin);
    expect(mockDoc.addEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function), expect.any(Object));

    const calls = mockDoc.addEventListener.mock.calls;
    const mouseDownCall = calls.find((c: any) => c[0] === 'mousedown');
    expect(mouseDownCall).toBeDefined();
    const handler = mouseDownCall[1];

    const eventToDispatch = {
      type: 'mousedown',
      screenX: 100,
      screenY: 200,
      clientX: 50,
      clientY: 60,
      isTrusted: true,
    } as unknown as MouseEvent;

    handler(eventToDispatch);

    expect(dispatchSpy).toHaveBeenCalled();
    const dispatchedEvent = dispatchSpy.mock.calls[0][0] as MouseEvent;
    expect(dispatchedEvent.type).toBe('mousedown');
    expect(dispatchedEvent.clientX).toBe(50);
    expect(dispatchedEvent.clientY).toBe(60);

    cleanup();
  });

  it('does NOT forward untrusted mouse events', () => {
    const mockDoc = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const pipWin: any = {
      document: mockDoc,
    };

    const openerDoc = document.createElement('div');
    const dispatchSpy = vi.spyOn(openerDoc, 'dispatchEvent');

    const openerWin: any = {
      document: openerDoc,
    };

    const cleanup = startPointerBridge(pipWin, openerWin);

    const calls = mockDoc.addEventListener.mock.calls;
    const mouseDownCall = calls.find((c: any) => c[0] === 'mousedown');
    const handler = mouseDownCall[1];

    const eventToDispatch = {
      type: 'mousedown',
      isTrusted: false,
    } as unknown as MouseEvent;

    handler(eventToDispatch);

    expect(dispatchSpy).not.toHaveBeenCalled();

    cleanup();
  });
});

