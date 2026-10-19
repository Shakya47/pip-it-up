# Auto-PiP

What: entering PiP automatically when the tab is hidden (createAutoPip / useAutoPip), with the outcome reported through onResult.
Code: packages/core/src/auto-pip.ts, packages/react/src/useAutoPip.ts
Spec: apps/e2e/tests/contract/auto-pip.spec.ts (the playground's editor/video variants: playground.md PG8–PG11)
Last run: 2026-09-27 · matrix (chrome, firefox, webkit; msedge is CI-only)

## Tab switch

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| AP1 | Tick "Auto-PiP on tab switch", hide the tab (simulated) right away | A PiP window opens with the content; status open; log `auto:ok:gesture` | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| AP2 | Tick the box, touch nothing for 6.5 s, hide the tab | Blocked: log `auto:blocked:NotAllowedError:false`; no window | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| AP3 | After AP1, show and hide the tab again while the window is open | `when` (not open) blocks a second attempt: still one `auto:` entry | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| AP4 | Don't tick the box, hide the tab | Nothing: no `auto:` entry, no window | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |

## Notes

- **Fixed 2026-09-28 (AP2):** `open()` always rejects on failure and still calls `onError` (packages/core/src/createPip.ts); PipTrigger catches and warns, so click handlers stay quiet. Was: **app bug, confirmed 2026-09-27:** when the instance has `onError`, `open()` reports the failure through onError and RESOLVES (createPip.ts:428-436). `createAutoPip` treats a resolved `enter()` as success, so a blocked attempt is reported `{ ok: true, grantedBy: 'browser' }`. The playground's editor demo passes no onError, so it rejects and reports correctly; the video demo hits the same class of bug through `useVideoPip` (playground.md PG10/PG11).
- A tab switch is simulated (lib/activation.ts): Playwright can't hide a tab. Every Playwright call grants activation, so AP1 proves "works while activation is live". AP2 schedules the switch with a page timer and waits 6.5 s with no page calls, so activation has really expired.
- Not tested: `mediaSession: true` (the browser-initiated `enterpictureinpicture` action needs an auto-PiP-eligible origin, which headless Chrome isn't).

## Corrections

<!-- Dated lines from the user's corrections. They override what the code suggests. -->
- 2026-09-28 (AP2): `open()` must reject when it fails, whether or not `onError` is set; `onError` is a notification. Callers that don't await it (click handlers) catch.
