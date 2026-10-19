# Monaco Editor Integration

Monaco works inside `<PipWrapper>` with no workaround. The editor's DOM node, its model, cursor, scroll
position and undo history are the same objects before and after the pop-out: `<PipWrapper>` moves the
node, it never remounts it. Turn on `automaticLayout` so Monaco relayouts itself when the PiP window
resizes it.

## Example

```tsx
import Editor from '@monaco-editor/react';
import { PipWrapper, PipTrigger } from '@pip-it-up/react';

export default function MonacoDemo() {
  return (
    <PipWrapper>
      <div style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
        <PipTrigger>Pop out editor</PipTrigger>
        <Editor
          height="100%"
          defaultLanguage="javascript"
          defaultValue="// Write code here"
          options={{ automaticLayout: true }}
        />
      </div>
    </PipWrapper>
  );
}
```

## Key considerations

1. **`automaticLayout: true`**: Monaco's own ResizeObserver keeps working after the move, so no
   `editor.layout()` call is needed.
2. **Container height**: give the editor's container a real height so it fills the PiP window.
3. **Keyboard shortcuts don't fire inside the PiP window.** Typing works, and the undo history is
   intact, but Monaco's keybindings (Cmd/Ctrl+Z, Cmd/Ctrl+F, …) do nothing while the editor is in PiP:
   Monaco decides whether the editor has focus by looking at the main window's `document`, which
   doesn't contain the PiP window's focused element. If you need them there, add controls that call
   the command directly, for example `editor.trigger('pip', 'undo', null)` (and `'redo'`); that runs
   against the same history. Verified in Chrome and Firefox by the e2e suite (apps/e2e/flows/media-editors.md, ME2 and ME4).
