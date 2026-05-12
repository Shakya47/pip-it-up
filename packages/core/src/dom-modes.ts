export const applyMoveMode = (pipWindow: Window, contentEl: HTMLElement, originEl: HTMLElement) => {
  pipWindow.document.body.appendChild(contentEl);
  
  return () => {
    if (originEl && contentEl) {
      originEl.appendChild(contentEl);
    }
  };
};

export const applyCloneMode = (pipWindow: Window, contentEl: HTMLElement) => {
  const clone = contentEl.cloneNode(true);
  pipWindow.document.body.appendChild(clone);
  return () => {};
};

export const applyPortalAnchorMode = (pipWindow: Window) => {
  // In portal mode, the React DOM tree is portaled to `pipWindow.document.body` directly.
  return () => {};
};
