# Tailwind CSS Integration

`pip-it-up` synchronizes your main window's stylesheets with the PiP window automatically. If you use Tailwind CSS, those styles will carry over.

## Configuration

For best results with Tailwind (and most CSS-in-JS libraries), you should use the default `copyStyles="sync"` setting. 

```tsx
<PipWrapper mode="move" copyStyles="sync">
  <div className="bg-blue-500 text-white p-4 rounded-lg shadow-lg">
    <h2 className="text-xl font-bold">Tailwind works in PiP!</h2>
    <PipTrigger>
      <button className="mt-4 bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded">
        Pop Out
      </button>
    </PipTrigger>
  </div>
</PipWrapper>
```

## How It Works

- When the window opens, `pip-it-up` clones all `<style>` and `<link rel="stylesheet">` tags from the main `document.head` to the PiP window's `document.head`.
- A `MutationObserver` watches the main window's head. If Tailwind (or Next.js during HMR) injects new styles, they are instantly synchronized to the PiP window.

## Limitations

- If your Tailwind styles depend on a class applied to `<html>` or `<body>` (like `.dark`), you need to manually sync that attribute. Use `onPipWindowReady` to copy `document.documentElement.className`.
