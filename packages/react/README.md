# @pip-it-up/react

React bindings for the `pip-it-up` engine.

## Installation

```bash
npm install @pip-it-up/react @pip-it-up/core
```

## Components

### `<PipWrapper>`

Wraps the content you want to move into the PiP window. 

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
Supports all `PipOptions` from `@pip-it-up/core` (`mode`, `copyStyles`, `fallback`, etc.), plus:
- `open`: Controlled boolean state.
- `onOpenChange`: Callback for controlled state.
- `defaultOpen`: Initial uncontrolled state.

### `<PipTrigger>`

A button that toggles the PiP window.

```tsx
<PipTrigger asChild>
  <button className="my-custom-btn">Open PiP</button>
</PipTrigger>
```

## Hooks

### `usePip()`
Returns the context state.
```tsx
const { isOpen, pipWindow, instance } = usePip();
```

### `useIsPipSupported()`
Returns boolean if the browser natively supports Document PiP.
```tsx
const isSupported = useIsPipSupported();
```

## Next.js / SSR
Because the Document PiP API is browser-only, ensure components interacting with it are rendered on the client (`"use client"`).
