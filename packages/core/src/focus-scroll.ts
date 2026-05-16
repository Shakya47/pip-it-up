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

    if (activeElement && (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement)) {
      try {
        selectionStart = activeElement.selectionStart;
        selectionEnd = activeElement.selectionEnd;
        selectionDir = activeElement.selectionDirection;
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
      if (node instanceof HTMLElement && (node.scrollTop > 0 || node.scrollLeft > 0)) {
        scrollMap.set(node, { scrollTop: node.scrollTop, scrollLeft: node.scrollLeft });
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
          if (node instanceof HTMLElement) {
            restoreState(node);
          }
        }
      }

      if (restoreFocus && activeElement && openerDoc.body.contains(activeElement)) {
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
