# Safari (real)

What: real Safari through safaridriver (W3C WebDriver), for what Playwright's WebKit can't show: Safari's working video PiP, and its no-Document-PiP paths.
Code: packages/core/src/support.ts (video PiP), packages/core/src/createPip.ts:210-279 (video fallback, fallbacks), packages/react/src/PipTrigger.tsx
Spec: apps/e2e/scripts/safari.mjs (not Playwright: `node apps/e2e/scripts/safari.mjs`, macOS; results in test-results/safari.json)
Last run: 2026-09-29 · Safari 26.5.2 (macOS 26.5.2): 7/7 on 11 runs

## Safari

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| SF1 | Feature detection on the vanilla target | No `documentPictureInPicture`, no `moveBefore`, a usable video PiP API (`pictureInPictureEnabled` true), `navigator.userActivation` | vanilla | any | pass 2026-09-28 · safari |
| SF2 | `basic`, click "Open PiP" | Fallback none: status stays closed, no new window | vanilla | any | todo — retest: runner now waits for the 'none' fallback, then holds 2 s 2026-09-29 |
| SF3 | `fallback=new-tab&fallbackUrl=/standalone`, click "Open PiP" | A new tab at `/standalone`; status open | vanilla | any | todo — retest: runner now closes the tab in finally 2026-09-29 |
| SF4 | `video` (one playing video), click "Open PiP", then "Close PiP" | The video enters REAL video PiP via the automatic fallback (status open, `onOpen` exactly once), and "Close PiP" exits it | vanilla | any | pass 2026-09-28 · safari (5/5 after the fixes below) |
| SF5 | React `#/react-trigger` | `<PipTrigger renderUnsupported>` shows "PiP unavailable", no dead button (react.md RX8) | react | any | todo — retest: runner now waits for the UI instead of a fixed 500 ms 2026-09-29 |
| SF6 | `#/video-api` on vanilla, then react: "Enter video PiP", then "Exit video PiP" | The standalone video enters real video PiP, "Video PiP: on"; then leaves it, "Video PiP: off" (video.md VP8, VP9) | vanilla, react | videopip | pass 2026-09-29 · safari |
| SF7 | `#/video-api` on vanilla, then react: enter, then `document.exitPictureInPicture()` (Safari's own exit) | Video PiP ends and the status follows: "Video PiP: off" (video.md VP10) | vanilla, react | videopip | pass 2026-09-29 · safari |

## Notes

- One-time setup on the Mac: `sudo safaridriver --enable` (turns on Develop → Allow Remote Automation). The runner prints this when the session is refused.
- WebDriver sessions are headed: Safari opens an automation window (orange address bar). Don't use Safari while it runs.
- CI: the `e2e (safari)` job in .github/workflows/e2e.yml runs this on `macos-latest` for manual runs (Actions → E2E → Run workflow), after `sudo safaridriver --enable`.
- WebDriver element clicks in Safari are real user gestures: SF4's video really entered Safari's PiP (confirmed 2026-09-27). Safari animates PiP entry and exit, so the runner waits up to 5 s for the instance to report open and 10 s for the exit.
- **Fixed 2026-09-28 (SF4):** an event timeline showed two things. (1) A library bug: Safari fires `enterpictureinpicture` ~1 ms AFTER `requestPictureInPicture()` resolves, and core's video-fallback `handleEnter` reported the open again, so `onOpen` ran twice; `handleEnter` is now idempotent (packages/core/src/createPip.ts, 1 new unit test), and SF4 asserts the log is exactly `["open"]`. (2) A runner issue: Safari drops a WebDriver click sent while it is still animating the PiP entry, so the runner waits 1.5 s, checks the toggle's label flipped, and re-clicks once if not. After both: 5/5 runs. Earlier: SF4 was flaky in real Safari: 2 failures in ~11 runs (2026-09-27/28), the second failing its retry too, with no page warning (the video never entered PiP). Cause not diagnosed; the failure message now includes status, log and video state. SF3/SF4 flaked once in six local runs (no new tab / video not in PiP), then passed; in CI each failing row gets one retry and a pass on retry is reported as `flaky`. SF5 was an expected failure until RX8 was fixed (2026-09-28); the runner's `KNOWN_BUGS` is empty now.
- Runner bugs fixed on the first run: object key order in comparisons, the W3C element key, and a hash-only navigation not reloading the page (every visit now adds a unique query string before the hash).
- SF6/SF7 cover VP8–VP10 in real Safari; Playwright's WebKit has no working video PiP, so these rows are skipped there. VP11/VP12 (video auto-PiP on tab switch) need a real tab switch, which WebDriver can't make.
- 2026-09-29: SF4 looked for the `<video>` before the hash route rendered it (one failure in 3 runs); it now waits for it. Back-to-back runs sometimes failed with "safaridriver didn't start" while the previous driver was still going; startup now retries up to 3 times.

## Corrections

<!-- Dated lines from the user's corrections. They override what the code suggests. -->
