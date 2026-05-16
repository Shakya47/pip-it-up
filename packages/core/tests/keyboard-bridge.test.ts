import { describe, it, expect, vi } from 'vitest';
import { startKeyboardBridge } from '../src/keyboard-bridge';

describe('keyboard-bridge', () => {
  it('dispatches synthesized event to opener', () => {
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

    handler(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(openerWin.dispatchEvent).toHaveBeenCalled();
    const dispatchedEvent = openerWin.dispatchEvent.mock.calls[0][0] as KeyboardEvent;
    expect(dispatchedEvent.key).toBe('Escape');

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

    const pipEvent = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    const preventSpy = vi.spyOn(pipEvent, 'preventDefault');

    handler(pipEvent);

    expect(preventSpy).toHaveBeenCalled();
  });
});
