# Fallbacks

Not all browsers support the Document Picture-in-Picture API natively (e.g., Safari, Firefox). `pip-it-up` provides graceful fallbacks.

## Fallback Modes

You can control fallback behavior using the `fallback` and `fallbackUrl` props:

```tsx
<PipWrapper fallback="new-tab" fallbackUrl="/pip-standalone-view">
  {/* Content */}
</PipWrapper>
```

### Options

1. **`new-tab` (Default)**: Opens a new browser tab/popup at the route specified by the `fallbackUrl` prop using `window.open(fallbackUrl, '_blank')`.
2. **`none`**: Disables the fallback entirely. If PiP is unsupported, the `<PipTrigger>` does nothing (or you can use the `renderUnsupported` prop on the trigger to hide/replace it).

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

If you want to hide or change the trigger when PiP is unsupported (and you've set `fallback="none"`), use `renderUnsupported`:

```tsx
<PipTrigger 
  renderUnsupported={<span className="text-gray-500">PiP not supported on this browser</span>}
>
  <button>Toggle PiP</button>
</PipTrigger>
```
