# Capabilities

What: the per-browser canary. Each live browser must still match its declared row in apps/e2e/lib/capabilities.ts, so a browser gaining or losing a feature fails loudly instead of silently skipping tests.
Code: apps/e2e/lib/capabilities.ts
Spec: apps/e2e/tests/capabilities.spec.ts (vanilla project of every browser)
Last run: 2026-09-27 · matrix (chrome, firefox, webkit; msedge is CI-only)

## Canary

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| BC1 | Detect `documentPictureInPicture`, `Element.prototype.moveBefore`, H.264 `canPlayType`, `navigator.userActivation` | Exactly the declared docPip / moveBefore / h264 / userActivation | vanilla | any | pass 2026-09-29 · vanilla-chrome vanilla-firefox vanilla-webkit |
| BC2 | Click a button that plays a captureStream video and calls `requestPictureInPicture()` | Enters video PiP exactly where `videoPip` is declared true (WebKit has the API and rejects) | vanilla | any | pass 2026-09-29 · vanilla-chrome vanilla-firefox vanilla-webkit |
| BC3 | Click a button that calls `documentPictureInPicture.requestWindow()` | A PiP window opens exactly where `docPip` is declared true | vanilla | any | pass 2026-09-29 · vanilla-chrome vanilla-firefox vanilla-webkit |

## Declared (probed 2026-09-27, macOS 26.5, Playwright 1.63)

| Browser | docPip | videoPip | moveBefore | h264 | Verified |
| --- | --- | --- | --- | --- | --- |
| chrome (Google Chrome 153) | ✅ | ✅ | ✅ | ✅ | probe + BC1–BC3 |
| msedge | ✅ | ✅ | ✅ | ✅ | expected = chrome; not verified (not installed) |
| chromium (Chrome for Testing, new headless) | ✅ | ✅ | ✅ | ✅ | probe on CfT 148 |
| firefox (Playwright Firefox 155) | ✅ | ✅ | ✅ | ✅ (macOS) | probe + BC1–BC3 |
| webkit (Playwright WebKit 26.6) | ❌ | ❌ (API present, rejects) | ❌ | ✅ (macOS) | probe + BC1–BC3 |

## Notes

- Never add Playwright's default headless shell (plain `chromium`, no channel): it opens Document PiP windows at 800×600 whatever size is requested (probed on 148).
- Every Playwright call grants transient user activation in all three engines, for about 5 s; `page.goto` doesn't (probed). See lib/activation.ts.
- Headless and headed Chrome size PiP windows differently (headless caps them to a small virtual screen): see sizing.md.
- Linux (CI runners) is expected to match macOS for Chrome; H.264 in Playwright's Firefox and WebKit on Linux depends on system codecs. Confirm in the first CI run.

## Corrections

<!-- Dated lines from the user's corrections. They override what the code suggests. -->
