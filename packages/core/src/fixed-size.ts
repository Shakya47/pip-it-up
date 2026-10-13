/**
 * `fixedSize`: lock the PiP document to the requested size (html and body get fixed px sizes and
 * `overflow: hidden`), so the content never reflows when the user resizes the window.
 *
 * The WINDOW itself is not resized back. An earlier version called `pipWindow.resizeTo()` on every
 * `resize`, but browsers only allow that with a fresh user gesture (Chrome 153 refused it for a
 * user's drag-resize), and `resizeTo()` sets the OUTER size, so when it did run it shrank the
 * window by its title bar. The lock is the part that works everywhere.
 */
export const attachFixedSizeGuard = (pipWindow: Window, width: number, height: number) => {
  const html = pipWindow.document.documentElement.style;
  const body = pipWindow.document.body.style;

  html.width = `${width}px`;
  html.height = `${height}px`;
  html.overflow = 'hidden';

  body.width = `${width}px`;
  body.height = `${height}px`;
  body.overflow = 'hidden';
  body.margin = '0';

  // Nothing to undo: the styles live in the PiP document, which closes with the window.
  return () => {};
};
