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

/**
 * Clones `contentEl` into the PiP window using `cloneNode(true)`.
 *
 * **Shallow-clone semantics to be aware of:**
 * - Event listeners added via `addEventListener` are **NOT** cloned.
 * - Inline event handlers (`onclick`, `onmouseover`, etc.) **ARE** cloned and
 *   execute in the PiP window's context. If the cloned content contains inline
 *   handlers from a different trust boundary (e.g., user-pasted HTML), this
 *   becomes a potential script-injection vector.
 * - Internal state of form elements (`<input>`, `<select>`, `<textarea>`) after
 *   user interaction is **NOT** preserved in the clone.
 * - `<script>` tags are cloned but do **NOT** re-execute in the PiP document.
 *
 * **Note:** Clone mode is only available via the vanilla `createPip()` API.
 * The React `<PipWrapper>` always uses portal mode internally.
 * See MAINTENANCE_GUIDE.md Section 3.
 */
export const applyCloneMode = (pipWindow: Window, contentEl: HTMLElement) => {
  const clone = contentEl.cloneNode(true);
  pipWindow.document.body.appendChild(clone);
  return () => { clone.parentNode?.removeChild(clone); };
};


