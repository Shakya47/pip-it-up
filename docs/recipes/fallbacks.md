# Fallbacks

Not all browsers support the Document Picture-in-Picture API natively (e.g., Safari, Firefox). `pip-it-up` provides graceful fallbacks.

## Fallback Modes

You can control fallback behavior using the `fallback` prop:

```tsx
<PipWrapper fallback="new-tab">
  {/* Content */}
</PipWrapper>
```

### Options

1. **`new-tab` (Default)**: Opens the content in a new popup window (`window.open`). This behaves similarly to PiP but without the "always on top" guarantee. 
2. **`modal`**: Renders the content in a full-screen, centered modal overlay inside the original window. Useful if you want to emphasize the content without leaving the browser tab.
3. **`none`**: Disables the fallback entirely. If PiP is unsupported, the `<PipTrigger>` does nothing (or you can use the `renderUnsupported` prop on the trigger to hide it).

## Custom Unsupported UI

If you want to hide or change the trigger when PiP is unsupported (and you've set `fallback="none"`), use `renderUnsupported`:

```tsx
<PipTrigger 
  renderUnsupported={<span className="text-gray-500">PiP not supported on this browser</span>}
>
  <button>Toggle PiP</button>
</PipTrigger>
```
