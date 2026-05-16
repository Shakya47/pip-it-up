# @pip-it-up/react

React bindings for `pip-it-up` — the **Document Picture-in-Picture** engine.

## What is Document Picture-in-Picture?

The [Document Picture-in-Picture API](https://developer.mozilla.org/en-US/docs/Web/API/Document_Picture-in-Picture_API) is a new browser capability that allows you to open a floating window that can be populated with any arbitrary HTML content, rather than just a video element. 

`@pip-it-up/react` makes it trivial to use this API in React applications with familiar patterns like Portals, Hooks, and Controlled Components.

## Installation

```bash
npm install @pip-it-up/react @pip-it-up/core
```

## Components

### `<PipWrapper>`

Wraps the content you want to move into the **Picture-in-Picture** window. 

#### Uncontrolled (Default)
```tsx
<PipWrapper>
  <div>Content to move</div>
  <PipTrigger>Toggle</PipTrigger>
</PipWrapper>
```

#### Controlled
```tsx
const [isOpen, setIsOpen] = useState(false);

<PipWrapper open={isOpen} onOpenChange={setIsOpen}>
  <div>Content to move</div>
</PipWrapper>
```

#### Props

Supports all `PipOptions` from `@pip-it-up/core`, including:

- **`width` / `height`** (number, optional): If provided, forces the PiP window to these dimensions. **If omitted, the library uses a `ResizeObserver` to automatically match the component's exact size on the page.**
- **`mode`** (`"move" | "portal"`, default: `"move"`): 
  - In this React package, both `"move"` and `"portal"` utilize **React Portals** to move content safely between windows. They behave identically: a placeholder is left in the original spot, and the component stays in the same React tree.
- **`copyStyles`** (`"sync" | "once" | false`, default: `"sync"`): 
  - `"sync"`: Real-time synchronization of CSS changes (MutationObserver).
  - `"once"`: One-time copy at window open.
- **`reserveSpace`** (boolean, default: `true`): Whether to show a placeholder in the original position to prevent layout jumps.
- **`placeholder`** (ReactNode): Custom component to show in the placeholder area.
- **`centerInPip`** (boolean, default: `false`): Automatically centers your content in the PiP window.
- **`open`** (boolean): Controlled state for the window.
- **`onOpenChange`** (callback): Fired when the window opens or closes.

### `<PipTrigger>`

A button that toggles the **Picture-in-Picture** window.

```tsx
<PipTrigger asChild>
  <button className="my-custom-btn">Open Picture-in-Picture</button>
</PipTrigger>
```

## Hooks

### `usePip()`
Returns the context state for managing the **Picture-in-Picture** lifecycle.
```tsx
const { isOpen, pipWindow, instance, isInsidePip } = usePip();
```
- **`isOpen`**: Boolean indicating if the PiP window is open.
- **`pipWindow`**: The native `Window` object of the PiP instance (null if closed).
- **`isInsidePip`**: Boolean that is `true` only when the component is being rendered inside the PiP window.
- **`instance`**: The underlying `@pip-it-up/core` instance.

> [!NOTE]
> `usePipContext()` is also available if you only need the raw context without the extra convenience properties of `usePip()`.

### `useIsPipSupported()`
Returns `true` if the browser natively supports the **Document Picture-in-Picture API**.
```tsx
const isSupported = useIsPipSupported();
```

## Tips & Gotchas

### CSS Inheritance
The Picture-in-Picture window is a separate document. While `@pip-it-up` automatically copies stylesheets and `body`/`html` classes, your content will **not** inherit styles from parent elements outside the `<PipWrapper>` (like a `#root` div or a theme provider). 
*   **Fix**: Add necessary alignment or theme classes (e.g., `text-center`, `dark`) directly to the content inside the `<PipWrapper>`.

### Complex Editors (Monaco, TipTap, Canvas)
Editors that bind to the `document` object at initialization may break when moved to a new window.
*   **Fix 1**: Force a remount of the editor when moving to PiP by using the `isInsidePip` state as a React `key`.
*   **Fix 2**: Lift your editor state (content, cursors, etc.) **above** the `<PipWrapper>`. Since the wrapper unmounts and remounts its children when moving them into the PiP window, any state stored *inside* the wrapper will be lost during the transition.

```tsx
const [content, setContent] = useState("");

return (
  <PipWrapper>
    <RichTextEditor 
      key={isInsidePip ? 'pip' : 'main'} 
      value={content} 
      onChange={setContent} 
    />
  </PipWrapper>
);
```

## Next.js / SSR
Because the **Document Picture-in-Picture API** is browser-only, ensure components interacting with it are rendered on the client (`"use client"`).
