import { isUsable } from './elements';

export interface SnapshotOptions {
  restoreScroll?: boolean;
  restoreFocus?: boolean;
}

export const snapshotScrollFocus = (rootEl: HTMLElement, opts: SnapshotOptions = {}) => {
  const { restoreScroll = true, restoreFocus = true } = opts;
  const openerDoc = window.document;

  let activeElement: HTMLElement | null = null;
  let selectionStart: number | null = null;
  let selectionEnd: number | null = null;
  let selectionDir: 'forward' | 'backward' | 'none' | null = null;

  if (restoreFocus) {
    activeElement = openerDoc.activeElement as HTMLElement | null;

    // Note: Cross-document constructor mismatches can happen if HTMLInputElement / HTMLTextAreaElement constructors
    // are checked using instanceof across different window contexts. Using tagName is completely safe in all environments.
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
      try {
        const input = activeElement as HTMLInputElement | HTMLTextAreaElement;
        selectionStart = input.selectionStart;
        selectionEnd = input.selectionEnd;
        selectionDir = input.selectionDirection;
      } catch {
        // noop: some input types (e.g. number, date) throw on selectionStart access
      }
    }
  }

  const scrollMap = new WeakMap<HTMLElement, { scrollTop: number; scrollLeft: number }>();

  if (restoreScroll) {
    const allElements = rootEl.querySelectorAll('*');
    if (rootEl.scrollTop > 0 || rootEl.scrollLeft > 0) {
      scrollMap.set(rootEl, { scrollTop: rootEl.scrollTop, scrollLeft: rootEl.scrollLeft });
    }
    for (let i = 0; i < allElements.length; i++) {
      const node = allElements[i];
      if (node.nodeType === 1 && ((node as HTMLElement).scrollTop > 0 || (node as HTMLElement).scrollLeft > 0)) {
        const htmlNode = node as HTMLElement;
        scrollMap.set(htmlNode, { scrollTop: htmlNode.scrollTop, scrollLeft: htmlNode.scrollLeft });
      }
    }
  }

  return {
    restore: () => {
      if (restoreScroll) {
        const restoreState = (node: HTMLElement) => {
          const state = scrollMap.get(node);
          if (state) {
            node.scrollTop = state.scrollTop;
            node.scrollLeft = state.scrollLeft;
          }
        };

        restoreState(rootEl);
        const allElements = rootEl.querySelectorAll('*');
        for (let i = 0; i < allElements.length; i++) {
          const node = allElements[i];
          if (node.nodeType === 1) {
            restoreState(node as HTMLElement);
          }
        }
      }

      if (restoreFocus && isUsable(activeElement) && openerDoc.body.contains(activeElement)) {
        activeElement.focus({ preventScroll: true });

        if (selectionStart !== null && selectionEnd !== null) {
          try {
            (activeElement as HTMLInputElement | HTMLTextAreaElement).setSelectionRange(
              selectionStart,
              selectionEnd,
              selectionDir || 'none'
            );
          } catch {
            // noop: some input types throw on setSelectionRange
          }
        }
      }
    }
  };
};
