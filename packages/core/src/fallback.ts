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
        let parsed: URL;
        try {
          parsed = new URL(options.fallbackUrl, window.location.origin);
        } catch {
          console.warn(
            `[pip-it-up] Invalid fallbackUrl: "${options.fallbackUrl}". URL could not be parsed.`
          );
          return;
        }

        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          console.warn(
            `[pip-it-up] Blocked fallbackUrl with disallowed protocol "${parsed.protocol}". Only http: and https: URLs are allowed.`
          );
          return;
        }

        // Navigate to the value that was VALIDATED, never the raw input. window.open() resolves
        // relative URLs against the document base URL, which a <base href> element can point at
        // another origin, while validation above resolved against window.location.origin. Passing
        // `parsed.href` makes the validated URL and the navigated URL the same string.
        //
        // The return value is always null under `noopener` (per spec) and must never be
        // dereferenced. Returning a window handle here is impossible without dropping `noopener`,
        // which this library will not do.
        window.open(parsed.href, '_blank', 'noopener,noreferrer');
      } else {
        console.warn('pip-it-up: fallback="new-tab" requires fallbackUrl option');
      }
      return;
    case 'none':
      console.warn('pip-it-up: Document Picture-in-Picture is not supported in this browser.');
      return;
  }
};
