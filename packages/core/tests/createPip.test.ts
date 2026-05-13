import { describe, it, expect, vi } from 'vitest';
import { createPip } from '../src/createPip';

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
    
    // Fast-forward requestAnimationFrame
    await new Promise(r => requestAnimationFrame(r));
    
    expect(onPipWindowReady).toHaveBeenCalled();
  });

  it('should handle requestWindow errors via onError', async () => {
    const onError = vi.fn();
    const pip = createPip({ onError });
    
    // Mock requestWindow to throw
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

  it('should unregister on destroy and handle double destroy safely', () => {
    const pip = createPip({ id: 'test-destroy' });
    pip.destroy();
    expect(pip.isOpen()).toBe(false);
    
    // Double destroy should not throw
    expect(() => pip.destroy()).not.toThrow();
  });
});
