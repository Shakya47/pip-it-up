export const applyMoveMode = (pipWindow: Window, contentEl: HTMLElement, originEl: HTMLElement, reserveSpace = true) => {
  if (reserveSpace) {
    const rect = contentEl.getBoundingClientRect();
    
    // Set exact width/height on originEl so placeholders can use height: 100%
    originEl.style.minWidth = `${rect.width}px`;
    originEl.style.minHeight = `${rect.height}px`;
    originEl.style.width = `${rect.width}px`;
    originEl.style.height = `${rect.height}px`;
    
    // Set exact width/height on contentEl so it doesn't shrink when moved
    contentEl.style.width = `${rect.width}px`;
    contentEl.style.height = `${rect.height}px`;
  }

  pipWindow.document.body.appendChild(contentEl);
  
  return () => {
    if (originEl && contentEl) {
      if (reserveSpace) {
        originEl.style.minWidth = '';
        originEl.style.minHeight = '';
        originEl.style.width = '';
        originEl.style.height = '';
        contentEl.style.width = '';
        contentEl.style.height = '';
      }
      originEl.appendChild(contentEl);
    }
  };
};

export const applyCloneMode = (pipWindow: Window, contentEl: HTMLElement) => {
  const clone = contentEl.cloneNode(true);
  pipWindow.document.body.appendChild(clone);
  return () => { clone.parentNode?.removeChild(clone); };
};


