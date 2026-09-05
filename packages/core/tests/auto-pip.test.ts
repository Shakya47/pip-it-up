import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAutoPip, registerEnterPipAction } from '../src/auto-pip';

/** jsdom has no `visibilityState` setter, so it is redefined per test. */
const setVisibility = (value: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', {
    value,
    configurable: true,
  });
};

const setActivation = (isActive: boolean) => {
  Object.defineProperty(navigator, 'userActivation', {
    value: { isActive, hasBeenActive: true },
    configurable: true,
  });
};

const fireVisibilityChange = async () => {
  document.dispatchEvent(new Event('visibilitychange'));
  // The listener is async: let its microtasks drain before asserting.
  await Promise.resolve();
  await Promise.resolve();
};

describe('createAutoPip', () => {
  beforeEach(() => {
    setVisibility('visible');
    setActivation(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'userActivation');
  });

  it('enters PiP when the document becomes hidden', async () => {
    const enter = vi.fn();
    const stop = createAutoPip(enter);

    setVisibility('hidden');
    await fireVisibilityChange();

    expect(enter).toHaveBeenCalledTimes(1);
    stop();
  });

  it('does nothing while the document is still visible', async () => {
    const enter = vi.fn();
    const stop = createAutoPip(enter);

    await fireVisibilityChange();

    expect(enter).not.toHaveBeenCalled();
    stop();
  });

  it('skips the attempt when `when` returns false', async () => {
    const enter = vi.fn();
    const stop = createAutoPip(enter, { when: () => false });

    setVisibility('hidden');
    await fireVisibilityChange();

    expect(enter).not.toHaveBeenCalled();
    stop();
  });

  it('reports `grantedBy: gesture` when an activation was live', async () => {
    const onResult = vi.fn();
    const stop = createAutoPip(vi.fn(), { onResult });

    setVisibility('hidden');
    await fireVisibilityChange();

    expect(onResult).toHaveBeenCalledWith({ ok: true, grantedBy: 'gesture' });
    stop();
  });

  it('reports `grantedBy: browser` when no activation was live', async () => {
    setActivation(false);
    const onResult = vi.fn();
    const stop = createAutoPip(vi.fn(), { onResult });

    setVisibility('hidden');
    await fireVisibilityChange();

    expect(onResult).toHaveBeenCalledWith({ ok: true, grantedBy: 'browser' });
    stop();
  });

  it('reports a rejection with the activation state read before the call', async () => {
    setActivation(false);
    const error = new DOMException('denied', 'NotAllowedError');
    const onResult = vi.fn();
    const stop = createAutoPip(
      () => Promise.reject(error),
      { onResult }
    );

    setVisibility('hidden');
    await fireVisibilityChange();

    expect(onResult).toHaveBeenCalledWith({ ok: false, error, hadActivation: false });
    stop();
  });

  it('swallows a rejection instead of producing an unhandled rejection', async () => {
    const stop = createAutoPip(() => Promise.reject(new Error('boom')));

    setVisibility('hidden');
    await expect(fireVisibilityChange()).resolves.toBeUndefined();

    stop();
  });

  it('treats a missing `navigator.userActivation` as no activation', async () => {
    Reflect.deleteProperty(navigator, 'userActivation');
    const onResult = vi.fn();
    const stop = createAutoPip(vi.fn(), { onResult });

    setVisibility('hidden');
    await fireVisibilityChange();

    expect(onResult).toHaveBeenCalledWith({ ok: true, grantedBy: 'browser' });
    stop();
  });

  it('stops attempting once disposed', async () => {
    const enter = vi.fn();
    const stop = createAutoPip(enter);
    stop();

    setVisibility('hidden');
    await fireVisibilityChange();

    expect(enter).not.toHaveBeenCalled();
  });

  it('stops attempting when an external signal aborts', async () => {
    const controller = new AbortController();
    const enter = vi.fn();
    createAutoPip(enter, { signal: controller.signal });

    controller.abort();
    setVisibility('hidden');
    await fireVisibilityChange();

    expect(enter).not.toHaveBeenCalled();
  });

  it('is inert when handed an already-aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const enter = vi.fn();
    const stop = createAutoPip(enter, { signal: controller.signal });

    setVisibility('hidden');
    await fireVisibilityChange();

    expect(enter).not.toHaveBeenCalled();
    expect(() => stop()).not.toThrow();
  });

  it('unregisters the Media Session action when an external signal aborts', () => {
    const setActionHandler = vi.fn();
    Object.defineProperty(navigator, 'mediaSession', {
      value: { setActionHandler },
      configurable: true,
    });

    const controller = new AbortController();
    createAutoPip(vi.fn(), { mediaSession: true, signal: controller.signal });
    controller.abort();

    expect(setActionHandler).toHaveBeenLastCalledWith('enterpictureinpicture', null);

    Reflect.deleteProperty(navigator, 'mediaSession');
  });

  it('does not register the Media Session action unless asked', () => {
    const setActionHandler = vi.fn();
    Object.defineProperty(navigator, 'mediaSession', {
      value: { setActionHandler },
      configurable: true,
    });

    const stop = createAutoPip(vi.fn());
    expect(setActionHandler).not.toHaveBeenCalled();
    stop();

    Reflect.deleteProperty(navigator, 'mediaSession');
  });

  it('registers and unregisters the Media Session action when `mediaSession` is true', () => {
    const setActionHandler = vi.fn();
    Object.defineProperty(navigator, 'mediaSession', {
      value: { setActionHandler },
      configurable: true,
    });

    const stop = createAutoPip(vi.fn(), { mediaSession: true });
    expect(setActionHandler).toHaveBeenCalledWith('enterpictureinpicture', expect.any(Function));

    stop();
    expect(setActionHandler).toHaveBeenLastCalledWith('enterpictureinpicture', null);

    Reflect.deleteProperty(navigator, 'mediaSession');
  });
});

describe('registerEnterPipAction', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'mediaSession');
  });

  it('invokes `enter` when the browser fires the action', () => {
    // A holder object, not a `let`: TypeScript cannot prove the callback ran and would narrow a
    // bare local to `null`, making the invocation below uncallable.
    const captured: { handler: (() => void) | null } = { handler: null };
    Object.defineProperty(navigator, 'mediaSession', {
      value: {
        setActionHandler: (_a: string, h: (() => void) | null) => {
          captured.handler = h;
        },
      },
      configurable: true,
    });

    const enter = vi.fn();
    registerEnterPipAction(enter);
    captured.handler?.();

    expect(enter).toHaveBeenCalledTimes(1);
  });

  it('returns a no-op disposer when the action is unsupported', () => {
    Object.defineProperty(navigator, 'mediaSession', {
      value: {
        setActionHandler: () => {
          throw new TypeError('unsupported action');
        },
      },
      configurable: true,
    });

    const stop = registerEnterPipAction(vi.fn());
    expect(() => stop()).not.toThrow();
  });

  it('returns a no-op disposer when Media Session is absent', () => {
    const stop = registerEnterPipAction(vi.fn());
    expect(() => stop()).not.toThrow();
  });
});
