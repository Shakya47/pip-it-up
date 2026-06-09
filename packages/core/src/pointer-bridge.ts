export const startPointerBridge = (pipWindow: Window, openerWindow: Window = window) => {
  if (!pipWindow || !pipWindow.document || typeof pipWindow.document.addEventListener !== 'function') {
    return () => {};
  }

  const handlePointerEvent = (event: Event) => {
    const e = event as PointerEvent;
    // Security: only forward real user-initiated events.
    if (!e.isTrusted) return;

    const init: PointerEventInit = {
      pointerId: e.pointerId,
      width: e.width,
      height: e.height,
      pressure: e.pressure,
      tangentialPressure: e.tangentialPressure,
      tiltX: e.tiltX,
      tiltY: e.tiltY,
      twist: e.twist,
      pointerType: e.pointerType,
      isPrimary: e.isPrimary,
      screenX: e.screenX,
      screenY: e.screenY,
      clientX: e.clientX,
      clientY: e.clientY,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      button: e.button,
      buttons: e.buttons,
      bubbles: true,
      cancelable: true,
      composed: true,
    };

    const cloneEvent = new PointerEvent(e.type, init);
    const target = openerWindow.document.body || openerWindow.document;
    target.dispatchEvent(cloneEvent);
  };

  const handleMouseEvent = (event: Event) => {
    const e = event as MouseEvent;
    if (!e.isTrusted) return;
    // PointerEvent inherits from MouseEvent, so if PointerEvent is supported
    // we only bridge PointerEvent to avoid duplicate dispatching.
    if (typeof PointerEvent !== 'undefined' && e instanceof PointerEvent) return;

    const init: MouseEventInit = {
      screenX: e.screenX,
      screenY: e.screenY,
      clientX: e.clientX,
      clientY: e.clientY,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      button: e.button,
      buttons: e.buttons,
      bubbles: true,
      cancelable: true,
      composed: true,
    };

    const cloneEvent = new MouseEvent(e.type, init);
    const target = openerWindow.document.body || openerWindow.document;
    target.dispatchEvent(cloneEvent);
  };

  const pointerEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'];
  const mouseEvents = ['mousedown', 'mousemove', 'mouseup', 'click'];

  pointerEvents.forEach((type) => {
    pipWindow.document.addEventListener(type, handlePointerEvent, { capture: true, passive: true });
  });

  mouseEvents.forEach((type) => {
    pipWindow.document.addEventListener(type, handleMouseEvent, { capture: true, passive: true });
  });

  return () => {
    pointerEvents.forEach((type) => {
      pipWindow.document.removeEventListener(type, handlePointerEvent, { capture: true });
    });
    mouseEvents.forEach((type) => {
      pipWindow.document.removeEventListener(type, handleMouseEvent, { capture: true });
    });
  };
};
