/**
 * Bridges real keystrokes from the PiP window to the opener.
 *
 * Security: only forward user-initiated keystrokes. Synthetic events created via
 * dispatchEvent() have isTrusted === false and are ignored, which eliminates spoofed
 * keystroke escalation from any script running in the PiP window.
 *
 * ECHO-LOOP INVARIANT (load-bearing, must survive refactors): the clone this function
 * dispatches on the opener has isTrusted === false by construction. If a future change ever
 * bridges opener -> PiP as well, the isTrusted guard makes an infinite echo impossible.
 * Removing the guard would therefore introduce both a spoofing vector AND an event storm.
 *
 * Privacy: see PipOptions.forwardKeyboardEvents. Every forwarded keystroke is observable by
 * any opener-side window listener.
 */
export const startKeyboardBridge = (
  pipWindow: Window,
  openerWindow: Window = window,
  signal?: AbortSignal,
) => {
  const handleKey = (e: KeyboardEvent) => {
    if (!e.isTrusted) return;

    const init: KeyboardEventInit = {
      key: e.key,
      code: e.code,
      location: e.location,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      repeat: e.repeat,
      isComposing: e.isComposing,
      bubbles: true,
      cancelable: true,
      composed: true,
    };
    
    const cloneEvent = new KeyboardEvent(e.type, init);
    Object.defineProperties(cloneEvent, {
      keyCode: { get: () => e.keyCode },
      charCode: { get: () => e.charCode },
      which: { get: () => e.which },
    });

    const canceled = !openerWindow.dispatchEvent(cloneEvent);
    if (canceled) {
      e.preventDefault();
    }
  };

  const signalOptions = signal ? [{ signal }] : [];
  pipWindow.addEventListener('keydown', handleKey, ...signalOptions);
  pipWindow.addEventListener('keyup', handleKey, ...signalOptions);

  return () => {
    pipWindow.removeEventListener('keydown', handleKey);
    pipWindow.removeEventListener('keyup', handleKey);
  };
};
