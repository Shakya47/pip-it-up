import type { FallbackMode, PipOptions } from './types';

export const executeFallback = (
  fallback: FallbackMode,
  options: PipOptions,
  contentEl?: HTMLElement,
  originEl?: HTMLElement
) => {
  if (typeof fallback === 'function') {
    fallback({ contentEl, originEl, options });
    return;
  }

  switch (fallback) {
    case 'new-tab':
      if (options.fallbackUrl) {
        window.open(options.fallbackUrl, '_blank');
      } else {
        console.warn('pip-it-up: fallback="new-tab" requires fallbackUrl option');
      }
      break;
    case 'modal':
      // The React bindings handle the modal rendering UI.
      break;
    case 'none':
      console.warn('pip-it-up: Document Picture-in-Picture is not supported in this browser.');
      break;
  }
};
