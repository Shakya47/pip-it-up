import { describe, it, expect } from 'vitest';
import { createMockVideo } from './mockMediaElement';

describe('mockMediaElement', () => {
  // Section 6 Matrix Tests
  it('is a real video element', () => {
    const handle = createMockVideo();
    expect(handle.element.tagName).toBe('VIDEO');
  });

  it('starts paused at zero', () => {
    const handle = createMockVideo();
    expect(handle.state.currentTime).toBe(0);
    expect(handle.element.currentTime).toBe(0);
    expect(handle.state.paused).toBe(true);
    expect(handle.element.paused).toBe(true);
  });

  it('does not advance while paused', () => {
    const handle = createMockVideo();
    handle.tick(5);
    expect(handle.state.currentTime).toBe(0);
    expect(handle.element.currentTime).toBe(0);
  });

  it('advances while playing', async () => {
    const handle = createMockVideo();
    await handle.element.play();
    handle.tick(5);
    expect(handle.state.currentTime).toBe(5);
    expect(handle.element.currentTime).toBe(5);
  });

  it('pause stops advancement', async () => {
    const handle = createMockVideo();
    await handle.element.play();
    handle.tick(5);
    handle.element.pause();
    handle.tick(5);
    expect(handle.state.currentTime).toBe(5);
    expect(handle.element.currentTime).toBe(5);
  });

  it('records detached ticks', async () => {
    const handle = createMockVideo();
    // element is detached (not in document.body or any connected tree)
    expect(handle.element.isConnected).toBe(false);
    await handle.element.play();
    handle.tick(1);
    expect(handle.state.detachedTicks).toBe(1);
  });

  it('no detached ticks across an attached move', async () => {
    const handle = createMockVideo();
    const a = document.createElement('div');
    const b = document.createElement('div');
    document.body.appendChild(a);
    document.body.appendChild(b);
    a.appendChild(handle.element);

    await handle.element.play();
    handle.tick(1);

    // moveHost: native DOM movement of node between attached parents
    const moveHost = (node: HTMLElement, target: HTMLElement): void => {
      const targetWithMoveBefore = target as { moveBefore?: (n: Node, r: Node | null) => void };
      if (typeof targetWithMoveBefore.moveBefore === 'function') {
        try {
          targetWithMoveBefore.moveBefore(node, null);
          return;
        } catch {
          // fall through
        }
      }
      target.appendChild(node);
    };

    moveHost(handle.element, b);
    handle.tick(1);

    expect(handle.state.detachedTicks).toBe(0);
    expect(handle.state.currentTime).toBe(2);

    a.remove();
    b.remove();
  });

  it('rejectNextPlay rejects once with NotAllowedError', async () => {
    const handle = createMockVideo();
    handle.rejectNextPlay();

    let caught: DOMException | Error | undefined;
    try {
      await handle.element.play();
    } catch (err: unknown) {
      caught = err as DOMException | Error;
    }

    expect(caught).toBeDefined();
    expect(caught?.name).toBe('NotAllowedError');

    // Second play resolves
    await expect(handle.element.play()).resolves.toBeUndefined();
    expect(handle.state.paused).toBe(false);
  });

  it('direct seek works', () => {
    const handle = createMockVideo();
    handle.element.currentTime = 15;
    expect(handle.element.currentTime).toBe(15);
    expect(handle.state.currentTime).toBe(15);
    expect(handle.state.paused).toBe(true);
    expect(handle.element.paused).toBe(true);
  });

  it('survives insertion into a mock PiP document', async () => {
    const handle = createMockVideo();
    await handle.element.play();
    handle.tick(15);

    const win = await window.documentPictureInPicture!.requestWindow();
    win.document.body.appendChild(handle.element);

    expect(handle.element.currentTime).toBe(15);
    expect(handle.state.currentTime).toBe(15);
    expect(handle.element.paused).toBe(false);
    expect(handle.state.paused).toBe(false);
    win.close();
  });

  it('two handles are independent', async () => {
    const handle1 = createMockVideo();
    const handle2 = createMockVideo();

    await handle1.element.play();
    handle1.tick(10);

    expect(handle1.state.currentTime).toBe(10);
    expect(handle2.state.currentTime).toBe(0);
    expect(handle2.state.paused).toBe(true);
  });

  // Section 5 Invariants & Edge Cases
  it('tracks playCalls and pauseCalls accurately', async () => {
    const handle = createMockVideo();
    expect(handle.state.playCalls).toBe(0);
    expect(handle.state.pauseCalls).toBe(0);

    await handle.element.play();
    expect(handle.state.playCalls).toBe(1);

    handle.element.pause();
    expect(handle.state.pauseCalls).toBe(1);

    handle.rejectNextPlay();
    await handle.element.play().catch(() => {});
    expect(handle.state.playCalls).toBe(2);
  });

  it('accepts initial currentTime and paused state', () => {
    const handle = createMockVideo({ currentTime: 42, paused: false });
    expect(handle.state.currentTime).toBe(42);
    expect(handle.element.currentTime).toBe(42);
    expect(handle.state.paused).toBe(false);
    expect(handle.element.paused).toBe(false);
  });
});
