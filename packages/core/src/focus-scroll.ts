export const snapshotScrollFocus = (rootEl: HTMLElement) => {
  const openerDoc = window.document;
  const activeElement = openerDoc.activeElement as HTMLElement | null;
  
  // Save input selection state if applicable
  let selectionStart: number | null = null;
  let selectionEnd: number | null = null;
  let selectionDir: 'forward' | 'backward' | 'none' | null = null;

  if (activeElement && (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement)) {
    try {
      selectionStart = activeElement.selectionStart;
      selectionEnd = activeElement.selectionEnd;
      selectionDir = activeElement.selectionDirection;
    } catch {
      // Some input types do not support selection
    }
  }

  const scrollMap = new WeakMap<HTMLElement, { scrollTop: number; scrollLeft: number }>();
  
  const walk = (node: Element) => {
    if (node instanceof HTMLElement) {
      if (node.scrollTop > 0 || node.scrollLeft > 0) {
        scrollMap.set(node, { scrollTop: node.scrollTop, scrollLeft: node.scrollLeft });
      }
    }
    for (const child of Array.from(node.children)) {
      walk(child);
    }
  };
  
  walk(rootEl);

  return {
    restore: () => {
      const restoreWalk = (node: Element) => {
        if (node instanceof HTMLElement) {
          const state = scrollMap.get(node);
          if (state) {
            node.scrollTop = state.scrollTop;
            node.scrollLeft = state.scrollLeft;
          }
        }
        for (const child of Array.from(node.children)) {
          restoreWalk(child);
        }
      };
      
      restoreWalk(rootEl);

      if (activeElement && openerDoc.body.contains(activeElement)) {
        activeElement.focus({ preventScroll: true });
        
        if (selectionStart !== null && selectionEnd !== null) {
          try {
            (activeElement as HTMLInputElement | HTMLTextAreaElement).setSelectionRange(
              selectionStart, 
              selectionEnd, 
              selectionDir || 'none'
            );
          } catch {
            // Ignore
          }
        }
      }
    }
  };
};
