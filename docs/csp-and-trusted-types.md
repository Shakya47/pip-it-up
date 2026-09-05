# Content Security Policy (CSP) and Trusted Types Compatibility

`pip-it-up` is designed for use in enterprise web applications with strict Content Security Policy (CSP) and Trusted Types enforcement.

This document details the library's compatibility with `require-trusted-types-for 'script'`, provides a complete audit of all DOM and platform APIs used, and documents CSP considerations including the `style-src` nonce caveat.

---

## Conclusion

`pip-it-up` is **fully compatible** with `require-trusted-types-for 'script'` and `script-src 'self'`.

It requires **no** Trusted Types policy or policy injection, because it never converts strings into executable script or DOM markup.

---

## Recommended Consumer CSP

```csp
require-trusted-types-for 'script';
script-src 'self';
style-src 'self' 'unsafe-inline';   /* see the nonce caveat below */
```

---

## API Audit

The following table documents every DOM and platform API used across `@pip-it-up/core` and `@pip-it-up/react`. Every row has been verified against the active codebase.

| API used | Location | CSP / Trusted Types status |
| :--- | :--- | :--- |
| `cloneNode(true)` | `styles.ts`, `dom-modes.ts` | Safe — no string-to-markup conversion |
| `appendChild` / `removeChild` | `createPip.ts`, `dom-modes.ts`, `styles.ts`, `garage.ts` | Safe |
| `Element.moveBefore` | `garage.ts` | Safe — a node move, not a sink |
| `setAttribute(name, value)` | `styles.ts`, `support.ts`, `garage.ts` | Safe — Trusted Types gates only `script`/`iframe` `src`-class attributes, neither of which is set |
| `element.style.cssText = ...` | `styles.ts:16`, `garage.ts` | Safe — CSS, not script. Needs a `style-src` allowance, not `script-src` |
| `Object.assign(element.style, ...)` | `createPip.ts:252` | Safe |
| `dispatchEvent(new KeyboardEvent(...))` | `keyboard-bridge.ts` | Safe |
| `dispatchEvent(new PointerEvent(...))` | `pointer-bridge.ts` | Safe |
| `requestAnimationFrame` / `setInterval` | `createPip.ts`, `styles.ts`, `useDormancy.ts` | Safe |
| `new MutationObserver(...)` | `styles.ts` | Safe |
| `new ResizeObserver(...)` | `PipWrapper.tsx`, `useLayoutReservation.ts` | Safe |
| `Element.animate(...)` | `useLayoutReservation.ts` | Safe — Web Animations, not script evaluation |
| `new URL(...)` | `fallback.ts` | Safe |
| `window.open(url, ...)` | `fallback.ts` | Safe — Trusted Types gates `eval`-equivalent sinks, not navigation. Subject to `navigate-to`/`form-action` where configured |
| `document.createElement` | `garage.ts`, `SwitchingPortal.tsx`, `support.ts` | Safe |
| `innerHTML` / `outerHTML` / `insertAdjacentHTML` | — | **Not used** |
| `eval` / `new Function` | — | **Not used** |
| Inline handler assignment (`el.onclick = ...`) | — | **Not used** |

---

## Style Synchronization & The Nonce Caveat

### Why `style-src 'unsafe-inline'` is Recommended
CSS-in-JS libraries (such as Tailwind CSS JIT runtime, Emotion, and styled-components) dynamically create and inject `<style>` tags at runtime. While this is a general CSS-in-JS constraint rather than a library-specific one, style synchronization in `pip-it-up` **amplifies** it because dynamically injected `<style>` tags in the opener are observed and cloned into the secondary PiP window.

Style synchronization cannot be disabled (`copyStyles` supports `'sync'` and `'once'`), because Picture-in-Picture windows do not inherit stylesheets from the opener document. Disabling style sync would leave PiP windows completely unstyled.

### The Nonce Caveat (Breaking Configuration)
The one CSP configuration that can break styling in `pip-it-up` involves strict per-document nonces:

- Cloned `<style>` and `<link>` nodes retain their original `nonce` attribute.
- If your server or CSP implementation issues a **per-document** nonce rather than a **per-response** nonce, the nonce value will not validate against the CSP header inside the PiP document context.
- **Failure Mode**: The browser rejects the cloned `<style>` tags in the PiP window, causing the PiP window to render **unstyled**.

**Workaround**:
1. Use a **per-response** nonce that is valid across both documents, or
2. Use `copyStyles: 'once'` with pre-inlined critical CSS.

---

## PiP-Window CSP Inheritance

The Document Picture-in-Picture window is a same-origin document created by the browser engine and **inherits the opener's CSP**.

- Consumers do **not** need to define a separate CSP policy for the PiP window.
- Consumers **cannot** relax the CSP policy inside the PiP window.

---

## Audit Disclaimer

> [!NOTE]
> `pip-it-up` has not undergone a formal third-party security audit. The guarantees documented here reflect architectural constraints, automated code verification, and active sink analysis of the source code.

---

## Appendix: Automated Sink Audit

The following command was run against all source files in `packages/*/src` on 2026-09-02 to verify that no dangerous DOM injection sinks or code evaluation mechanisms exist:

```bash
grep -rnE "innerHTML|outerHTML|insertAdjacentHTML|\beval\(|new Function|\.on(click|load|error|mouseover) *=" packages/*/src
```

**Output:**
```
(empty - 0 matches found)
```
