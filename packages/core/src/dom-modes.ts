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

  if (reserveSpace) {
    const rect = contentEl.getBoundingClientRect();
    let origin: HTMLElement | undefined;
    try {
      origin = getOriginEl();
    } catch {
      origin = undefined;
    }
    if (isUsable(origin)) {
      origin.style.minWidth = `${rect.width}px`;
      origin.style.minHeight = `${rect.height}px`;
      origin.style.width = `${rect.width}px`;
      origin.style.height = `${rect.height}px`;
    }
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
      if (isUsable(origin)) {
        origin.style.minWidth = '';
        origin.style.minHeight = '';
        origin.style.width = '';
        origin.style.height = '';
      }
      contentEl.style.width = '';
      contentEl.style.height = '';
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
