import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, act } from '@testing-library/react';
import { mockDocumentPictureInPicture, clearMockDocumentPictureInPicture } from '../../../core/tests/helpers/mockDocumentPictureInPicture';
import { clearRegistry } from '../../../core/src/registry';
import { installMockMoveBefore, type MoveBeforeController } from '../helpers/mockMoveBefore';
import { installMockAnimation, type AnimationController } from '../helpers/mockAnimation';
import { renderTeleport } from '../helpers/renderTeleport';
import { getGarage, __resetGarageCacheForTests, GARAGE_ATTR } from '../../src/garage';
import { GC_GRACE_MS } from '../../src/constants';

describe.each([
  { mode: 'plain', strictMode: false },
  { mode: 'StrictMode', strictMode: true },
])('Zero-remount and route-transition acceptance suite (TEST-804) [$mode]', ({ strictMode }) => {
  let moveBeforeCtrl: MoveBeforeController | null = null;
  let animCtrl: AnimationController | null = null;

  beforeEach(() => {
    mockDocumentPictureInPicture();
    moveBeforeCtrl = installMockMoveBefore();
    animCtrl = installMockAnimation();
  });

  afterEach(() => {
    moveBeforeCtrl?.restore();
    moveBeforeCtrl = null;
    animCtrl?.restore();
    animCtrl = null;
    clearMockDocumentPictureInPicture();
    clearRegistry();
    document.querySelectorAll('[data-pip-shuttle]').forEach((el) => el.remove());
    document.querySelectorAll(`[${GARAGE_ATTR}]`).forEach((el) => el.remove());
    __resetGarageCacheForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('dock, pop out, close', async () => {
    const harness = renderTeleport({ ids: ['v'], strictMode });
    const media = harness.media('v');

    // Initial state: mounted anchor, playhead at 0, detachedTicks 0, mount count 1
    expect(harness.mountCount('v')).toBe(1);
    expect(new Set(harness.portalContainers()).size).toBe(1);
    expect(media.state.detachedTicks).toBe(0);
    expect(media.state.currentTime).toBe(0);
    expect(harness.shuttle('v').parentElement).toBe(harness.anchorBox('v'));

    // Increment counter
    const incBtn = screen.getByTestId('inc-button-v');
    act(() => {
      incBtn.click();
    });
    expect(harness.shuttle('v').querySelector('[data-testid="counter-v"]')?.textContent).toBe('1');
    expect(harness.mountCount('v')).toBe(1);

    // Play and tick to checkpoint 15s
    await act(async () => {
      await media.element.play();
    });
    media.tick(15);
    expect(media.state.paused).toBe(false);
    expect(media.state.currentTime).toBe(15);
    expect(media.state.detachedTicks).toBe(0);
    expect(harness.mountCount('v')).toBe(1);
    expect(harness.shuttle('v').parentElement).toBe(harness.anchorBox('v'));

    // Open PiP
    await harness.open('v');
    const pipWin = harness.instance('v').getState().pipWindow;
    expect(pipWin).not.toBeNull();
    expect(harness.shuttle('v').parentElement).toBe(pipWin!.document.body);
    expect(harness.mountCount('v')).toBe(1);
    expect(new Set(harness.portalContainers()).size).toBe(1);
    expect(media.state.detachedTicks).toBe(0);
    expect(media.state.currentTime).toBeGreaterThanOrEqual(15);
    expect(harness.shuttle('v').querySelector('[data-testid="counter-v"]')?.textContent).toBe('1');

    // Tick 5s while in PiP
    media.tick(5);
    expect(media.state.currentTime).toBe(20);
    expect(media.state.detachedTicks).toBe(0);
    expect(harness.mountCount('v')).toBe(1);
    expect(harness.shuttle('v').parentElement).toBe(pipWin!.document.body);

    // Close via pagehide
    harness.closeViaPagehide('v');
    expect(harness.shuttle('v').parentElement).toBe(harness.anchorBox('v'));
    expect(harness.mountCount('v')).toBe(1);
    expect(new Set(harness.portalContainers()).size).toBe(1);
    expect(media.state.detachedTicks).toBe(0);
    expect(media.state.currentTime).toBe(20);
    expect(harness.shuttle('v').querySelector('[data-testid="counter-v"]')?.textContent).toBe('1');

    harness.unmountAll();
  });

  it('route change while docked', async () => {
    const harness = renderTeleport({ ids: ['v'], strictMode });
    const media = harness.media('v');

    // Initial step: mount A
    const anchorA = harness.anchorBox('v', 'a');
    expect(anchorA).not.toBeNull();
    expect(harness.shuttle('v').parentElement).toBe(anchorA);
    expect(harness.mountCount('v')).toBe(1);
    expect(media.state.detachedTicks).toBe(0);

    // Step 1: setAnchor(false) -> unmount anchor, parks in garage
    harness.setAnchor('v', false);
    expect(harness.anchorBox('v')).toBeNull();
    expect(harness.shuttle('v').parentElement).toBe(getGarage());
    expect(harness.mountCount('v')).toBe(1);
    expect(media.state.detachedTicks).toBe(0);

    // Step 2: mount B
    harness.setAnchorPair('v', 'b');
    const anchorB = harness.anchorBox('v', 'b');
    expect(anchorB).not.toBeNull();
    expect(harness.shuttle('v').parentElement).toBe(anchorB);
    expect(harness.mountCount('v')).toBe(1);
    expect(media.state.detachedTicks).toBe(0);

    harness.unmountAll();
  });

  it('route change while popped out', async () => {
    const harness = renderTeleport({ ids: ['v'], strictMode });
    const media = harness.media('v');

    // Initial step: mount A, open PiP
    expect(harness.shuttle('v').parentElement).toBe(harness.anchorBox('v', 'a'));
    await harness.open('v');
    const pipWin = harness.instance('v').getState().pipWindow;
    expect(pipWin).not.toBeNull();
    expect(harness.shuttle('v').parentElement).toBe(pipWin!.document.body);
    expect(harness.mountCount('v')).toBe(1);
    expect(media.state.detachedTicks).toBe(0);

    // Step 1: unmount anchor A while popped out -> stays in PiP document
    harness.setAnchor('v', false);
    expect(harness.anchorBox('v')).toBeNull();
    expect(harness.shuttle('v').parentElement).toBe(pipWin!.document.body);
    expect(harness.mountCount('v')).toBe(1);
    expect(media.state.detachedTicks).toBe(0);

    // Step 2: mount new anchor B while popped out -> stays in PiP document
    harness.setAnchorPair('v', 'b');
    const anchorB = harness.anchorBox('v', 'b');
    expect(anchorB).not.toBeNull();
    expect(harness.shuttle('v').parentElement).toBe(pipWin!.document.body);
    expect(harness.mountCount('v')).toBe(1);
    expect(media.state.detachedTicks).toBe(0);

    // Step 3: closeViaPagehide -> lands on new anchor B
    harness.closeViaPagehide('v');
    expect(harness.shuttle('v').parentElement).toBe(anchorB);
    expect(harness.mountCount('v')).toBe(1);
    expect(media.state.detachedTicks).toBe(0);

    harness.unmountAll();
  });

  it('handoff, mount B before unmount A', async () => {
    const harness = renderTeleport({ ids: ['v'], strictMode });
    const media = harness.media('v');

    // Initial step: anchor A mounted
    const anchorA = harness.anchorBox('v', 'a');
    expect(anchorA).not.toBeNull();
    expect(harness.shuttle('v').parentElement).toBe(anchorA);
    expect(harness.mountCount('v')).toBe(1);
    expect(media.state.detachedTicks).toBe(0);

    // Step 1: mount B while A is still mounted (both mounted) -> B claims and wins
    harness.setAnchorPair('v', 'both');
    const anchorB = harness.anchorBox('v', 'b');
    expect(anchorB).not.toBeNull();
    expect(harness.shuttle('v').parentElement).toBe(anchorB);
    expect(harness.mountCount('v')).toBe(1);
    expect(media.state.detachedTicks).toBe(0);

    // Step 2: unmount A, leaving only B -> shuttle stays on B
    harness.setAnchorPair('v', 'b');
    expect(harness.anchorBox('v', 'a')).toBeNull();
    expect(harness.shuttle('v').parentElement).toBe(anchorB);
    expect(harness.mountCount('v')).toBe(1);
    expect(media.state.detachedTicks).toBe(0);

    harness.unmountAll();
  });

  it('handoff, unmount A before mount B', async () => {
    const harness = renderTeleport({ ids: ['v'], strictMode });
    const media = harness.media('v');

    // Initial step: anchor A mounted
    expect(harness.shuttle('v').parentElement).toBe(harness.anchorBox('v', 'a'));
    expect(harness.mountCount('v')).toBe(1);

    // Step 1: unmount A (none mounted) -> parks in garage
    harness.setAnchorPair('v', 'none');
    expect(harness.anchorBox('v')).toBeNull();
    expect(harness.shuttle('v').parentElement).toBe(getGarage());
    expect(harness.mountCount('v')).toBe(1);
    expect(media.state.detachedTicks).toBe(0);

    // Step 2: mount B -> shuttle moves to B
    harness.setAnchorPair('v', 'b');
    const anchorB = harness.anchorBox('v', 'b');
    expect(anchorB).not.toBeNull();
    expect(harness.shuttle('v').parentElement).toBe(anchorB);
    expect(harness.mountCount('v')).toBe(1);
    expect(media.state.detachedTicks).toBe(0);

    harness.unmountAll();
  });

  it('dormant then reveal', async () => {
    const harness = renderTeleport({ ids: ['v'], strictMode });
    const media = harness.media('v');

    // Initial step: play video
    await act(async () => {
      await media.element.play();
    });
    media.tick(2);
    expect(media.state.paused).toBe(false);
    expect(media.state.currentTime).toBe(2);
    expect(harness.mountCount('v')).toBe(1);

    // Step 1: unmount the anchor (parks in garage) -> video paused while dormant
    harness.setAnchor('v', false);
    expect(harness.shuttle('v').parentElement).toBe(getGarage());
    expect(media.state.paused).toBe(true);
    expect(media.state.detachedTicks).toBe(0);
    expect(harness.mountCount('v')).toBe(1);

    // Step 2: tick 5 while dormant/paused -> playhead does not advance, detachedTicks stays 0
    media.tick(5);
    expect(media.state.currentTime).toBe(2);
    expect(media.state.detachedTicks).toBe(0);
    expect(harness.mountCount('v')).toBe(1);

    // Step 3: remount / reveal -> play called once on reveal, video resumes
    const initialPlayCalls = media.state.playCalls;
    harness.setAnchor('v', true);
    expect(harness.shuttle('v').parentElement).toBe(harness.anchorBox('v'));
    expect(media.state.paused).toBe(false);
    expect(media.state.playCalls).toBe(initialPlayCalls + 1);
    expect(media.state.detachedTicks).toBe(0);
    expect(harness.mountCount('v')).toBe(1);

    // Step 4: tick 3 while playing -> advances to 5
    media.tick(3);
    expect(media.state.currentTime).toBe(5);
    expect(media.state.detachedTicks).toBe(0);
    expect(harness.mountCount('v')).toBe(1);

    harness.unmountAll();
  });

  it('registry key removed and re-added inside the grace window', async () => {
    vi.useFakeTimers();
    try {
      const harness = renderTeleport({ ids: ['v'], strictMode });
      expect(harness.instance('v').destroyed).toBe(false);
      expect(harness.mountCount('v')).toBe(1);

      // Step 1: setRegistryKey(false)
      harness.setRegistryKey('v', false);
      expect(harness.instance('v').destroyed).toBe(false);
      expect(harness.mountCount('v')).toBe(1);

      // Step 2: advance 10000ms (< 30000ms GC_GRACE_MS)
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      expect(harness.instance('v').destroyed).toBe(false);
      expect(harness.mountCount('v')).toBe(1);

      // Step 3: setRegistryKey(true) -> instance preserved, mount count 1
      harness.setRegistryKey('v', true);
      expect(harness.instance('v').destroyed).toBe(false);
      expect(harness.mountCount('v')).toBe(1);

      harness.unmountAll();
    } finally {
      vi.useRealTimers();
    }
  });

  it('registry key removed past the grace window', async () => {
    vi.useFakeTimers();
    try {
      const harness = renderTeleport({ ids: ['v'], strictMode });
      const oldInst = harness.instance('v');
      expect(oldInst.destroyed).toBe(false);
      expect(harness.mountCount('v')).toBe(1);

      // Unmount anchor and remove registry key
      harness.setAnchor('v', false);
      harness.setRegistryKey('v', false);
      expect(oldInst.destroyed).toBe(false);

      // Advance GC_GRACE_MS (30000ms)
      act(() => {
        vi.advanceTimersByTime(GC_GRACE_MS);
      });
      expect(oldInst.destroyed).toBe(true);
      expect(document.querySelector('[data-pip-shuttle="v"]')).toBeNull();

      // Re-add key -> creates a NEW entry with mount count 1
      harness.setRegistryKey('v', true);
      harness.setAnchor('v', true);
      const newInst = harness.instance('v');
      expect(newInst).not.toBe(oldInst);
      expect(newInst.destroyed).toBe(false);
      expect(harness.mountCount('v')).toBe(1);
      expect(harness.shuttle('v').parentElement).toBe(harness.anchorBox('v'));

      harness.unmountAll();
    } finally {
      vi.useRealTimers();
    }
  });

  it('close via pagehide with no anchor', async () => {
    const harness = renderTeleport({ ids: ['v'], strictMode });
    const media = harness.media('v');

    // Step 1: open PiP
    await harness.open('v');
    const pipWin = harness.instance('v').getState().pipWindow;
    expect(pipWin).not.toBeNull();
    expect(harness.shuttle('v').parentElement).toBe(pipWin!.document.body);
    expect(harness.mountCount('v')).toBe(1);

    // Step 2: unmount anchor while open
    harness.setAnchor('v', false);
    expect(harness.anchorBox('v')).toBeNull();
    expect(harness.shuttle('v').parentElement).toBe(pipWin!.document.body);
    expect(harness.mountCount('v')).toBe(1);

    // Step 3: closeViaPagehide -> shuttle in garage synchronously
    harness.closeViaPagehide('v');
    expect(harness.shuttle('v').parentElement).toBe(getGarage());
    expect(harness.mountCount('v')).toBe(1);
    expect(media.state.detachedTicks).toBe(0);

    harness.unmountAll();
  });

  it('two ids are independent', async () => {
    const harness = renderTeleport({ ids: ['a', 'b'], strictMode });
    const mediaB = harness.media('b');

    // Play B to 10s
    await act(async () => {
      await mediaB.element.play();
    });
    mediaB.tick(10);
    expect(mediaB.state.currentTime).toBe(10);
    expect(mediaB.state.paused).toBe(false);

    // Transition A: open PiP for A
    await harness.open('a');
    const pipWinA = harness.instance('a').getState().pipWindow;
    expect(harness.shuttle('a').parentElement).toBe(pipWinA!.document.body);

    // Assert B is completely unchanged
    expect(harness.shuttle('b').parentElement).toBe(harness.anchorBox('b'));
    expect(harness.mountCount('b')).toBe(1);
    expect(mediaB.state.currentTime).toBe(10);
    expect(mediaB.state.paused).toBe(false);
    expect(mediaB.state.detachedTicks).toBe(0);

    // Unmount anchor A
    harness.setAnchor('a', false);
    expect(harness.shuttle('b').parentElement).toBe(harness.anchorBox('b'));
    expect(harness.mountCount('b')).toBe(1);

    // Close A
    harness.closeViaPagehide('a');
    expect(harness.shuttle('a').parentElement).toBe(getGarage());
    expect(harness.shuttle('b').parentElement).toBe(harness.anchorBox('b'));
    expect(harness.mountCount('b')).toBe(1);
    expect(mediaB.state.currentTime).toBe(10);
    expect(mediaB.state.paused).toBe(false);
    expect(mediaB.state.detachedTicks).toBe(0);

    harness.unmountAll();
  });

  it('rapid open and close', async () => {
    const harness = renderTeleport({ ids: ['v'], strictMode });
    const media = harness.media('v');

    // First open
    await harness.open('v');
    const pipWin1 = harness.instance('v').getState().pipWindow;
    expect(harness.shuttle('v').parentElement).toBe(pipWin1!.document.body);
    expect(harness.mountCount('v')).toBe(1);
    expect(media.state.detachedTicks).toBe(0);

    // First close
    harness.closeViaPagehide('v');
    expect(harness.shuttle('v').parentElement).toBe(harness.anchorBox('v'));
    expect(harness.mountCount('v')).toBe(1);
    expect(media.state.detachedTicks).toBe(0);

    // Second open
    await harness.open('v');
    const pipWin2 = harness.instance('v').getState().pipWindow;
    expect(harness.shuttle('v').parentElement).toBe(pipWin2!.document.body);
    expect(harness.mountCount('v')).toBe(1);
    expect(media.state.detachedTicks).toBe(0);

    // Second close
    harness.closeViaPagehide('v');
    expect(harness.shuttle('v').parentElement).toBe(harness.anchorBox('v'));
    expect(harness.mountCount('v')).toBe(1);
    expect(media.state.detachedTicks).toBe(0);

    harness.unmountAll();
  });

  it('failed open leaves the content docked', async () => {
    mockDocumentPictureInPicture({ rejectWithNotAllowed: true });
    const harness = renderTeleport({ ids: ['v'], strictMode });
    const media = harness.media('v');

    expect(harness.shuttle('v').parentElement).toBe(harness.anchorBox('v'));
    expect(harness.mountCount('v')).toBe(1);

    // Attempt open - should reject with NotAllowedError without unhandled rejection
    let caughtErr: Error | null = null;
    try {
      await harness.open('v');
    } catch (err) {
      caughtErr = err as Error;
    }
    expect(caughtErr).not.toBeNull();
    expect(caughtErr?.name).toBe('NotAllowedError');

    // Shuttle still docked to anchor, mount count 1, instance isOpen is false
    expect(harness.shuttle('v').parentElement).toBe(harness.anchorBox('v'));
    expect(harness.mountCount('v')).toBe(1);
    expect(harness.instance('v').isOpen()).toBe(false);
    expect(media.state.detachedTicks).toBe(0);

    harness.unmountAll();
  });
});
