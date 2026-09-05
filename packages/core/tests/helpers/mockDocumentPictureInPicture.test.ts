import { describe, it, expect, vi } from 'vitest';
import {
  mockDocumentPictureInPicture,
  clearMockDocumentPictureInPicture,
} from './mockDocumentPictureInPicture';
import { isUsable } from '../../src/elements';

describe('mockDocumentPictureInPicture', () => {
  it('mock body belongs to a different document', async () => {
    const { requestWindow, getCurrent } = mockDocumentPictureInPicture();
    await requestWindow({});
    const win = getCurrent()!;
    expect(win.document.body.ownerDocument).not.toBe(document);
  });

  it('defaultView points at the mock window', async () => {
    const { requestWindow, getCurrent } = mockDocumentPictureInPicture();
    await requestWindow({});
    const win = getCurrent()!;
    expect(win.document.defaultView).toBe(win);
  });

  it('withDefaultView false yields a dead document', async () => {
    const { requestWindow, getCurrent } = mockDocumentPictureInPicture({ withDefaultView: false });
    await requestWindow({});
    const win = getCurrent()!;
    expect(win.document.defaultView).toBeNull();
  });

  it('isUsable accepts a node in the live mock document', async () => {
    const { requestWindow, getCurrent } = mockDocumentPictureInPicture();
    await requestWindow({});
    const win = getCurrent()!;
    const div = win.document.createElement('div');
    win.document.body.appendChild(div);
    expect(div.isConnected).toBe(true);
    expect(isUsable(div)).toBe(true);
  });

  it('isUsable rejects the node after close', async () => {
    const { requestWindow, getCurrent } = mockDocumentPictureInPicture();
    await requestWindow({});
    const win = getCurrent()!;
    const div = win.document.createElement('div');
    win.document.body.appendChild(div);
    win.close();
    expect(isUsable(div)).toBe(false);
  });

  it('defaultView is revoked before pagehide fires', async () => {
    const { requestWindow, getCurrent } = mockDocumentPictureInPicture();
    await requestWindow({});
    const win = getCurrent()!;
    let recordedDefaultView: unknown = 'unfired';
    win.addEventListener('pagehide', () => {
      recordedDefaultView = win.document.defaultView;
    });
    win.close();
    expect(recordedDefaultView).toBeNull();
  });

  it('close twice dispatches pagehide once', async () => {
    const { requestWindow, getCurrent } = mockDocumentPictureInPicture();
    await requestWindow({});
    const win = getCurrent()!;
    const handler = vi.fn();
    win.addEventListener('pagehide', handler);
    win.close();
    win.close();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('an already-aborted signal blocks registration', async () => {
    const { requestWindow, getCurrent } = mockDocumentPictureInPicture();
    await requestWindow({});
    const win = getCurrent()!;
    const c = new AbortController();
    c.abort();
    const handler = vi.fn();
    win.addEventListener('keydown', handler, { signal: c.signal });
    expect(win.__listenerCount('keydown')).toBe(0);
    win.dispatchEvent(new Event('keydown'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('aborting removes the listener', async () => {
    const { requestWindow, getCurrent } = mockDocumentPictureInPicture();
    await requestWindow({});
    const win = getCurrent()!;
    const c = new AbortController();
    const handler = vi.fn();
    win.addEventListener('keydown', handler, { signal: c.signal });
    expect(win.__listenerCount('keydown')).toBe(1);
    c.abort();
    expect(win.__listenerCount('keydown')).toBe(0);
    win.dispatchEvent(new Event('keydown'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('self-removal during dispatch is safe', async () => {
    const { requestWindow, getCurrent } = mockDocumentPictureInPicture();
    await requestWindow({});
    const win = getCurrent()!;
    const secondHandler = vi.fn();
    const firstHandler = vi.fn(() => {
      win.removeEventListener('custom', secondHandler);
    });
    win.addEventListener('custom', firstHandler);
    win.addEventListener('custom', secondHandler);
    expect(() => {
      win.dispatchEvent(new Event('custom'));
    }).not.toThrow();
    expect(firstHandler).toHaveBeenCalledTimes(1);
    expect(secondHandler).not.toHaveBeenCalled();
  });

  it('resizeTo updates the dimensions', async () => {
    const { requestWindow, getCurrent } = mockDocumentPictureInPicture();
    await requestWindow({});
    const win = getCurrent()!;
    win.resizeTo(400, 300);
    expect(win.innerWidth).toBe(400);
    expect(win.innerHeight).toBe(300);
  });

  it('rejectWithNotAllowed rejects with the right name', async () => {
    const { requestWindow } = mockDocumentPictureInPicture({ rejectWithNotAllowed: true });
    await expect(requestWindow({})).rejects.toMatchObject({ name: 'NotAllowedError' });
  });

  it('clear releases the current window', async () => {
    const { requestWindow, getCurrent } = mockDocumentPictureInPicture();
    await requestWindow({});
    expect(getCurrent()).not.toBeNull();
    clearMockDocumentPictureInPicture();
    expect(getCurrent()).toBeNull();
  });

  it('existing core suite still passes', async () => {
    const { requestWindow, getCurrent } = mockDocumentPictureInPicture();
    await requestWindow({});
    const win = getCurrent()!;
    expect(win.document.body).toBeDefined();
    expect(win.document.head).toBeDefined();
    expect(win.document.documentElement).toBeDefined();
    expect(typeof win.document.createElement).toBe('function');
    expect(typeof win.document.querySelectorAll).toBe('function');
    expect(typeof win.focus).toBe('function');
  });
});
