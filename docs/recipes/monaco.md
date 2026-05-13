# Monaco Editor Integration

Monaco Editor explicitly calculates layout dimensions based on its container. When moved to a new window, it must be told to recalculate its layout, otherwise it might appear blank or misaligned.

## Example

```tsx
import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { PipWrapper, PipTrigger } from '@pip-it-up/react';

export default function MonacoDemo() {
  const [editor, setEditor] = useState<any>(null);

  const handleEditorDidMount = (editorInstance) => {
    setEditor(editorInstance);
  };

  return (
    <PipWrapper
      mode="move"
      onPipWindowReady={(pipWindow) => {
        // CRITICAL: Monaco needs to recalculate its layout after being moved
        if (editor) {
          editor.layout();
        }
      }}
    >
      <div style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
        <Editor
          height="100%"
          defaultLanguage="javascript"
          defaultValue="// Write code here"
          onMount={handleEditorDidMount}
        />
        <PipTrigger>
          <button>Pop out Editor</button>
        </PipTrigger>
      </div>
    </PipWrapper>
  );
}
```

## Key Considerations

1. **Layout Update**: You **must** call `editor.layout()` inside `onPipWindowReady`.
2. **Container Height**: Ensure the Monaco container has a defined height (like `100%`) so it fills the PiP window properly.
