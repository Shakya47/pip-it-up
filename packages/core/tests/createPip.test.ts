import { describe, it, expect, vi } from 'vitest';
import { createPip } from '../src/createPip';
import { getPip, registerPip, unregisterPip } from '../src/registry';

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
});
