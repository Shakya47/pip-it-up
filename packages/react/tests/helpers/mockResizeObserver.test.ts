import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  installMockResizeObserver,
  getActiveResizeObserverController,
  type ResizeObserverController,
} from './mockResizeObserver';
import { installMockAnimation } from './mockAnimation';
import { installMockMoveBefore, removeMoveBeforeSupport } from './mockMoveBefore';

describe('mockResizeObserver, mockAnimation, mockMoveBefore', () => {
  let controller: ResizeObserverController;

  beforeEach(() => {
    controller = getActiveResizeObserverController()!;
  });

  // Section 6 Matrix Tests
  it('observe does not emit', () => {
    const cb = vi.fn();
    const ro = new ResizeObserver(cb);
    const el = document.createElement('div');
    ro.observe(el);
    expect(cb).not.toHaveBeenCalled();
    ro.disconnect();
  });

  it('emit delivers borderBoxSize and contentRect', () => {
    const cb = vi.fn();
    const ro = new ResizeObserver(cb);
    const el = document.createElement('div');
    ro.observe(el);
    controller.emit(el, { inlineSize: 300, blockSize: 200 });
    expect(cb).toHaveBeenCalledTimes(1);
    const entry = cb.mock.calls[0][0][0];
    expect(entry.borderBoxSize[0]).toEqual({ inlineSize: 300, blockSize: 200 });
    expect(entry.contentRect.width).toBe(300);
    ro.disconnect();
  });

  it('emit reaches every observer of the element', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const ro1 = new ResizeObserver(cb1);
    const ro2 = new ResizeObserver(cb2);
    const el = document.createElement('div');
    ro1.observe(el);
    ro2.observe(el);
    controller.emit(el, { inlineSize: 100, blockSize: 100 });
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
    ro1.disconnect();
    ro2.disconnect();
  });

  it('emit to an unobserved element is a no-op', () => {
    const cb = vi.fn();
    const ro = new ResizeObserver(cb);
    const el = document.createElement('div');
    const other = document.createElement('div');
    ro.observe(el);
    controller.emit(other, { inlineSize: 100, blockSize: 100 });
    expect(cb).not.toHaveBeenCalled();
    ro.disconnect();
  });

  it('disconnect stops delivery', () => {
    const cb = vi.fn();
    const ro = new ResizeObserver(cb);
    const el = document.createElement('div');
    ro.observe(el);
    ro.disconnect();
    controller.emit(el, { inlineSize: 100, blockSize: 100 });
    expect(cb).not.toHaveBeenCalled();
  });

  it('liveObservers returns to zero', () => {
    const ro1 = new ResizeObserver(() => {});
    const ro2 = new ResizeObserver(() => {});
    const ro3 = new ResizeObserver(() => {});
    expect(controller.liveObservers()).toBe(3);
    ro1.disconnect();
    ro2.disconnect();
    ro3.disconnect();
    expect(controller.liveObservers()).toBe(0);
  });

  it('observeCalls records options', () => {
    const ro = new ResizeObserver(() => {});
    const el = document.createElement('div');
    ro.observe(el, { box: 'border-box' });
    expect(controller.observeCalls[0].options).toEqual({ box: 'border-box' });
    ro.disconnect();
  });

  it('animate records keyframes and options', () => {
    const animController = installMockAnimation();
    const el = document.createElement('div');
    const kf = [{ opacity: 0 }, { opacity: 1 }];
    const opts = { duration: 200 };
    el.animate(kf, opts);
    expect(animController.animations[0].keyframes).toEqual(kf);
    expect(animController.animations[0].options).toEqual(opts);
    animController.restore();
  });

  it('cancel rejects finished with AbortError', async () => {
    const animController = installMockAnimation();
    const el = document.createElement('div');
    const anim = el.animate([], {});
    let caught: DOMException | Error | undefined;
    anim.finished.catch((err: unknown) => {
      caught = err as DOMException;
    });
    animController.animations[0].cancel();
    await expect(anim.finished).rejects.toMatchObject({ name: 'AbortError' });
    expect(caught?.name).toBe('AbortError');
    animController.restore();
  });

  it('finish resolves finished', async () => {
    const animController = installMockAnimation();
    const el = document.createElement('div');
    const anim = el.animate([], {});
    let resolved = false;
    anim.finished.then(() => {
      resolved = true;
    });
    animController.animations[0].finish();
    await anim.finished;
    expect(resolved).toBe(true);
    animController.restore();
  });

  it('removeAnimateSupport deletes animate', () => {
    const animController = installMockAnimation();
    const el = document.createElement('div');
    animController.removeAnimateSupport();
    expect(typeof (el as { animate?: unknown }).animate).toBe('undefined');
    animController.restore();
  });

  it('moveBefore actually moves the node', () => {
    const mbController = installMockMoveBefore();
    const parent = document.createElement('div');
    const node = document.createElement('span');
    parent.moveBefore(node, null);
    expect(node.parentElement).toBe(parent);
    mbController.restore();
  });

  it('moveBefore records the call', () => {
    const mbController = installMockMoveBefore();
    const parent = document.createElement('div');
    const node = document.createElement('span');
    parent.moveBefore(node, null);
    expect(mbController.calls[0]).toEqual({ parent, node });
    mbController.restore();
  });

  it('failNextCall throws HierarchyRequestError once', () => {
    const mbController = installMockMoveBefore();
    const parent = document.createElement('div');
    const node = document.createElement('span');
    mbController.failNextCall();
    let caught: DOMException | Error | undefined;
    try {
      parent.moveBefore(node, null);
    } catch (err: unknown) {
      caught = err as DOMException;
    }
    expect(caught).toBeDefined();
    expect(caught?.name).toBe('HierarchyRequestError');
    parent.moveBefore(node, null);
    expect(node.parentElement).toBe(parent);
    mbController.restore();
  });

  it('removeMoveBeforeSupport deletes the method', () => {
    const mbController = installMockMoveBefore();
    const restoreSupport = removeMoveBeforeSupport();
    expect('moveBefore' in Element.prototype).toBe(false);
    restoreSupport();
    mbController.restore();
  });

  it('double install throws', () => {
    expect(() => {
      installMockResizeObserver();
    }).toThrow(/already installed/);

    const anim = installMockAnimation();
    expect(() => installMockAnimation()).toThrow(/already installed/);
    anim.restore();

    const mb = installMockMoveBefore();
    expect(() => installMockMoveBefore()).toThrow(/already installed/);
    mb.restore();
  });

  it('restore is idempotent', () => {
    controller.restore();
    expect(() => {
      controller.restore();
    }).not.toThrow();
  });

  // Section 5 Invariants & Edge Cases
  it('entry borderBoxSize can be set to undefined to force fallback', () => {
    let receivedEntry: (Omit<ResizeObserverEntry, 'borderBoxSize'> & { borderBoxSize?: unknown }) | undefined;
    const ro = new ResizeObserver((entries) => {
      receivedEntry = entries[0] as Omit<ResizeObserverEntry, 'borderBoxSize'> & { borderBoxSize?: unknown };
      receivedEntry.borderBoxSize = undefined;
    });
    const el = document.createElement('div');
    ro.observe(el);
    controller.emit(el, { inlineSize: 400, blockSize: 250 });
    expect(receivedEntry).toBeDefined();
    expect(receivedEntry?.borderBoxSize).toBeUndefined();
    expect(receivedEntry?.contentRect.width).toBe(400);
    ro.disconnect();
  });
});
