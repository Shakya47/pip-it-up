# Keyboard Shortcuts

Keys pressed inside the Picture-in-Picture window happen in a different document, so they never reach
listeners on your page by themselves. pip-it-up forwards them for you: `forwardKeyboardEvents` is **on
by default**, so shortcuts registered on `window` (`window.addEventListener('keydown', …)`) keep
working while the user types in the PiP window. A shortcut library that listens on `document` does
not receive them; register it on `window` instead.

## Usage

Nothing to configure:

```tsx
<PipWrapper>
  <div>
    <h2>Press Cmd+K!</h2>
    <PipTrigger>Pop Out</PipTrigger>
  </div>
</PipWrapper>
```

Turn it off with `forwardKeyboardEvents={false}` (React) or `forwardKeyboardEvents: false` (core) if
keys should stay inside the PiP window.

## How It Works

- pip-it-up listens for `keydown` and `keyup` on the PiP **window**.
- For each real (trusted) key event it dispatches a copy (same `key`, `code`, modifiers, `repeat`) on
  your page's **`window`**. Listeners on `window` receive it; listeners on `document` or elements do
  not, because the copy starts at `window`.
- Synthetic events dispatched inside the PiP window are never forwarded.
- If your handler calls `preventDefault()` on the forwarded copy (for example a Cmd+S save shortcut),
  the original key in the PiP window is cancelled too, so the browser's own action (the Save dialog)
  doesn't run.
