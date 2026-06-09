---
"@pip-it-up/core": patch
"@pip-it-up/react": patch
---

Introduce video Picture-in-Picture fallback support for browsers that do not support the Document Picture-in-Picture API (e.g. Safari, iOS browsers, Firefox).

Core:
- Add video PiP support detection (`isVideoPipSupported`, `isWebkitPipSupported`, `isInVideoPip`) and APIs (`enterVideoPip`, `exitVideoPip`)
- Auto-detect single `<video>` elements to request standard video PiP fallback when document PiP is unavailable or `forceFallback` option is true
- Add pointer events bridge to forward events from the PiP window back to the main opener window
- Add `updateOptions` to dynamically update instance options after initialization
- Implement re-entrancy protection, cross-document element checks, and stylesheet child-list observation improvements

React:
- Add a new `useVideoPip` hook to manage standard/WebKit video PiP on a specific video element
- Support dynamic option updates via `updateOptions` in `usePip` and `PipWrapper`
- Add screen-reader announcements (live regions) and automatic focus redirection on PiP open and close
- Automatically reserve layout space and size for content using `ResizeObserver` while PiP is open
- Update `useIsPipSupported` to check for both document and video PiP compatibility
