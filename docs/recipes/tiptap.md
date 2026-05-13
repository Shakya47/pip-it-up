# Tiptap Integration

When moving a rich text editor like Tiptap into a Picture-in-Picture window, the DOM nodes are physically relocated. Tiptap relies on ProseMirror, which is generally robust to node relocation but might need to be re-focused or have its internal layout updated if dimensions change abruptly.

## Example

```tsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { PipWrapper, PipTrigger } from '@pip-it-up/react';

export default function TiptapDemo() {
  const editor = useEditor({
    extensions: [StarterKit],
    content: '<p>Hello World!</p>',
  });

  return (
    <PipWrapper
      mode="move"
      onPipWindowReady={(pipWindow) => {
        // Optional: Re-focus the editor when it moves to the new window
        if (editor && !editor.isFocused) {
          editor.commands.focus();
        }
      }}
    >
      <div className="editor-container">
        <EditorContent editor={editor} />
        <PipTrigger>
          <button>Pop out Editor</button>
        </PipTrigger>
      </div>
    </PipWrapper>
  );
}
```

## Key Considerations

1. **`mode="move"` vs `mode="portal"`**: `move` physically relocates the Tiptap DOM nodes. If Tiptap loses its state upon unmount, consider using `mode="portal"` so React portals the content instead of doing direct DOM manipulation, preserving React's synthetic event state perfectly.
2. **Focus Management**: The editor might lose focus during the transition. Use `onPipWindowReady` to automatically refocus.
