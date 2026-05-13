# @pip-it-up/core

The vanilla JavaScript engine for the Document Picture-in-Picture API.

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
  contentEl,
  originEl,
  mode: 'move', // 'move', 'clone', or 'portal'
  copyStyles: 'sync', // 'sync', 'once', or false
  fallback: 'new-tab' // 'new-tab', 'modal', or 'none'
});

pip.open().then(() => {
  console.log('PiP opened!');
});
```

## API

### `createPip(options: PipOptions): PipInstance`

Creates a new PiP instance.

#### `PipOptions`
- `contentEl`: The DOM element to move/clone into the PiP window.
- `originEl`: The placeholder element in the main window to return the content to when closed (required for `mode: 'move'`).
- `mode`: `'move'` (default), `'clone'`, or `'portal'`.
- `copyStyles`: `'sync'` (default), `'once'`, or `false`.
- `fallback`: `'new-tab'` (default), `'modal'`, or `'none'`.
- `width` / `height`: Initial dimensions.
- `lockAspectRatio`: Keep the window's aspect ratio fixed.
- `fixedSize`: Prevent manual resizing.
- `onPipWindowReady`: Callback fired when the window is fully prepared.

#### `PipInstance`
- `open()`: Requests and opens the PiP window.
- `close()`: Closes the PiP window.
- `toggle()`: Toggles the window state.
- `isOpen()`: Returns boolean.
- `getPipWindow()`: Returns the Window object or null.
- `getState()`: Returns the current state.
- `destroy()`: Cleans up listeners and DOM.

### `getPip(id: string): PipInstance | undefined`
Retrieves a created PiP instance by ID.
