export const attachFixedSizeGuard = (pipWindow: Window, width: number, height: number) => {
  let isResizing = false;
  
  const handleResize = () => {
    if (isResizing) return;
    
    if (pipWindow.innerWidth !== width || pipWindow.innerHeight !== height) {
      isResizing = true;
      try {
        pipWindow.resizeTo(width, height);
      } catch {
        // Ignore errors if restricted
      }
      
      setTimeout(() => {
        isResizing = false;
      }, 50);
    }
  };

  pipWindow.addEventListener('resize', handleResize);

  return () => {
    pipWindow.removeEventListener('resize', handleResize);
  };
};
