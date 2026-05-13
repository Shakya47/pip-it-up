# Keyboard Shortcuts

By default, when focus is inside the Picture-in-Picture window, keyboard events triggered there do not naturally bubble up to the main window's DOM. 

If your application relies on global keyboard listeners (e.g., `window.addEventListener('keydown', ...)`), you should enable the `forwardKeyboardEvents` option.

## Usage

```tsx
<PipWrapper forwardKeyboardEvents={true}>
  <div>
    <h2>Press CMD+K!</h2>
    <PipTrigger>Pop Out</PipTrigger>
  </div>
</PipWrapper>
```

## How It Works

When `forwardKeyboardEvents` is `true`, `pip-it-up` attaches a `keydown` and `keyup` listener to the PiP window's `document`. When an event occurs, it creates a synthetic `KeyboardEvent` with identical properties (key, code, metaKey, etc.) and dispatches it directly to the main window's `document`.

This ensures that your global hotkey libraries (like `react-hotkeys-hook` or standard `useEffect` listeners) continue to work seamlessly even when the user is interacting with the PiP window.
