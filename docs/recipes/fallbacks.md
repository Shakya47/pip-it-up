# Fallbacks

Not every browser supports the Document Picture-in-Picture API (Chrome/Edge 116+ and Firefox 151+ do; Safari and mobile browsers don't). `pip-it-up` provides graceful fallbacks.

## Fallback Modes

You can control fallback behavior using the `fallback` and `fallbackUrl` props:

```tsx
<PipWrapper fallback="new-tab" fallbackUrl="/pip-standalone-view">
  {/* Content */}
</PipWrapper>
```

### Options

1. **`new-tab`**: Opens `fallbackUrl` in a new tab with `window.open(url, '_blank', 'noopener,noreferrer')`. The URL is validated first: only `http:` and `https:` are allowed (relative URLs resolve against the page). With no `fallbackUrl`, or one that fails validation, the wrapper counts as unsupported and `open()` reports the error to `onError` and rejects.
2. **`none` (default)**: Disables the fallback entirely. When nothing can open (no Document PiP, and the content isn't a single `<video>` that can use video PiP), `<PipTrigger>` renders its `renderUnsupported` content instead of a button (nothing, if you don't pass it). Opening also logs a `pip-it-up:` warning.

---

## How "new-tab" Fallback Works Under the Hood

### The Technical Constraint
In standard web browsers, a "new tab" opened via `window.open()` runs in a **completely distinct window context** (new page load, separate Javascript execution heap, and separate React reconciler root). 

This is fundamentally different from the native **Document Picture-in-Picture API**, which opens a lightweight window that *shares the same Javascript context* as the parent tab, allowing live DOM nodes to be physically migrated and React state/Portals to remain fully connected.

Therefore, you **cannot** dynamically "move" or portal live React state and DOM nodes directly across tabs. 

### Implementation Guide
To use the `new-tab` fallback successfully:
1. **Provide a `fallbackUrl`**: You must pass the route of a page that is designed to render your component in a standalone/clean layout (e.g., `fallbackUrl="/widgets/my-widget"`).
2. **Handle State Syncing (Optional)**: If the main tab and the new fallback tab need to synchronize state (e.g., video play/pause or editor text changes), you should use standard browser cross-tab communication APIs:
   - **`BroadcastChannel` API** (Recommended)
   - **`localStorage` Events** (`window.addEventListener('storage', ...)`)
   - **Shared Workers**

---

## Custom Unsupported UI

When nothing can open for that wrapper (no Document PiP, no single-`<video>` fallback, and `fallback` is `"none"`, the default, or `"new-tab"` without a valid `fallbackUrl`), `<PipTrigger>` shows `renderUnsupported` instead of the button:

```tsx
<PipTrigger
  renderUnsupported={<span className="text-gray-500">PiP not supported on this browser</span>}
>
  Toggle PiP
</PipTrigger>
```

`<PipTrigger>` renders the `<button>` itself; its children are the label. To use your own button
element, pass `asChild` with exactly one child: `<PipTrigger asChild><button className="btn">Toggle PiP</button></PipTrigger>`.
