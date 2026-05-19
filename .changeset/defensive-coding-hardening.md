---
"@pip-it-up/core": patch
---

Defensive coding hardening — six improvements for resilience against misuse, third-party interference, and future refactors. No behavioral changes for correct callers.

- **`pipBodyStyles` / `fallbackUrl` JSDoc**: Documented as trusted-input-only fields to surface CSS/URL injection risks to consumers.
- **Clone mode documentation**: Added JSDoc on `applyCloneMode` and README entry documenting `cloneNode(true)` semantics (inline handlers ARE cloned, event listeners are NOT, form state is NOT preserved).
- **SSR audit**: Verified all `window` references in helper files are inside function bodies — no module-scope access that would crash in SSR environments.
- **Cross-document `instanceof` comment**: Documented the cross-realm constructor trap in `focus-scroll.ts` with guidance for future refactors.
- **Disposer error isolation**: Wrapped each `dispose()` call in `try/catch` so one failing disposer doesn't prevent the rest from running — prevents resource leaks from faulty cleanup.
- **Close-polling documentation**: Added inline comments explaining the `setInterval` close-polling re-entrancy safety.
