export const startKeyboardBridge = (pipWindow: Window, openerWindow: Window = window) => {
  const handleKey = (e: KeyboardEvent) => {
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
    // Deprecated properties that some libraries still rely on
    Object.defineProperties(cloneEvent, {
      keyCode: { get: () => e.keyCode },
      charCode: { get: () => e.charCode },
      which: { get: () => e.which },
    });

    const canceled = !openerWindow.document.dispatchEvent(cloneEvent);
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
