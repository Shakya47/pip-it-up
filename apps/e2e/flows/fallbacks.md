# Fallbacks

What: behaviour without Document PiP (forced with `forceFallback`, or natively in browsers without it): `none`, `new-tab` with URL validation, a custom function.
Code: packages/core/src/fallback.ts, packages/core/src/createPip.ts:270-279, packages/react/src/PipTrigger.tsx (renderUnsupported)
Spec: apps/e2e/tests/contract/fallbacks.spec.ts
Last run: 2026-09-27 · matrix (chrome, firefox, webkit; msedge is CI-only)

## Modes

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| FB1 | `forceFallback`, no `fallback` option, click "Open PiP" | Nothing opens, no callbacks (no onError), status closed; core warns "pip-it-up: Document Picture-in-Picture is not supported" | all | any | pass 2026-09-29 · next-chrome next-firefox next-webkit react-chrome react-firefox react-webkit vanilla-chrome vanilla-firefox vanilla-webkit |
| FB2 | `fallback=new-tab&fallbackUrl=/standalone` | A new tab opens at `<this origin>/standalone` with `window.opener === null`; status open; log `open` | all | any | pass 2026-09-29 · next-chrome next-firefox next-webkit react-chrome react-firefox react-webkit vanilla-chrome vanilla-firefox vanilla-webkit |
| FB3 | `fallbackUrl=javascript:alert(1)` | open() rejects with a `PipError` (`ERR_INVALID_FALLBACK`): log exactly `error:PipError`; status closed; no tab | all | any | pass 2026-09-29 · next-chrome next-firefox next-webkit react-chrome react-firefox react-webkit vanilla-chrome vanilla-firefox vanilla-webkit |
| FB4 | `fallback=new-tab` without `fallbackUrl` | open() rejects with a `PipError` (`ERR_INVALID_FALLBACK`): log exactly `error:PipError`; status closed; no tab | all | any | pass 2026-09-29 · next-chrome next-firefox next-webkit react-chrome react-firefox react-webkit vanilla-chrome vanilla-firefox vanilla-webkit |
| FB5 | Page rendered, then a `<base href="https://example.com/">` inserted, `fallbackUrl=/standalone` | The tab opens on this origin, not example.com (validated URL = navigated URL, SEC-201) | all | any | pass 2026-09-29 · next-chrome next-firefox next-webkit react-chrome react-firefox react-webkit vanilla-chrome vanilla-firefox vanilla-webkit |
| FB6 | `fallback=custom` (a function returning a cleanup), open, close | Log `fallback:custom`, `open`; after "Close PiP": `fallback-cleanup`, `close` | all | any | pass 2026-09-29 · next-chrome next-firefox next-webkit react-chrome react-firefox react-webkit vanilla-chrome vanilla-firefox vanilla-webkit |

## Notes

- **Doc drift, confirmed 2026-09-27:** docs/recipes/fallbacks.md says `new-tab` is the default. The code defaults to `'none'` (createPip.ts:271); FB1 is the actual default behaviour.
- With `fallback: 'none'` nothing tells the app it failed: no onError, no state change, only a console warning (FB1).
- `new-tab` sets the instance to open with `pipWindow: null`; "Close PiP" only runs cleanups, it can't close the tab (noopener makes the handle null, by design).
- `<PipTrigger renderUnsupported>` is react.md RX8.
- FB5 inserts the hostile `<base>` from the test after the page has rendered (2026-09-29). It used to be a harness option applied at load, which broke Next (its router and chunk requests resolved against example.com), and on next the row had never actually run.

## Corrections

<!-- Dated lines from the user's corrections. They override what the code suggests. -->
