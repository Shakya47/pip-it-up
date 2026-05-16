import type { FallbackMode, PipOptions } from './types';

export const executeFallback = (
  fallback: FallbackMode,
  options: PipOptions,
  contentEl?: HTMLElement,
  originEl?: HTMLElement
): (() => void) | void => {
  if (typeof fallback === 'function') {
    const result = fallback({ contentEl, originEl, resolvedOptions: options });
    return typeof result === 'function' ? result : undefined;
  }

  switch (fallback) {
    case 'new-tab':
      if (options.fallbackUrl) {
        window.open(options.fallbackUrl, '_blank');
      } else {
        console.warn('pip-it-up: fallback="new-tab" requires fallbackUrl option');
      }
      return;
    case 'none':
      console.warn('pip-it-up: Document Picture-in-Picture is not supported in this browser.');
      return;
  }
};
