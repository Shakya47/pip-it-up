const markBridged = (event: Event): void => {
  Object.defineProperty(event, 'pipItUpBridged', {
    value: true,
    enumerable: false,
    writable: false,
    configurable: false,
  });
};

/**
 * Bridges real pointer and mouse events from the PiP window to the opener.
 *
 * Non-enumerable marker stamped on every event this bridge dispatches, so opener-side
 * handlers can identify and ignore bridged input:
 *
 *   window.addEventListener('pointerdown', (e) => { // pass signal if desired
 *     if ((e as PointerEvent & { pipItUpBridged?: boolean }).pipItUpBridged) return;
 *     // ...opener-only logic
 *   });
 *
 * Non-enumerable so it cannot break consumer code that spreads or serialises the event.
 */
const MOUSE_FIELDS = [
  'screenX', 'screenY', 'clientX', 'clientY',
  'ctrlKey', 'shiftKey', 'altKey', 'metaKey', 'button', 'buttons',
] as const;
const POINTER_FIELDS = [
  'pointerId', 'width', 'height', 'pressure', 'tangentialPressure',
  'tiltX', 'tiltY', 'twist', 'pointerType', 'isPrimary',
  ...MOUSE_FIELDS,
] as const;

export const startPointerBridge = (
  pipWindow: Window,
  openerWindow: Window = window,
  signal?: AbortSignal,
) => {
  if (!pipWindow || !pipWindow.document || typeof pipWindow.document.addEventListener !== 'function') {
    return () => {};
  }

  // The fields each copy carries over (plus bubbles / cancelable / composed).
  const initFrom = (e: MouseEvent, fields: readonly string[]) => {
    const init: Record<string, unknown> = { bubbles: true, cancelable: true, composed: true };
    for (const k of fields) init[k] = (e as unknown as Record<string, unknown>)[k];
    return init;
  };
  const forward = (cloneEvent: Event) => {
    markBridged(cloneEvent);
    const target = openerWindow.document.body || openerWindow.document;
    target.dispatchEvent(cloneEvent);
  };

  const handlePointerEvent = (event: Event) => {
    const e = event as PointerEvent;
    // Security: only forward real user-initiated events.
    if (!e.isTrusted) return;
    forward(new PointerEvent(e.type, initFrom(e, POINTER_FIELDS) as PointerEventInit));
  };

  const handleMouseEvent = (event: Event) => {
    const e = event as MouseEvent;
    if (!e.isTrusted) return;
    // PointerEvent inherits from MouseEvent, so if PointerEvent is supported
    // we only bridge PointerEvent to avoid duplicate dispatching.
    if (typeof PointerEvent !== 'undefined' && e instanceof PointerEvent) return;
    forward(new MouseEvent(e.type, initFrom(e, MOUSE_FIELDS) as MouseEventInit));
  };

  const pointerEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'];
  const mouseEvents = ['mousedown', 'mousemove', 'mouseup', 'click'];

  pointerEvents.forEach((type) => {
    pipWindow.document.addEventListener(type, handlePointerEvent, { capture: true, passive: true, signal });
  });

  mouseEvents.forEach((type) => {
    pipWindow.document.addEventListener(type, handleMouseEvent, { capture: true, passive: true, signal });
  });

  return () => {
    // Leak vector L12: removeEventListener MUST pass { capture: true} to match registration, or all eight listeners stay installed.
    pointerEvents.forEach((type) => {
      pipWindow.document.removeEventListener(type, handlePointerEvent, { capture: true });
    });
    mouseEvents.forEach((type) => {
      pipWindow.document.removeEventListener(type, handleMouseEvent, { capture: true });
    });
  };
};
