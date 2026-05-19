---
"@pip-it-up/core": patch
---

Security hardening: three fixes for identified vulnerabilities.

- **fallbackUrl validation**: `fallback: 'new-tab'` now validates URLs — only `http:` and `https:` protocols are allowed. `javascript:`, `data:`, and other dangerous schemes are rejected with a `console.warn`. All new-tab windows are opened with `noopener,noreferrer` to prevent reverse tabnabbing.
- **Registry collision warning**: `registerPip()` now emits a `console.warn` when a different instance is registered under an existing ID, surfacing accidental collisions or third-party hijacking. Re-registering the same instance reference (e.g., during React Strict Mode remounts) does not trigger the warning.
- **Keyboard bridge isTrusted filter**: The keyboard event bridge now ignores synthetic `dispatchEvent()` calls in the PiP window (`e.isTrusted === false`), preventing spoofed keystroke escalation to the opener window.
