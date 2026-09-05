export const attachFixedSizeGuard = (
  pipWindow: Window,
  width: number,
  height: number,
  signal?: AbortSignal,
) => {
  const handleResize = () => {
    try {
      pipWindow.resizeTo(width, height);
    } catch {
      // Resize may fail if window is closed
    }
  };

  const signalOptions = signal ? [{ signal }] : [];
  pipWindow.addEventListener('resize', handleResize, ...signalOptions);

  pipWindow.document.documentElement.style.width = `${width}px`;
  pipWindow.document.documentElement.style.height = `${height}px`;
  pipWindow.document.documentElement.style.overflow = 'hidden';

  pipWindow.document.body.style.width = `${width}px`;
  pipWindow.document.body.style.height = `${height}px`;
  pipWindow.document.body.style.overflow = 'hidden';
  pipWindow.document.body.style.margin = '0';

  return () => {
    pipWindow.removeEventListener('resize', handleResize);
  };
};
