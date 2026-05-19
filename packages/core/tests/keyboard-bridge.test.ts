import { describe, it, expect, vi } from 'vitest';
import { startKeyboardBridge } from '../src/keyboard-bridge';

/**
 * Helper: creates a plain object that satisfies the KeyboardEvent interface
 * with a controllable `isTrusted` value.
 *
 * In jsdom, `isTrusted` is a non-configurable getter on Event.prototype, and
 * KeyboardEvent getters perform internal-slot checks that reject Object.create()
 * proxies. So we use a plain object with explicit property values instead.
 */
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

describe('keyboard-bridge', () => {
  it('dispatches synthesized event to opener for trusted input', () => {
    const pipWin: any = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const openerDoc = document.createElement('div');
    const dispatchSpy = vi.spyOn(openerDoc, 'dispatchEvent');

    const openerWin: any = {
      document: openerDoc,
      dispatchEvent: vi.fn(() => true),
      KeyboardEvent: class MockKeyboardEvent extends KeyboardEvent { }
    };

    const cleanup = startKeyboardBridge(pipWin, openerWin);
    expect(pipWin.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));

    const handler = pipWin.addEventListener.mock.calls[0][1];

    const eventToDispatch = createFakeKeyboardEvent('keydown', {
      key: 'Escape',
      isTrusted: true,
    });
    // Override legacy properties for this specific test
    (eventToDispatch as any).keyCode = 27;
    (eventToDispatch as any).charCode = 0;
    (eventToDispatch as any).which = 27;

    handler(eventToDispatch);

    expect(openerWin.dispatchEvent).toHaveBeenCalled();
    const dispatchedEvent = openerWin.dispatchEvent.mock.calls[0][0] as KeyboardEvent;
    expect(dispatchedEvent.key).toBe('Escape');
    expect(dispatchedEvent.keyCode).toBe(27);
    expect(dispatchedEvent.charCode).toBe(0);
    expect(dispatchedEvent.which).toBe(27);

    expect(dispatchSpy).not.toHaveBeenCalled();

    cleanup();
  });

  it('calls preventDefault on PiP event when opener event is canceled', () => {
    const pipWin: any = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const openerWin: any = {
      document: document.createElement('div'),
      dispatchEvent: vi.fn(() => false),
    };

    startKeyboardBridge(pipWin, openerWin);
    const handler = pipWin.addEventListener.mock.calls[0][1];

    const pipEvent = createFakeKeyboardEvent('keydown', {
      key: 'Escape',
      cancelable: true,
      isTrusted: true,
    });

    handler(pipEvent);

    expect(pipEvent.preventDefault).toHaveBeenCalled();
  });

  describe('isTrusted security filter', () => {
    it('should NOT forward synthetic (untrusted) keyboard events from PiP window', () => {
      const pipWin: any = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      const openerWin: any = {
        document: document.createElement('div'),
        dispatchEvent: vi.fn(() => true),
      };

      startKeyboardBridge(pipWin, openerWin);
      const handler = pipWin.addEventListener.mock.calls[0][1];

      // Create a synthetic event — isTrusted defaults to false,
      // which matches what dispatchEvent() produces in a real browser.
      const syntheticEvent = createFakeKeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
        bubbles: true,
        isTrusted: false,
      });

      handler(syntheticEvent);

      expect(openerWin.dispatchEvent).not.toHaveBeenCalled();
    });

    it('should forward trusted (real user) keyboard events from PiP window', () => {
      const pipWin: any = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      const openerWin: any = {
        document: document.createElement('div'),
        dispatchEvent: vi.fn(() => true),
      };

      startKeyboardBridge(pipWin, openerWin);
      const handler = pipWin.addEventListener.mock.calls[0][1];

      // Simulate real user input via our fake helper.
      // In a real browser, only hardware-initiated events have isTrusted === true.
      // jsdom cannot produce isTrusted: true events, so we use a plain mock object.
      const trustedEvent = createFakeKeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
        bubbles: true,
        isTrusted: true,
      });

      handler(trustedEvent);

      expect(openerWin.dispatchEvent).toHaveBeenCalled();
      const forwarded = openerWin.dispatchEvent.mock.calls[0][0] as KeyboardEvent;
      expect(forwarded.key).toBe('Enter');
      expect(forwarded.ctrlKey).toBe(true);
    });
  });
});
