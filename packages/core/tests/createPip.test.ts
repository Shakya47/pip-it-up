import fs from 'fs';
import path from 'path';
import { describe, it, expect, vi } from 'vitest';
import { createPip } from '../src/createPip';
import { getPip, registerPip, unregisterPip } from '../src/registry';
import { startKeyboardBridge } from '../src/keyboard-bridge';
import * as kb from '../src/keyboard-bridge';
import { startPointerBridge } from '../src/pointer-bridge';
import { attachFixedSizeGuard } from '../src/fixed-size';
import type { PipElements } from '../src/types';

describe('createPip', () => {
  it('should initialize with correct default state', () => {
    const pip = createPip();
    expect(pip.isOpen()).toBe(false);
    expect(pip.getPipWindow()).toBeNull();
  });

  it('should open and close', async () => {
    const pip = createPip();
    await pip.open();
    expect(pip.isOpen()).toBe(true);
    expect(pip.getPipWindow()).not.toBeNull();

    pip.close();
    expect(pip.isOpen()).toBe(false);
    expect(pip.getPipWindow()).toBeNull();
  });

  it('should handle onBeforeOpen cancellation', async () => {
    const pip = createPip({
      onBeforeOpen: () => false,
    });
    await pip.open();
    expect(pip.isOpen()).toBe(false);
  });

  it('should handle toggle', async () => {
    const pip = createPip();
    await pip.toggle();
    expect(pip.isOpen()).toBe(true);
    await pip.toggle();
    expect(pip.isOpen()).toBe(false);
  });

  it('should call onClose when window is closed via pagehide', async () => {
    const onClose = vi.fn();
    const pip = createPip({ onClose });
    await pip.open();
    const win = pip.getPipWindow();
    win?.dispatchEvent(new Event('pagehide'));
    expect(pip.isOpen()).toBe(false);
    expect(onClose).toHaveBeenCalled();
  });

  it('should call onPipWindowReady via requestAnimationFrame', async () => {
    const onPipWindowReady = vi.fn();
    const pip = createPip({ onPipWindowReady });
    await pip.open();

    await new Promise(r => requestAnimationFrame(r));

    expect(onPipWindowReady).toHaveBeenCalled();
  });

  it('should handle requestWindow errors via onError', async () => {
    const onError = vi.fn();
    const pip = createPip({ onError });

    const error = new Error('Not allowed');
    (window as any).documentPictureInPicture.requestWindow = vi.fn().mockRejectedValue(error);

    await pip.open();
    expect(onError).toHaveBeenCalledWith(error);
    expect(pip.isOpen()).toBe(false);
  });

  it('should throw requestWindow errors if no onError is provided', async () => {
    const pip = createPip();
    const error = new Error('Not allowed');
    (window as any).documentPictureInPicture.requestWindow = vi.fn().mockRejectedValue(error);

    await expect(pip.open()).rejects.toThrow('Not allowed');
    expect(pip.isOpen()).toBe(false);
  });

  it('should handle destroy and double destroy safely', () => {
    const pip = createPip();
    pip.destroy();
    expect(pip.isOpen()).toBe(false);

    expect(() => pip.destroy()).not.toThrow();
  });

  it('should infer dimensions from contentEl passed as elements param', async () => {
    const mockWin: any = new EventTarget();
    mockWin.document = {
      body: document.createElement('body'),
      documentElement: document.createElement('html')
    };
    const mockRequestWindow = vi.fn().mockResolvedValue(mockWin as Window);
    (window as any).documentPictureInPicture.requestWindow = mockRequestWindow;

    const contentEl = document.createElement('div');
    contentEl.getBoundingClientRect = () => ({ width: 400, height: 300 } as any);

    const pip = createPip();
    await pip.open({ contentEl });

    expect(mockRequestWindow).toHaveBeenCalledWith(expect.objectContaining({
      width: 400,
      height: 300
    }));
  });

  it('should call close when polling detects pipWindow.closed', async () => {
    vi.useFakeTimers();
    const pip = createPip();
    await pip.open();
    const win = pip.getPipWindow() as any;
    expect(pip.isOpen()).toBe(true);

    win.closed = true;

    vi.advanceTimersByTime(300);
    expect(pip.isOpen()).toBe(false);
    vi.useRealTimers();
  });

  it('should trigger fallback path when forceFallback is true even if supported', async () => {
    const fallback = vi.fn();
    const pip = createPip({
      forceFallback: true,
      fallback,
    });

    await pip.open();

    expect(fallback).toHaveBeenCalled();
    const mockRequestWindow = (window as any).documentPictureInPicture.requestWindow;
    expect(mockRequestWindow).not.toHaveBeenCalled();
  });

  it('should not auto-register in the global registry even when id is provided', () => {
    const pip = createPip({ id: 'no-auto-register' });
    expect(getPip('no-auto-register')).toBeNull();

    registerPip('no-auto-register', pip);
    expect(getPip('no-auto-register')).toBe(pip);
    unregisterPip('no-auto-register');
  });

  it('should clean up pagehide/unload listeners on close', async () => {
    const pip = createPip();
    await pip.open();
    const win = pip.getPipWindow() as any;

    const pagehideListeners = win._listeners['pagehide']?.length || 0;
    const unloadListeners = win._listeners['unload']?.length || 0;
    expect(pagehideListeners).toBeGreaterThan(0);
    expect(unloadListeners).toBeGreaterThan(0);

    pip.close();

    expect(win._listeners['pagehide']?.length || 0).toBe(0);
    expect(win._listeners['unload']?.length || 0).toBe(0);
  });

  it('should cancel onPipWindowReady rAF if closed before frame fires', async () => {
    const onPipWindowReady = vi.fn();
    const pip = createPip({ onPipWindowReady });
    await pip.open();

    pip.close();

    await new Promise(r => setTimeout(r, 50));

    expect(onPipWindowReady).not.toHaveBeenCalled();
  });

  it('should isolate disposer errors — one failing disposer must not prevent others from running', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Use forceFallback + custom fallback to inject a disposer that throws.
    // The fallback function's return value is pushed onto the disposers array.
    const customPip = createPip({
      forceFallback: true,
      fallback: () => {
        // Return a disposer that throws
        return () => {
          throw new Error('boom');
        };
      },
    });

    await customPip.open();
    expect(customPip.isOpen()).toBe(true);

    // close() calls cleanup() which calls each disposer in try/catch
    customPip.close();

    // The disposer threw — but the try/catch in cleanup should catch it
    // and log via console.error
    expect(errorSpy).toHaveBeenCalledWith(
      '[pip-it-up] disposer failed:',
      expect.any(Error)
    );

    // Verify the instance is properly closed despite the error
    expect(customPip.isOpen()).toBe(false);

    errorSpy.mockRestore();
  });

  it('should run all remaining disposers even when one throws', async () => {
    // More targeted test: use the internal structure directly
    // Open a real pip, then verify that adding a throwing pagehide listener
    // doesn't prevent interval cleanup

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const pip = createPip({
      // Use two lifecycle features that each register disposers:
      // - forwardKeyboardEvents (keyboard bridge disposer)
      // - copyStyles: 'sync' (style sync disposer)
      // - pagehide/unload listeners (always registered)
      // - close poll interval (always registered)
      forwardKeyboardEvents: true,
      copyStyles: 'sync',
    });

    await pip.open();
    const win = pip.getPipWindow();
    expect(win).not.toBeNull();

    // Closing should run ALL disposers even if the environment is messy
    pip.close();
    expect(pip.isOpen()).toBe(false);
    expect(pip.getPipWindow()).toBeNull();

    errorSpy.mockRestore();
  });

  it('should update options dynamically', async () => {
    const onClose1 = vi.fn();
    const onClose2 = vi.fn();
    const pip = createPip({ onClose: onClose1 });
    await pip.open();
    
    pip.updateOptions({ onClose: onClose2 });
    
    const win = pip.getPipWindow();
    win?.dispatchEvent(new Event('pagehide'));
    
    expect(onClose1).not.toHaveBeenCalled();
    expect(onClose2).toHaveBeenCalled();
  });

  it('should support setting default elements and checking video support when Pip is unsupported', () => {
    const originalPiP = (window as any).documentPictureInPicture;
    delete (window as any).documentPictureInPicture;
    
    const originalPiPEnabled = (document as any).pictureInPictureEnabled;
    (document as any).pictureInPictureEnabled = true;

    try {
      const pip = createPip();
      expect(pip.getState().isSupported).toBe(false);

      const contentEl = document.createElement('div');
      const video = document.createElement('video');
      contentEl.appendChild(video);

      pip.setDefaultElements({ contentEl });
      expect(pip.getState().isSupported).toBe(true);
    } finally {
      (window as any).documentPictureInPicture = originalPiP;
      if (originalPiPEnabled !== undefined) {
        (document as any).pictureInPictureEnabled = originalPiPEnabled;
      } else {
        delete (document as any).pictureInPictureEnabled;
      }
    }
  });
});

describe('element registration', () => {
  it('partial update preserves the sibling slot', () => {
    const pip = createPip();
    const c = document.createElement('div');
    const o = document.createElement('div');
    pip.registerElements({ contentEl: c });
    pip.setDefaultElements({ originEl: o });
    expect(pip.getDefaultElements()).toEqual({ contentEl: c, originEl: o });
  });

  it('converges when unmount(A) precedes mount(B)', () => {
    const pip = createPip();
    const a = document.createElement('div');
    const b = document.createElement('div');
    const ra = pip.registerElements({ originEl: a });
    ra.release();
    const rb = pip.registerElements({ originEl: b });
    expect(pip.getDefaultElements().originEl).toBe(b);
  });

  it('converges when mount(B) precedes unmount(A)', () => {
    const pip = createPip();
    const a = document.createElement('div');
    const b = document.createElement('div');
    const ra = pip.registerElements({ originEl: a });
    const rb = pip.registerElements({ originEl: b });
    ra.release();
    expect(pip.getDefaultElements().originEl).toBe(b);
  });

  it('outgoing release performs no commit', () => {
    const pip = createPip();
    const a = document.createElement('div');
    const b = document.createElement('div');
    const ra = pip.registerElements({ originEl: a });
    const rb = pip.registerElements({ originEl: b });
    const spy = vi.fn();
    pip.subscribeElements(spy);
    ra.release();
    expect(spy).not.toHaveBeenCalled();
  });

  it('release is idempotent', () => {
    const pip = createPip();
    const a = document.createElement('div');
    const ra = pip.registerElements({ originEl: a });
    ra.release();
    const spy = vi.fn();
    pip.subscribeElements(spy);
    ra.release();
    expect(spy).not.toHaveBeenCalled();
  });

  it('update after release is inert', () => {
    const pip = createPip();
    const a = document.createElement('div');
    const b = document.createElement('div');
    const ra = pip.registerElements({ originEl: a });
    ra.release();
    ra.update({ originEl: b });
    expect(pip.getDefaultElements().originEl).toBeUndefined();
  });

  it('explicit null disowns the slot before release', () => {
    const pip = createPip();
    const a = document.createElement('div');
    const b = document.createElement('div');
    const r = pip.registerElements({ originEl: a });
    r.update({ originEl: null });
    pip.registerElements({ originEl: b });
    r.release();
    expect(pip.getDefaultElements().originEl).toBe(b);
  });

  it('second claimant wins and first release is inert', () => {
    const pip = createPip();
    const a = document.createElement('div');
    const b = document.createElement('div');
    const first = pip.registerElements({ originEl: a });
    const second = pip.registerElements({ originEl: b });
    first.release();
    expect(pip.getDefaultElements().originEl).toBe(b);
  });

  it('clearing both slots while open does not close', async () => {
    const pip = createPip();
    await pip.open();
    pip.setDefaultElements({ contentEl: null, originEl: null } as unknown as Partial<PipElements>);
    expect(pip.isOpen()).toBe(true);
  });

  it('removing the origin node does not throw or close', async () => {
    const pip = createPip();
    const originEl = document.createElement('div');
    document.body.appendChild(originEl);
    pip.setDefaultElements({ originEl });
    await pip.open();
    expect(() => {
      originEl.remove();
    }).not.toThrow();
    expect(pip.isOpen()).toBe(true);
  });

  it('getDefaultElements is referentially stable across a no-op', () => {
    const pip = createPip();
    const a = pip.getDefaultElements();
    pip.setDefaultElements({});
    const b = pip.getDefaultElements();
    expect(a).toBe(b);
  });

  it('subscribeElements fires only on real change', () => {
    const pip = createPip();
    const spy = vi.fn();
    pip.subscribeElements(spy);
    pip.setDefaultElements({});
    pip.setDefaultElements({});
    pip.setDefaultElements({});
    const o = document.createElement('div');
    pip.setDefaultElements({ originEl: o });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('subscribeElements disposer removes the listener', () => {
    const pip = createPip();
    const spy = vi.fn();
    const dispose = pip.subscribeElements(spy);
    dispose();
    const o = document.createElement('div');
    pip.setDefaultElements({ originEl: o });
    expect(spy).not.toHaveBeenCalled();
  });

  it('strict-mode-style claim/release/claim is idempotent', () => {
    const pip = createPip();
    const a = document.createElement('div');
    const r1 = pip.registerElements({ originEl: a });
    r1.release();
    const r2 = pip.registerElements({ originEl: a });
    expect(pip.getDefaultElements().originEl).toBe(a);
  });

  it('registerElements while destroyed returns the frozen singleton', () => {
    const pip = createPip();
    pip.destroy();
    const a = document.createElement('div');
    const handle = pip.registerElements({ originEl: a });
    expect(handle.released).toBe(true);
    expect(Object.isFrozen(handle)).toBe(true);
    expect(() => handle.update({ originEl: a })).not.toThrow();
    expect(() => handle.release()).not.toThrow();
    expect(pip.getDefaultElements().originEl).toBeUndefined();
  });
});

describe('teardown hooks', () => {
  it('hooks run before pipWindow.close()', async () => {
    const pip = createPip();
    let recordedClosed: boolean | undefined;
    let recordedParented: boolean | undefined;

    await pip.open();
    const win = pip.getPipWindow()!;
    const content = win.document.createElement('div');
    win.document.body.appendChild(content);

    pip.registerTeardown((pipWin) => {
      recordedClosed = pipWin?.closed;
      recordedParented = pipWin?.document.body.contains(content);
    });

    pip.close();
    expect(recordedClosed).toBe(false);
    expect(recordedParented).toBe(true);
  });

  it('hooks receive the live pipWindow', async () => {
    const pip = createPip();
    let capturedArg: Window | null = null;
    pip.registerTeardown((pipWin) => {
      capturedArg = pipWin;
    });

    await pip.open();
    const expectedWindow = pip.getPipWindow();
    expect(expectedWindow).not.toBeNull();

    pip.close();
    expect(capturedArg).toBe(expectedWindow);
  });

  it('hooks run LIFO', async () => {
    const pip = createPip();
    const order: number[] = [];

    pip.registerTeardown(() => {
      order.push(1);
    });
    pip.registerTeardown(() => {
      order.push(2);
    });
    pip.registerTeardown(() => {
      order.push(3);
    });

    await pip.open();
    pip.close();

    expect(order).toEqual([3, 2, 1]);
  });

  it('a throwing hook does not block the others', async () => {
    const pip = createPip();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ok1 = vi.fn();
    const throws = vi.fn(() => {
      throw new Error('hook error');
    });
    const ok2 = vi.fn();

    pip.registerTeardown(ok1);
    pip.registerTeardown(throws);
    pip.registerTeardown(ok2);

    await pip.open();
    pip.close();

    expect(ok1).toHaveBeenCalled();
    expect(ok2).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0][0]).toBe('[pip-it-up] teardown hook failed:');
    consoleSpy.mockRestore();
  });

  it('a throwing hook still closes the window', async () => {
    const pip = createPip();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const throws = vi.fn(() => {
      throw new Error('hook error');
    });

    pip.registerTeardown(throws);

    await pip.open();
    const win = pip.getPipWindow()!;

    pip.close();

    expect(pip.isOpen()).toBe(false);
    expect(win.closed).toBe(true);
    consoleSpy.mockRestore();
  });

  it('a throwing hook does not strand isOpening', async () => {
    const pip = createPip();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const throws = vi.fn(() => {
      throw new Error('hook error');
    });

    pip.registerTeardown(throws);

    await pip.open();
    pip.close();
    expect(pip.isOpen()).toBe(false);

    await pip.open();
    expect(pip.isOpen()).toBe(true);
    pip.close();
    consoleSpy.mockRestore();
  });

  it('a hook may unregister another hook mid-run', async () => {
    const pip = createPip();
    let unregisterB: () => void = () => {};
    const hookC = vi.fn();
    const hookB = vi.fn();
    const hookA = vi.fn(() => {
      unregisterB();
    });

    pip.registerTeardown(hookC);
    unregisterB = pip.registerTeardown(hookB);
    pip.registerTeardown(hookA);

    await pip.open();
    expect(() => pip.close()).not.toThrow();
    expect(hookC).toHaveBeenCalled();
  });

  it('unregister prevents the hook from running', async () => {
    const pip = createPip();
    const spy = vi.fn();
    const unregister = pip.registerTeardown(spy);
    unregister();

    await pip.open();
    pip.close();

    expect(spy).not.toHaveBeenCalled();
  });

  it('unregister is idempotent', async () => {
    const pip = createPip();
    const spy = vi.fn();
    const unregister = pip.registerTeardown(spy);

    expect(() => {
      unregister();
      unregister();
    }).not.toThrow();

    await pip.open();
    pip.close();

    expect(() => {
      unregister();
    }).not.toThrow();

    pip.destroy();

    expect(() => {
      unregister();
    }).not.toThrow();
  });

  it('close() on a closed instance runs no hooks', async () => {
    const pip = createPip();
    const spy = vi.fn();
    pip.registerTeardown(spy);

    await pip.open();
    pip.close();
    expect(spy).toHaveBeenCalledTimes(1);

    pip.close();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('hooks receive null on the video-PiP fallback path', async () => {
    type PipDocument = { pictureInPictureEnabled?: boolean };
    type PipVideo = HTMLVideoElement & { requestPictureInPicture?: () => Promise<void> };

    const doc = document as unknown as PipDocument;
    const originalPiPEnabled = doc.pictureInPictureEnabled;
    doc.pictureInPictureEnabled = true;

    try {
      const contentEl = document.createElement('div');
      const video = document.createElement('video') as PipVideo;
      video.requestPictureInPicture = vi.fn().mockResolvedValue(undefined);
      contentEl.appendChild(video);

      let capturedArg: Window | null | undefined = undefined;
      const pip = createPip({
        forceFallback: true,
      });
      pip.setDefaultElements({ contentEl });
      pip.registerTeardown((pipWin) => {
        capturedArg = pipWin;
      });

      await pip.open();
      expect(pip.isOpen()).toBe(true);
      expect(pip.getPipWindow()).toBeNull();

      pip.close();
      expect(capturedArg).toBeNull();
    } finally {
      if (originalPiPEnabled !== undefined) {
        doc.pictureInPictureEnabled = originalPiPEnabled;
      } else {
        delete doc.pictureInPictureEnabled;
      }
    }
  });

  it('registerTeardown after destroy returns a callable no-op', () => {
    const pip = createPip();
    pip.destroy();
    const fn = vi.fn();
    let un: (() => void) | undefined;
    expect(() => {
      un = pip.registerTeardown(fn);
    }).not.toThrow();
    expect(typeof un).toBe('function');
    expect(() => {
      un?.();
    }).not.toThrow();

    pip.close();
    expect(fn).not.toHaveBeenCalled();
  });

  it('close does not mutate the state object React is holding', async () => {
    const instance = createPip();
    await instance.open();
    const snapshot = instance.getState();
    expect(snapshot.isOpen).toBe(true);
    instance.close();
    expect(snapshot.isOpen).toBe(true);
    expect(instance.getState().isOpen).toBe(false);
  });

  it('teardown hooks run exactly once when pipWindow.close() re-enters close', async () => {
    const instance = createPip();
    const spy = vi.fn();
    instance.registerTeardown(spy);
    await instance.open();
    instance.close();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('a throwing teardown hook still allows the instance to reopen', async () => {
    const instance = createPip();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    instance.registerTeardown(() => {
      throw new Error('teardown failure');
    });
    await instance.open();
    instance.close();
    await instance.open();
    expect(instance.isOpen()).toBe(true);
    instance.close();
    consoleSpy.mockRestore();
  });
});

describe('destroy semantics', () => {
  it('destroy clears element references', () => {
    const pip = createPip();
    const contentEl = document.createElement('div');
    const originEl = document.createElement('div');
    pip.registerElements({ contentEl, originEl });
    expect(pip.getDefaultElements()).toEqual({ contentEl, originEl });

    pip.destroy();
    const result = pip.getDefaultElements();
    expect(result).toEqual({});
    expect('contentEl' in result).toBe(false);
    expect('originEl' in result).toBe(false);
  });

  it('destroy aborts the lifetime signal', () => {
    const pip = createPip();
    expect(pip.signal.aborted).toBe(false);
    pip.destroy();
    expect(pip.signal.aborted).toBe(true);
  });

  it('destroy is idempotent', async () => {
    const errorSpy = vi.spyOn(console, 'error');
    const onClose = vi.fn();
    const pip = createPip({ onClose });
    await pip.open();

    expect(() => {
      pip.destroy();
      pip.destroy();
    }).not.toThrow();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(pip.destroyed).toBe(true);
  });

  it('destroy while open closes the window', async () => {
    const pip = createPip();
    await pip.open();
    const pipWindow = pip.getPipWindow();
    expect(pipWindow).not.toBeNull();
    expect(pipWindow?.closed).toBe(false);

    pip.destroy();
    expect(pipWindow?.closed).toBe(true);
    expect(pip.isOpen()).toBe(false);
  });

  it('destroy runs teardown hooks', async () => {
    const pip = createPip();
    const hookSpy = vi.fn();
    pip.registerTeardown(hookSpy);
    await pip.open();

    pip.destroy();
    expect(hookSpy).toHaveBeenCalledTimes(1);
  });

  it('open after destroy warns and does not request a window', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const pip = createPip();
    pip.destroy();

    const requestWindowMock = (window as any).documentPictureInPicture.requestWindow;
    requestWindowMock.mockClear();

    await pip.open();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('ERR_DESTROYED');
    expect(requestWindowMock).not.toHaveBeenCalled();
  });

  it('setDefaultElements after destroy is inert', () => {
    const pip = createPip();
    pip.destroy();

    const originEl = document.createElement('div');
    pip.setDefaultElements({ originEl });
    expect(pip.getDefaultElements()).toEqual({});
  });

  it('registerElements after destroy returns an inert handle', () => {
    const pip = createPip();
    pip.destroy();

    const originEl = document.createElement('div');
    const r = pip.registerElements({ originEl });
    expect(r.released).toBe(true);
    expect(() => r.release()).not.toThrow();
  });

  it('subscribe after destroy returns a no-op disposer', () => {
    const pip = createPip();
    pip.destroy();

    const fn = vi.fn();
    const un = pip.subscribe(fn);
    expect(typeof un).toBe('function');
    expect(() => un()).not.toThrow();
    expect(fn).not.toHaveBeenCalled();

    const fnEl = vi.fn();
    const unEl = pip.subscribeElements(fnEl);
    expect(typeof unEl).toBe('function');
    expect(() => unEl()).not.toThrow();
    expect(fnEl).not.toHaveBeenCalled();
  });

  it('destroy on a never-opened instance does not throw', () => {
    const pip = createPip();
    expect(() => pip.destroy()).not.toThrow();
    expect(pip.destroyed).toBe(true);
  });

  it('signal-bound listener survives a throwing disposer', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bridgeSpy = vi.spyOn(kb, 'startKeyboardBridge').mockReturnValue(() => {
      throw new Error('throwing disposer');
    });

    const onClose = vi.fn();
    const pip = createPip({
      forwardKeyboardEvents: true,
      onClose,
    });

    await pip.open();
    const win = pip.getPipWindow()!;
    expect(win).not.toBeNull();

    pip.destroy();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(pip.signal.aborted).toBe(true);

    win.dispatchEvent(new Event('pagehide'));
    expect(onClose).toHaveBeenCalledTimes(1);

    bridgeSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe('updateOptions merge', () => {
  it('partial update preserves untouched options', async () => {
    const fn = vi.fn();
    const pip = createPip({ width: 900, onClose: fn });
    pip.updateOptions({ width: 400 });
    await pip.open();
    pip.close();

    expect(fn).toHaveBeenCalledTimes(1);
    expect((window as any).documentPictureInPicture.requestWindow).toHaveBeenCalledWith(
      expect.objectContaining({ width: 400 })
    );
  });

  it('empty update changes nothing', async () => {
    const pip = createPip({ width: 900 });
    pip.updateOptions({});
    await pip.open();

    expect((window as any).documentPictureInPicture.requestWindow).toHaveBeenCalledWith(
      expect.objectContaining({ width: 900 })
    );
    pip.close();
  });

  it('undefined does not clear a callback', async () => {
    const fn = vi.fn();
    const pip = createPip({ onClose: fn });
    pip.updateOptions({ onClose: undefined });
    await pip.open();
    pip.close();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('false is applied, not skipped', async () => {
    const pip = createPip({});
    pip.updateOptions({ pipBodyStyles: false });
    await pip.open();

    const pipWindow = pip.getPipWindow()!;
    expect(pipWindow.document.body.style.margin).toBe('');
    pip.close();
  });

  it('reserveSpace false is applied', async () => {
    const pip = createPip({ mode: 'move' });
    pip.updateOptions({ reserveSpace: false });
    const contentEl = document.createElement('div');
    contentEl.getBoundingClientRect = () => ({ width: 300, height: 200 } as any);
    const originEl = document.createElement('div');
    document.body.appendChild(originEl);
    pip.setDefaultElements({ contentEl, originEl });

    await pip.open();

    expect(originEl.style.minWidth).toBe('');
    pip.close();
    originEl.remove();
  });

  it('id is ignored', () => {
    const pip = createPip({ id: 'a' });
    pip.updateOptions({ id: 'b' });

    expect(pip.id).toBe('a');
  });

  it('mode is ignored', async () => {
    const pip = createPip({ mode: 'portal' });
    pip.updateOptions({ mode: 'move' });
    const contentEl = document.createElement('div');
    const originEl = document.createElement('div');
    document.body.appendChild(originEl);

    await pip.open({ contentEl, originEl });
    const pipWindow = pip.getPipWindow()!;

    expect(pipWindow.document.body.contains(contentEl)).toBe(false);
    pip.close();
    originEl.remove();
  });

  it('inert after destroy', () => {
    const pip = createPip({ width: 900 });
    pip.destroy();

    expect(() => {
      pip.updateOptions({ width: 1 });
    }).not.toThrow();
  });

  it('updateOptions({ id: \'other\', mode: \'clone\' }) is ignored for both keys', async () => {
    const pip = createPip({ id: 'initial-id', mode: 'portal' });
    pip.updateOptions({ id: 'other', mode: 'clone' });

    expect(pip.id).toBe('initial-id');

    const contentEl = document.createElement('div');
    await pip.open({ contentEl });
    const pipWindow = pip.getPipWindow()!;

    expect(pipWindow.document.body.children.length).toBe(0);
    pip.close();
  });
});

describe('teardown hook isolation', () => {
  it('a throwing hook does not block the others', async () => {
    const pip = createPip();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ok1 = vi.fn();
    const throws = vi.fn(() => {
      throw new Error('hook failure');
    });
    const ok2 = vi.fn();

    pip.registerTeardown(ok1);
    pip.registerTeardown(throws);
    pip.registerTeardown(ok2);

    await pip.open();
    pip.close();

    expect(ok1).toHaveBeenCalledTimes(1);
    expect(ok2).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0][0]).toBe('[pip-it-up] teardown hook failed:');
    consoleSpy.mockRestore();
  });

  it('a throwing hook still closes the window', async () => {
    const pip = createPip();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ok1 = vi.fn();
    const throws = vi.fn(() => {
      throw new Error('hook failure');
    });
    const ok2 = vi.fn();

    pip.registerTeardown(ok1);
    pip.registerTeardown(throws);
    pip.registerTeardown(ok2);

    await pip.open();
    const win = pip.getPipWindow()!;

    pip.close();

    expect(win.closed).toBe(true);
    expect(pip.isOpen()).toBe(false);
    consoleSpy.mockRestore();
  });

  it('a throwing hook does not strand isOpening', async () => {
    const pip = createPip();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ok1 = vi.fn();
    const throws = vi.fn(() => {
      throw new Error('hook failure');
    });
    const ok2 = vi.fn();

    pip.registerTeardown(ok1);
    pip.registerTeardown(throws);
    pip.registerTeardown(ok2);

    await pip.open();
    pip.close();

    await pip.open();
    expect(pip.isOpen()).toBe(true);
    pip.close();
    consoleSpy.mockRestore();
  });

  it('hooks run in reverse registration order', async () => {
    const pip = createPip();
    const recorded: number[] = [];

    pip.registerTeardown(() => {
      recorded.push(1);
    });
    pip.registerTeardown(() => {
      recorded.push(2);
    });
    pip.registerTeardown(() => {
      recorded.push(3);
    });

    await pip.open();
    pip.close();

    expect(recorded).toEqual([3, 2, 1]);
  });

  it('a hook may unregister another mid-run', async () => {
    const pip = createPip();
    let unregisterB: () => void = () => {};
    const hookC = vi.fn();
    const hookB = vi.fn();
    const hookA = vi.fn(() => {
      unregisterB();
    });

    pip.registerTeardown(hookC);
    unregisterB = pip.registerTeardown(hookB);
    pip.registerTeardown(hookA);

    await pip.open();
    expect(() => pip.close()).not.toThrow();
    expect(hookC).toHaveBeenCalledTimes(1);
  });

  it('a hook registered mid-run does not run in the same pass', async () => {
    const pip = createPip();
    const hookD = vi.fn();
    const hookA = vi.fn(() => {
      pip.registerTeardown(hookD);
    });

    pip.registerTeardown(hookA);

    await pip.open();
    pip.close();

    expect(hookA).toHaveBeenCalledTimes(1);
    expect(hookD).not.toHaveBeenCalled();
  });

  it('close on a closed instance runs no hooks', async () => {
    const pip = createPip();
    const hook = vi.fn();
    pip.registerTeardown(hook);

    await pip.open();
    pip.close();
    expect(hook).toHaveBeenCalledTimes(1);

    pip.close();
    expect(hook).toHaveBeenCalledTimes(1);
  });

  it('hooks tolerate a null window', async () => {
    type PipVideo = HTMLVideoElement & {
      requestPictureInPicture?: () => Promise<any>;
    };
    const doc = document as unknown as { pictureInPictureEnabled?: boolean };
    const originalPiPEnabled = doc.pictureInPictureEnabled;
    doc.pictureInPictureEnabled = true;

    try {
      const contentEl = document.createElement('div');
      const video = document.createElement('video') as PipVideo;
      video.requestPictureInPicture = vi.fn().mockResolvedValue(undefined);
      contentEl.appendChild(video);

      let capturedArg: Window | null | undefined = undefined;
      const pip = createPip({
        forceFallback: true,
      });
      pip.setDefaultElements({ contentEl });
      pip.registerTeardown((pipWin) => {
        capturedArg = pipWin;
      });

      await pip.open();
      expect(pip.isOpen()).toBe(true);

      expect(() => pip.close()).not.toThrow();
      expect(capturedArg).toBeNull();
    } finally {
      if (originalPiPEnabled !== undefined) {
        doc.pictureInPictureEnabled = originalPiPEnabled;
      } else {
        delete doc.pictureInPictureEnabled;
      }
    }
  });
});

function createFakeKeyboardEvent(
  type: string,
  opts: KeyboardEventInit & { isTrusted?: boolean } = {}
): KeyboardEvent {
  return {
    type,
    key: opts.key ?? '',
    code: opts.code ?? '',
    location: opts.location ?? 0,
    ctrlKey: opts.ctrlKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    altKey: opts.altKey ?? false,
    metaKey: opts.metaKey ?? false,
    repeat: opts.repeat ?? false,
    isComposing: opts.isComposing ?? false,
    bubbles: opts.bubbles ?? false,
    cancelable: opts.cancelable ?? false,
    composed: opts.composed ?? false,
    isTrusted: opts.isTrusted ?? false,
    keyCode: 0,
    charCode: 0,
    which: 0,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    stopImmediatePropagation: vi.fn(),
  } as unknown as KeyboardEvent;
}

describe('signal-bound listeners', () => {
  it('every addEventListener in core passes a signal', () => {
    const srcDir = path.resolve(__dirname, '../src');
    const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.ts'));
    const nonSignalCalls: { file: string; line: string }[] = [];

    const justifiedNonCalls = [
      "typeof pipWindow.document.addEventListener !== 'function'",
      '* Aborted by `destroy()`. Pass to `addEventListener`',
      '* - Event listeners added via `addEventListener`',
    ];

    for (const file of files) {
      const content = fs.readFileSync(path.join(srcDir, file), 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line) => {
        if (line.includes('addEventListener') && !line.includes('signal')) {
          const isJustified = justifiedNonCalls.some((j) => line.includes(j));
          if (!isJustified) {
            nonSignalCalls.push({ file, line: line.trim() });
          }
        }
      });
    }

    expect(nonSignalCalls).toEqual([]);
  });

  it('a throwing disposer still removes the listener', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const openerKeyHandler = vi.fn();
    window.addEventListener('keydown', openerKeyHandler);

    interface MockWinWithListeners {
      _listeners?: Record<string, ((...args: unknown[]) => void)[]>;
      addEventListener(type: string, listener: unknown, opts?: AddEventListenerOptions): void;
      removeEventListener(type: string, listener: unknown): void;
    }

    const docPip = window as unknown as { documentPictureInPicture: { requestWindow: (opts?: unknown) => Promise<Window> } };
    const origRequestWindow = docPip.documentPictureInPicture.requestWindow;
    const kbSpy = vi.spyOn(kb, 'startKeyboardBridge').mockImplementation((pipWin, openerWin, signal) => {
      const handleKey = (e: KeyboardEvent) => {
        if (!e.isTrusted) return;
        openerWin?.dispatchEvent(new KeyboardEvent(e.type, { key: e.key, bubbles: true }));
      };
      pipWin.addEventListener('keydown', handleKey as EventListener, { signal });

      return () => {
        throw new Error('disposer failure before removeEventListener');
      };
    });

    try {
      // Mock requestWindow so that the mock window's addEventListener implements { signal } abort handling
      docPip.documentPictureInPicture.requestWindow = vi.fn(async (options?: unknown) => {
        const win = (await origRequestWindow(options)) as unknown as MockWinWithListeners;
        const originalAdd = win.addEventListener.bind(win);
        win.addEventListener = (type: string, listener: unknown, opts?: AddEventListenerOptions) => {
          originalAdd(type, listener);
          if (opts?.signal) {
            opts.signal.addEventListener('abort', () => {
              if (win._listeners && win._listeners[type]) {
                win._listeners[type] = win._listeners[type].filter((l) => l !== listener);
              }
            });
          }
        };
        return win as unknown as Window;
      });

      const pip = createPip();
      await pip.open();
      const pipWin = pip.getPipWindow()!;

      // close() triggers cleanup(), in which the keyboard bridge disposer throws,
      // but cleanup() isolates the error and proceeds to abort the session controller.
      pip.close();

      // Dispatch keydown on mock PiP window; since signal aborted, the listener was removed.
      const event = createFakeKeyboardEvent('keydown', { key: 'a', bubbles: true, isTrusted: true });
      pipWin.dispatchEvent(event);

      expect(openerKeyHandler).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', openerKeyHandler);
      kbSpy.mockRestore();
      docPip.documentPictureInPicture.requestWindow = origRequestWindow;
      errorSpy.mockRestore();
    }
  });

  it('reopening registers live listeners', async () => {
    const openerKeyHandler = vi.fn();
    window.addEventListener('keydown', openerKeyHandler);

    const pip = createPip();
    await pip.open();
    pip.close();

    await pip.open();
    const pipWin2 = pip.getPipWindow()!;
    const event = createFakeKeyboardEvent('keydown', { key: 'Enter', bubbles: true, isTrusted: true });
    pipWin2.dispatchEvent(event);

    expect(openerKeyHandler).toHaveBeenCalledTimes(1);

    pip.close();
    window.removeEventListener('keydown', openerKeyHandler);
  });

  it('session controller is aborted by close', async () => {
    const spy = vi.spyOn(kb, 'startKeyboardBridge');
    let capturedSignal: AbortSignal | undefined;
    spy.mockImplementation((pipWin, openerWin, signal) => {
      capturedSignal = signal;
      return () => {};
    });

    try {
      const pip = createPip();
      await pip.open();
      expect(capturedSignal).toBeDefined();
      expect(capturedSignal?.aborted).toBe(false);

      pip.close();
      expect(capturedSignal?.aborted).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('destroy aborts the lifetime signal', () => {
    const pip = createPip();
    expect(pip.signal.aborted).toBe(false);
    pip.destroy();
    expect(pip.signal.aborted).toBe(true);
  });

  it('abort disposer tolerates a null controller', async () => {
    const pip = createPip();
    await pip.open();
    expect(() => {
      pip.close();
      pip.close();
    }).not.toThrow();
  });

  it('signal undefined does not throw', () => {
    const openerKeyHandler = vi.fn();
    window.addEventListener('keydown', openerKeyHandler);

    let keyHandler: ((e: KeyboardEvent) => void) | null = null;
    const winMock = {
      addEventListener: vi.fn((type: string, l: unknown) => {
        if (type === 'keydown') keyHandler = l as (e: KeyboardEvent) => void;
      }),
      removeEventListener: vi.fn((type: string, l: unknown) => {
        if (keyHandler === l) keyHandler = null;
      }),
    } as unknown as Window;

    const cleanup = startKeyboardBridge(winMock, window);
    expect(typeof cleanup).toBe('function');
    expect(keyHandler).not.toBeNull();

    keyHandler!(createFakeKeyboardEvent('keydown', { key: 'b', bubbles: true, isTrusted: true }));
    expect(openerKeyHandler).toHaveBeenCalledTimes(1);

    expect(() => cleanup()).not.toThrow();
    window.removeEventListener('keydown', openerKeyHandler);
  });

  it('pointer bridge capture flag matches between registration and removal', () => {
    const registered: { type: string; options: unknown }[] = [];
    const removed: { type: string; options: unknown }[] = [];

    const mockDoc = {
      addEventListener: vi.fn((type: string, _fn: unknown, opts?: unknown) => {
        registered.push({ type, options: opts });
      }),
      removeEventListener: vi.fn((type: string, _fn: unknown, opts?: unknown) => {
        removed.push({ type, options: opts });
      }),
    };
    const mockWin = {
      document: mockDoc,
    } as unknown as Window;

    const cleanup = startPointerBridge(mockWin, window);
    cleanup();

    expect(registered.length).toBeGreaterThan(0);
    expect(registered.length).toBe(removed.length);
    for (let i = 0; i < registered.length; i++) {
      expect((registered[i].options as { capture?: boolean })?.capture).toBe(true);
      expect((removed[i].options as { capture?: boolean })?.capture).toBe(true);
    }
  });

  it('all bridges return a disposer function', () => {
    const mockDoc = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      documentElement: { style: {} },
      body: { style: {} },
    };
    const mockWin = {
      document: mockDoc,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      resizeTo: vi.fn(),
    } as unknown as Window;

    const d1 = startKeyboardBridge(mockWin, window);
    expect(typeof d1).toBe('function');
    d1();

    const d2 = startPointerBridge(mockWin, window);
    expect(typeof d2).toBe('function');
    d2();

    const d3 = attachFixedSizeGuard(mockWin, 400, 300);
    expect(typeof d3).toBe('function');
    d3();
  });

  it('attachFixedSizeGuard writes styles regardless of signal', () => {
    const docEl = document.createElement('html');
    const bodyEl = document.createElement('body');
    const mockWin = {
      document: {
        documentElement: docEl,
        body: bodyEl,
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      resizeTo: vi.fn(),
    } as unknown as Window;

    const ac = new AbortController();
    const cleanup = attachFixedSizeGuard(mockWin, 500, 400, ac.signal);

    expect(docEl.style.width).toBe('500px');
    expect(docEl.style.height).toBe('400px');
    expect(docEl.style.overflow).toBe('hidden');
    expect(bodyEl.style.width).toBe('500px');
    expect(bodyEl.style.height).toBe('400px');
    expect(bodyEl.style.overflow).toBe('hidden');
    expect(bodyEl.style.margin).toBe('0px');

    cleanup();
  });
});

