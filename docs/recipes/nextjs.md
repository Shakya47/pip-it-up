# Next.js Integration

The Document Picture-in-Picture API is a browser-only feature. Attempting to use it on the server (during SSR) will result in errors.

## Usage in App Router

When using App Router, you must mark any component that renders `<PipWrapper>` or `<PipTrigger>` with `"use client"`.

```tsx
"use client"

import { PipWrapper, PipTrigger } from '@pip-it-up/react';

export default function VideoPlayer() {
  return (
    <PipWrapper>
      <video src="/my-video.mp4" controls />
      <PipTrigger>Pop Out</PipTrigger>
    </PipWrapper>
  );
}
```

## Hydration Mismatches

If you try to dynamically render PiP-specific UI only when the API is supported, you might encounter hydration mismatches. Use a standard `useEffect` mount pattern to avoid this:

```tsx
"use client"

import { useEffect, useState } from 'react';
import { useIsPipSupported } from '@pip-it-up/react';

export default function ClientOnlyButton() {
  const [mounted, setMounted] = useState(false);
  const isSupported = useIsPipSupported();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  if (!isSupported) return <span>PiP Not Supported</span>;

  return <button>Open PiP</button>;
}
```
