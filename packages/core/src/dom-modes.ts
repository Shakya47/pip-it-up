import { isUsable } from './elements';

export interface MoveModeDeps {
  /**
   * Resolved at CLOSE time, not at open time. Returns the current restore parent, which may be
   * a node that did not exist when the PiP window opened.
   */
  getOriginEl: () => HTMLElement | undefined;
  /** When true, freeze the origin's box and the content's box while the content is away. */
  reserveSpace: boolean;
  /**
   * Fallback parent when `getOriginEl()` returns nothing usable at close time. Supplied by the
   * caller so `@pip-it-up/core` never depends on the React garage module.
   * When omitted, unusable-origin teardown leaves `contentEl` in the PiP document and logs a warning.
   */
  getFallbackParent?: () => HTMLElement | undefined;
}

export const applyMoveMode = (
  pipWindow: Window,
  contentEl: HTMLElement,
  deps: MoveModeDeps,
): (() => void) => {
  const { getOriginEl, reserveSpace, getFallbackParent } = deps;

  // Reservation writes inline sizes on the origin and the content while the content is away. The
  // values that were there before are saved and put back on close, so an inline size the app set
  // itself survives the round trip (it used to be reset to '', and the next open measured a
  // different box). Restored on the SAME origin element that was written to.
  const ORIGIN_PROPS = ['minWidth', 'minHeight', 'width', 'height'] as const;
  const CONTENT_PROPS = ['width', 'height'] as const;
  let reservedOrigin: HTMLElement | undefined;
  let savedOrigin: Record<string, string> = {};
  let savedContent: Record<string, string> = {};

  if (reserveSpace) {
    const rect = contentEl.getBoundingClientRect();
    let origin: HTMLElement | undefined;
    try {
      origin = getOriginEl();
    } catch {
      origin = undefined;
    }
    if (isUsable(origin)) {
      reservedOrigin = origin;
      savedOrigin = Object.fromEntries(ORIGIN_PROPS.map((p) => [p, origin!.style[p]]));
      origin.style.minWidth = `${rect.width}px`;
      origin.style.minHeight = `${rect.height}px`;
      origin.style.width = `${rect.width}px`;
      origin.style.height = `${rect.height}px`;
    }
    savedContent = Object.fromEntries(CONTENT_PROPS.map((p) => [p, contentEl.style[p]]));
    contentEl.style.width = `${rect.width}px`;
    contentEl.style.height = `${rect.height}px`;
  }

  pipWindow.document.body.appendChild(contentEl);

  return () => {
    let origin: HTMLElement | undefined;
    try {
      origin = getOriginEl();
    } catch {
      origin = undefined;
    }

    if (reserveSpace) {
      if (reservedOrigin && isUsable(reservedOrigin)) {
        for (const p of ORIGIN_PROPS) reservedOrigin.style[p] = savedOrigin[p] ?? '';
      }
      for (const p of CONTENT_PROPS) contentEl.style[p] = savedContent[p] ?? '';
    }

    if (isUsable(origin)) {
      origin.appendChild(contentEl);
      return;
    }

    let fallback: HTMLElement | undefined;
    try {
      fallback = getFallbackParent?.();
    } catch {
      fallback = undefined;
    }
    if (isUsable(fallback)) {
      fallback.appendChild(contentEl);
      return;
    }

    console.warn('[pip-it-up] No usable restore target for move mode; content remains in the PiP document.');
    return;
  };
};

/**
 * Clones `contentEl` into the PiP window using `cloneNode(true)`.
 *
 * Shallow-clone semantics to be aware of:
 * - Event listeners added via `addEventListener` are not cloned.
 * - Inline event handlers (onclick, onmouseover) are cloned and execute in the PiP window.
 * - Internal state of form elements is not preserved in the clone.
 * - script tags are cloned but do not re-execute.
 *
 * Note: Clone mode is only available via the vanilla `createPip()` API.
 * The React `<PipWrapper>` always uses portal mode internally.
 */
export const applyCloneMode = (pipWindow: Window, contentEl: HTMLElement) => {
  const clone = contentEl.cloneNode(true);
  pipWindow.document.body.appendChild(clone);
  return () => { clone.parentNode?.removeChild(clone); };
};
