/**
 * React event bridge for content MOVED into a PiP window (usePip / core move mode).
 *
 * React delegates events: it listens on its root container (and on each portal container), not on
 * the elements. A node moved into the PiP document is outside every container, so its onClick,
 * onChange… never run there. `<PipWrapper>` avoids this by portalling; `usePip()` moves the real
 * node, so it bridges instead:
 *
 *  - listen on the PiP document (bubble phase) for the events React delegates;
 *  - for an event from inside the content, find the container React would have heard it on (the
 *    nearest HostRoot or HostPortal above the target's fiber), and dispatch a non-bubbling copy AT
 *    that container, with `target` pointing at the real target so React resolves the right fiber;
 *  - copy `preventDefault()` / `stopPropagation()` back to the original event.
 *
 * What page code can observe (documented in the README):
 *  - The copy is dispatched in the main document, so it still runs the CAPTURE phase of every
 *    ancestor of the container: `window` / `document` capture listeners see it (a keydown there
 *    fires twice with the core keyboard bridge on: core's clone and this copy; a `focusin` focus
 *    trap sees a target outside its document). Copies carry the non-enumerable `pipItUpBridged:
 *    true` marker, like core's pointer bridge, so such listeners can ignore them. Key events are
 *    still bridged: React's onKeyDown inside the content needs them, and core's clone never
 *    reaches the content's handlers.
 *  - Only listeners on the container itself (React's, and any others there) run for the bubble
 *    part; nothing above it. A React stopPropagation() stops the copy immediately, so other
 *    listeners on the container after React's are skipped too.
 *  - The bridge listens after the event reached the PiP document, so React's handlers (capture ones
 *    included) run after every native listener inside the content, and not at all if one of those
 *    stops propagation.
 *  - A React root created INSIDE the content (a nested createRoot) hears its events natively; the
 *    outer root's handlers above it don't run for them.
 *  - Target-relative fields (`offsetX/Y`, `layerX/Y`, `pageX/Y`) and `composedPath()`,
 *    `getCoalescedEvents()`, `getPredictedEvents()` read from the original event.
 *
 * React listens directly on the element for non-bubbling events (media, scroll, load…), so those
 * already work and are not bridged. Not covered: `selectionchange`, which React hears on its root's
 * own document, so `onSelect` misses selection changes made only with the keyboard. Relies on React's
 * DOM-node fiber key (`__reactFiber$…`) and the HostRoot / HostPortal tags, which are stable since
 * React 17.
 */

// One string, split once: the same list with fewer bytes than an array literal.
// (`textInput`: Chrome's legacy TextEvent; React builds onBeforeInput from it there.)
const DELEGATED_EVENTS = (
  'click auxclick contextmenu dblclick ' +
  'mousedown mouseup mousemove mouseover mouseout ' +
  'pointerdown pointerup pointermove pointerover pointerout pointercancel ' +
  'gotpointercapture lostpointercapture ' +
  'touchstart touchmove touchend touchcancel ' +
  'keydown keyup keypress ' +
  'input change beforeinput compositionstart compositionupdate compositionend ' +
  'focusin focusout submit reset wheel ' +
  'dragstart drag dragend dragenter dragleave dragover drop ' +
  'copy cut paste select ' +
  'animationstart animationend animationiteration ' +
  'transitionrun transitionstart transitionend transitioncancel ' +
  'textInput'
).split(' ');

const HOST_ROOT = 3;
const HOST_PORTAL = 4;

interface Fiber {
  tag: number;
  return: Fiber | null;
  stateNode: { containerInfo?: Node } | null;
}

/** The container React listens on for `node`: its nearest root or portal container. */
function reactContainerOf(node: Node): Node | null {
  let el: Node | null = node;
  let fiber: Fiber | undefined;
  // Text nodes and non-React descendants have no fiber: use the closest ancestor that has one.
  while (el && !fiber) {
    const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
    fiber = key ? (el as unknown as Record<string, Fiber>)[key] : undefined;
    el = el.parentNode;
  }
  for (let f: Fiber | null = fiber ?? null; f; f = f.return) {
    if (f.tag === HOST_ROOT || f.tag === HOST_PORTAL) return f.stateNode?.containerInfo ?? null;
  }
  return null;
}

/** Target-relative fields read from the original event instead of being recomputed on the copy. */
const DELEGATED_FIELDS = ['offsetX', 'offsetY', 'layerX', 'layerY', 'pageX', 'pageY'] as const;
/** Methods whose result depends on the original dispatch. */
const DELEGATED_METHODS = ['composedPath', 'getCoalescedEvents', 'getPredictedEvents'] as const;

/** Same marker as core's pointer bridge: page listeners can skip events the library dispatched. */
const markBridged = (event: Event): void => {
  // defineProperty's defaults: non-enumerable, read-only, non-configurable.
  Object.defineProperty(event, 'pipItUpBridged', { value: true });
};

/** A non-bubbling copy of `event` whose `target` is the original target. */
function copyOf(event: Event): Event {
  const init: Record<string, unknown> = {};
  // WebIDL attributes are enumerable prototype getters, so for…in picks up clientX, key, data…
  for (const k in event) init[k] = (event as unknown as Record<string, unknown>)[k];
  init.bubbles = false;
  init.composed = false;
  const Ctor = event.constructor as new (type: string, init: object) => Event;
  let copy: Event;
  try {
    copy = new Ctor(event.type, init);
  } catch {
    // No constructor (TextEvent): a plain Event carrying the original's fields (data, …).
    copy = new Event(event.type, { cancelable: event.cancelable });
    for (const k of Object.keys(init)) {
      if (!(k in copy)) Object.defineProperty(copy, k, { value: init[k], configurable: true });
    }
  }
  const target = event.target;
  Object.defineProperty(copy, 'target', { get: () => target });
  Object.defineProperty(copy, 'srcElement', { get: () => target });
  // The browser computes these against the node the copy is dispatched at (the container) and its
  // document; the original has the right values.
  const source = event as unknown as Record<string, unknown>;
  for (const k of DELEGATED_FIELDS) {
    if (k in event) Object.defineProperty(copy, k, { get: () => source[k] });
  }
  for (const k of DELEGATED_METHODS) {
    const fn = source[k];
    if (typeof fn === 'function') Object.defineProperty(copy, k, { value: () => fn.call(event) });
  }
  markBridged(copy);
  return copy;
}

/**
 * Run the React handlers of `content` (moved into `pipDocument`) for events that happen there.
 * Returns the disposer.
 */
export function bridgeReactEvents(pipDocument: Document, content: HTMLElement): () => void {
  const onEvent = (event: Event) => {
    const target = event.target as Node | null;
    if (!target || !content.contains(target)) return;
    const container = reactContainerOf(target);
    // Already inside a React container in this document (a portal): React hears it itself.
    if (!container || container.ownerDocument === pipDocument || container === pipDocument) return;
    const copy = copyOf(event);
    // The stop-propagation flag (cancelBubble) is cleared when a dispatch ends, so record the calls.
    // The copy is dispatched AT the container, where React's capture and bubble listeners sit side
    // by side: a plain stopPropagation() wouldn't keep the bubble listener from running, so a stop
    // from onClickCapture would still reach onClick. Stop the copy immediately instead.
    // 0 = not stopped, 1 = stopPropagation(), 2 = stopImmediatePropagation().
    let stopped = 0;
    const stopHere = Event.prototype.stopImmediatePropagation;
    copy.stopPropagation = () => {
      stopped ||= 1;
      stopHere.call(copy);
    };
    copy.stopImmediatePropagation = () => {
      stopped = 2;
      stopHere.call(copy);
    };
    container.dispatchEvent(copy);
    if (copy.defaultPrevented) event.preventDefault();
    if (stopped === 2) event.stopImmediatePropagation();
    else if (stopped) event.stopPropagation();
  };
  for (const type of DELEGATED_EVENTS) pipDocument.addEventListener(type, onEvent);
  return () => {
    for (const type of DELEGATED_EVENTS) pipDocument.removeEventListener(type, onEvent);
  };
}
