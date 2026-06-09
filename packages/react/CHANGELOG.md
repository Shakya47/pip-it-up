# @pip-it-up/react

## 0.1.10

### Patch Changes

- 5cc1e2e: Introduce video Picture-in-Picture fallback support for browsers that do not support the Document Picture-in-Picture API (e.g. Safari, iOS browsers, Firefox).

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

- Updated dependencies [5cc1e2e]
  - @pip-it-up/core@0.1.10

## 0.1.9

### Patch Changes

- 0eb4867: Cleaned up the codebase to address community feedback. Removed the unused mode prop from the React package, deleted dead references to maintenance guides, and streamlined code comments and README descriptions.
- Updated dependencies [0eb4867]
  - @pip-it-up/core@0.1.9

## 0.1.8

### Patch Changes

- Updated dependencies [99c4cf2]
- Updated dependencies [99c4cf2]
  - @pip-it-up/core@0.1.8

## 0.1.7

### Patch Changes

- 76dd252: Update library package metadata and documentation to officially transition to a Public Beta status. This includes:
  - Updating core and React npm package descriptions to signal Public Beta status.
  - Adding top-level status badges and aligning the v1.0 public roadmap (featuring Vue, Svelte, and Angular binding tracks) in READMEs.
- Updated dependencies [76dd252]
  - @pip-it-up/core@0.1.7

## 0.1.6

### Patch Changes

- e204133: Removed unsupported lockAspectRatio prop and massively improved Registry and Iframe documentation.
- Updated dependencies [e204133]
  - @pip-it-up/core@0.1.6

## 0.1.5

### Patch Changes

- 896cc00: Remove debug console logs from production builds.
- Updated dependencies [896cc00]
  - @pip-it-up/core@0.1.5

## 0.1.4

### Patch Changes

- 5c77fb7: Significant changes have been made across multiple rounds:
  - Round 2: dead code removal, anti-pattern fixes, performance improvements
  - Round 3: `isInsidePip` correctness, Strict Mode destroy fix, React 19 ref compat, registry fixes
  - Playground regression fix: `setDefaultElements` API, `PipPortal` context threading, `PipWrapper` mode override

- Updated dependencies [5c77fb7]
  - @pip-it-up/core@0.1.4

## 0.1.1

### Patch Changes

- 6ddbc9d: initial release of core engine and react bindings
- Updated dependencies [6ddbc9d]
  - @pip-it-up/core@0.1.1
