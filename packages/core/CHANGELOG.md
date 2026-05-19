# @pip-it-up/core

## 0.1.8

### Patch Changes

- 99c4cf2: Defensive coding hardening — six improvements for resilience against misuse, third-party interference, and future refactors. No behavioral changes for correct callers.
  - **`pipBodyStyles` / `fallbackUrl` JSDoc**: Documented as trusted-input-only fields to surface CSS/URL injection risks to consumers.
  - **Clone mode documentation**: Added JSDoc on `applyCloneMode` and README entry documenting `cloneNode(true)` semantics (inline handlers ARE cloned, event listeners are NOT, form state is NOT preserved).
  - **SSR audit**: Verified all `window` references in helper files are inside function bodies — no module-scope access that would crash in SSR environments.
  - **Cross-document `instanceof` comment**: Documented the cross-realm constructor trap in `focus-scroll.ts` with guidance for future refactors.
  - **Disposer error isolation**: Wrapped each `dispose()` call in `try/catch` so one failing disposer doesn't prevent the rest from running — prevents resource leaks from faulty cleanup.
  - **Close-polling documentation**: Added inline comments explaining the `setInterval` close-polling re-entrancy safety.

- 99c4cf2: Security hardening: three fixes for identified vulnerabilities.
  - **fallbackUrl validation**: `fallback: 'new-tab'` now validates URLs — only `http:` and `https:` protocols are allowed. `javascript:`, `data:`, and other dangerous schemes are rejected with a `console.warn`. All new-tab windows are opened with `noopener,noreferrer` to prevent reverse tabnabbing.
  - **Registry collision warning**: `registerPip()` now emits a `console.warn` when a different instance is registered under an existing ID, surfacing accidental collisions or third-party hijacking. Re-registering the same instance reference (e.g., during React Strict Mode remounts) does not trigger the warning.
  - **Keyboard bridge isTrusted filter**: The keyboard event bridge now ignores synthetic `dispatchEvent()` calls in the PiP window (`e.isTrusted === false`), preventing spoofed keystroke escalation to the opener window.

## 0.1.7

### Patch Changes

- 76dd252: Update library package metadata and documentation to officially transition to a Public Beta status. This includes:
  - Updating core and React npm package descriptions to signal Public Beta status.
  - Adding top-level status badges and aligning the v1.0 public roadmap (featuring Vue, Svelte, and Angular binding tracks) in READMEs.

## 0.1.6

### Patch Changes

- e204133: Removed unsupported lockAspectRatio prop and massively improved Registry and Iframe documentation.

## 0.1.5

### Patch Changes

- 896cc00: Remove debug console logs from production builds.

## 0.1.4

### Patch Changes

- 5c77fb7: Significant changes have been made across multiple rounds:
  - Round 2: dead code removal, anti-pattern fixes, performance improvements
  - Round 3: `isInsidePip` correctness, Strict Mode destroy fix, React 19 ref compat, registry fixes
  - Playground regression fix: `setDefaultElements` API, `PipPortal` context threading, `PipWrapper` mode override

## 0.1.1

### Patch Changes

- 6ddbc9d: initial release of core engine and react bindings
