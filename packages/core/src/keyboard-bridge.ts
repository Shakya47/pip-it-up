export const startKeyboardBridge = (pipWindow: Window, openerWindow: Window = window) => {
  const handleKey = (e: KeyboardEvent) => {
    // Security: only forward real user-initiated keystrokes.
    // Synthetic events created via dispatchEvent() have isTrusted === false
    // and are ignored to prevent spoofed keystroke escalation from PiP-side scripts.
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

  pipWindow.addEventListener('keydown', handleKey);
  pipWindow.addEventListener('keyup', handleKey);

  return () => {
    pipWindow.removeEventListener('keydown', handleKey);
    pipWindow.removeEventListener('keyup', handleKey);
  };
};
