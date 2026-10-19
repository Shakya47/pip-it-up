import type { FallbackMode, PipOptions } from './types';

/**
 * Validates `options.fallbackUrl` for `fallback: 'new-tab'`. Shared by `executeFallback` and by
 * createPip, which needs the same answer earlier: a new-tab fallback without a usable URL opens
 * nothing, so it must not count toward `isSupported` and `open()` must reject instead of reporting
 * a session that never started.
 */
export const resolveFallbackUrl = (
  options: PipOptions
): { ok: true; href: string } | { ok: false; reason: string } => {
  if (!options.fallbackUrl) {
    return { ok: false, reason: 'pip-it-up: fallback="new-tab" requires fallbackUrl option' };
  }
  let parsed: URL;
  try {
    parsed = new URL(options.fallbackUrl, window.location.origin);
  } catch {
    return {
      ok: false,
      reason: `[pip-it-up] Invalid fallbackUrl: "${options.fallbackUrl}". URL could not be parsed.`,
    };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      ok: false,
      reason: `[pip-it-up] Blocked fallbackUrl with disallowed protocol "${parsed.protocol}". Only http: and https: URLs are allowed.`,
    };
  }
  return { ok: true, href: parsed.href };
};

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
    case 'new-tab': {
      const url = resolveFallbackUrl(options);
      if (!url.ok) {
        console.warn(url.reason);
        return;
      }
      // Navigate to the value that was VALIDATED, never the raw input. window.open() resolves
      // relative URLs against the document base URL, which a <base href> element can point at
      // another origin, while validation above resolved against window.location.origin. Passing
      // `href` makes the validated URL and the navigated URL the same string.
      //
      // The return value is always null under `noopener` (per spec) and must never be
      // dereferenced. Returning a window handle here is impossible without dropping `noopener`,
      // which this library will not do.
      window.open(url.href, '_blank', 'noopener,noreferrer');
      return;
    }
    case 'none':
      console.warn('pip-it-up: Document Picture-in-Picture is not supported in this browser.');
      return;
  }
};
