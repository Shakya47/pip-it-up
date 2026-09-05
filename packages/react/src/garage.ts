import { PipError } from './errors';

/** Attribute marking the singleton garage element. */
export const GARAGE_ATTR = 'data-pip-garage';

let garage: HTMLDivElement | null = null;

/** Minimal structural type for the `moveBefore` API, absent from older `lib.dom.d.ts`. */
interface MoveBeforeCapable {
  moveBefore(node: Node, referenceChild: Node | null): void;
}

/**
 * Returns the singleton hidden garage attached to `document.body`, creating it on first call.
 * Adopts an existing `[data-pip-garage]` element when one is present, so two providers or a
 * hot-module reload share one garage instead of orphaning parked shuttles.
 * Must only be called on the client; callers gate with a hydration flag or a layout effect.
 */
export function getGarage(): HTMLDivElement {
  if (garage && garage.isConnected) return garage;
  const existing = document.querySelector<HTMLDivElement>(`div[${GARAGE_ATTR}]`);
  if (existing) {
    garage = existing;
    return existing;
  }
  const el = document.createElement('div');
  el.setAttribute(GARAGE_ATTR, '');
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('inert', '');
  el.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;overflow:hidden;pointer-events:none;content-visibility:hidden;contain-intrinsic-size:0 0;';
  document.body.appendChild(el);
  garage = el;
  return el;
}

/**
 * Moves `node` to be the last child of `target`, choosing the state-preserving primitive.
 *
 * Same document  -> `moveBefore()` when available: a state-preserving move that does NOT run
 *                   the removing steps, so media does not pause, iframes do not reload, CSS
 *                   animations do not restart, and focus/popover state survives.
 * Cross document -> `appendChild()`: DOM's pre-insert algorithm adopts the node into the target
 *                   document as part of the insertion itself, so the node is never observably
 *                   unattached.
 *
 * No-ops when `node` is already the last child of `target`.
 * @throws PipError('ERR_SHUTTLE_MOVE_FAILED') when both primitives fail.
 */
export function moveHost(node: HTMLElement, target: HTMLElement): void {
  if (node.parentNode === target && target.lastChild === node) return;
  const sameDocument = node.ownerDocument === target.ownerDocument;
  if (
    sameDocument &&
    node.isConnected &&
    typeof (target as unknown as MoveBeforeCapable).moveBefore === 'function'
  ) {
    try {
      (target as unknown as MoveBeforeCapable).moveBefore(node, null);
      return;
    } catch {
      /* fall through */
    }
  }
  try {
    target.appendChild(node);
  } catch (err) {
    throw new PipError(
      'ERR_SHUTTLE_MOVE_FAILED',
      `Could not move node into target: ${(err as Error).message}`
    );
  }
}

/** Test-only: drops the cached garage reference. Does NOT remove the element from the DOM. */
export function __resetGarageCacheForTests(): void {
  garage = null;
}
