# @pip-it-up/core

The framework-agnostic JavaScript engine for the **Document Picture-in-Picture API**.

`@pip-it-up/core` provides a robust, framework-agnostic way to manage the lifecycle of **Picture-in-Picture** windows, including style synchronization, element positioning, and keyboard event bridging.

## Installation

```bash
npm install @pip-it-up/core
```

## Usage

```javascript
import { createPip } from '@pip-it-up/core';

const contentEl = document.getElementById('my-content');
const originEl = document.getElementById('my-placeholder');

const pip = createPip({
  mode: 'move', // 'move', 'clone', or 'portal'
  copyStyles: 'sync', // 'sync', 'once', or false
  fallback: 'new-tab' // 'new-tab' or 'none'
});

// Elements are passed to the open call
pip.open({ contentEl, originEl }).then(() => {
  console.log('Picture-in-Picture window opened!');
});
```

## API

### `createPip(options: PipOptions): PipInstance`

Creates a new **Picture-in-Picture** instance.

#### `PipOptions`
- `mode`: `'move'` (default), `'clone'`, or `'portal'`.
- `copyStyles`: `'sync'` (default), `'once'`, or `false`.
- `fallback`: `'new-tab'` (default) or `'none'`.
- `width` / `height`: Initial dimensions. If not provided, they are inferred from the element passed to `open()`.
- `lockAspectRatio`: Keep the window's aspect ratio fixed.
- `fixedSize`: Prevent manual resizing.
- `reserveSpace`: Preserve the layout in the main window when `mode: 'move'` (default: `true`).
- `centerInPip`: Centering the content inside the window via flexbox (default: `false`).
- `pipBodyStyles`: Custom styles for the PiP window's `<body>`.
- `onPipWindowReady`: Callback fired when the window is fully prepared.

#### `PipInstance`
- `open({ contentEl?, originEl? })`: Requests and opens the **Picture-in-Picture** window.
- `close()`: Closes the window.
- `toggle({ contentEl?, originEl? })`: Toggles the window state.
- `isOpen()`: Returns boolean.
- `getPipWindow()`: Returns the Window object or null.
- `getState()`: Returns the current state.
- `destroy()`: Cleans up listeners and DOM.

### `getPip(id: string): PipInstance | null`
Retrieves a created **Picture-in-Picture** instance by ID from the global registry.
