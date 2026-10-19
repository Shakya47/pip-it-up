# Video

What: media inside a Document PiP window (continuity, V12), and core's automatic video fallback: without Document PiP (or with `forceFallback`), content holding exactly one `<video>` enters classic video PiP.
Code: packages/core/src/createPip.ts:210-268 (video fallback), packages/core/src/support.ts (enterVideoPip, exitVideoPip, isVideoPipSupported)
Spec: apps/e2e/tests/contract/video.spec.ts
Last run: 2026-09-27 · matrix (chrome, firefox, webkit; msedge is CI-only)

## In Document PiP

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| VP1 | `video` scenario: play "Test video", open, close from the OS | `currentTime` keeps rising and `paused` stays false in PiP and after closing (V12) | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |

## Automatic video fallback

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| VP2 | `forceFallback`, one playing video, click "Open PiP" | The video enters video PiP; status open; log `open`; no PiP window page | all | videopip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| VP3 | Then click "Close PiP" | Video PiP exits; status closed; log `open`, `close` | all | videopip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| VP4 | Then leave video PiP from the browser side (`document.exitPictureInPicture()`) | The instance closes itself (leavepictureinpicture): status closed, `close` logged | all | videopip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| VP5 | `forceFallback&disableVideoPip` | No video PiP; the fallback (none) opens nothing | all | videopip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| VP6 | `multi-video` (two videos), `forceFallback` | No video fallback (it needs exactly one video); nothing opens | all | videopip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| VP7 | A browser with neither working Document PiP nor video PiP (Playwright WebKit): open the `video` scenario | With fallback `none` there is nothing to fall through to: open() rejects and onError gets the video error (log exactly `error:NotSupportedError`); nothing opens | all | nopip | pass 2026-09-29 · next-webkit react-webkit vanilla-webkit |

## Direct video PiP API

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| VP8 | `video-api`: click "Enter video PiP" (core `enterVideoPip`, react `useVideoPip().enter`) | The standalone video is in video PiP; the status reads "Video PiP: on" (from the element events) | all | videopip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| VP9 | Then "Exit video PiP" | Video PiP ends; "Video PiP: off" | all | videopip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| VP10 | Then leave from the browser side (`document.exitPictureInPicture()`, the PiP window's own close) | The status follows: "Video PiP: off" | all | videopip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| VP11 | Arm "Auto video PiP on tab switch" (`createAutoPip(() => enterVideoPip(v))` / `useAutoPip(enter)`), hide the tab with activation live | The video enters PiP; logged `auto:ok:gesture` | all | videopip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| VP12 | Same, but after 6.5 s without input | Logged `auto:blocked:NotAllowedError` (not a success); no video PiP | all | videopip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |

## Notes

- Videos are `canvas.captureStream()` (no codec): they play in Chrome, Firefox and WebKit (probed 2026-09-27). The playground's H.264 MP4 is covered by playground.md PG1–PG3.
- **Possible bug:** `isVideoPipSupported()` (support.ts:11) checks that `pictureInPictureEnabled` EXISTS, not that it is `true`, so a page where Permissions-Policy disables PiP still reports support. And Playwright's WebKit exposes the whole API but rejects every request with NotSupportedError, so detection can't tell there either (VP7 and capabilities.md BC2).
- In the fallback path `onOpen` receives `window` (not a PiP window) and `pipWindow` stays null (createPip.ts:226-263).
- The auto-PiP + video combination is playground.md PG9–PG11 (and the useVideoPip error-swallowing bug).
- VP8–VP10 also run in real Safari: safari.md SF6, SF7.

## Corrections

<!-- Dated lines from the user's corrections. They override what the code suggests. -->
