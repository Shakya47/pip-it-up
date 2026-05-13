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
      KeyboardEvent: class MockKeyboardEvent extends KeyboardEvent {}
    };

    const cleanup = startKeyboardBridge(pipWin, openerWin);
    expect(pipWin.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));

    const handler = pipWin.addEventListener.mock.calls[0][1];
    
    handler(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(dispatchSpy).toHaveBeenCalled();
    const dispatchedEvent = dispatchSpy.mock.calls[0][0] as KeyboardEvent;
    expect(dispatchedEvent.key).toBe('Escape');

    cleanup();
  });
});
