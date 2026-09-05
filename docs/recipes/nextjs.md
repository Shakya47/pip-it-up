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

## Route-Persistent PiP (App Router)

`<PipWrapper>` is scoped to the component that renders it, so an App Router navigation unmounts it
and closes any open PiP window. To keep a widget alive across navigation, host it once in the root
layout with `<PipProvider>` and give it a docking slot with `<PipAnchor>`.

The work is confined to **two files**. Every other route is untouched.

### 1. Host the widget in the root layout

```tsx
// app/providers.tsx
"use client"

import { PipProvider } from '@pip-it-up/react';
import { LiveTracker } from '@/components/LiveTracker';

// Defined at module scope so it is referentially stable across renders.
const registry = { tracker: <LiveTracker /> };

export function Providers({ children }: { children: React.ReactNode }) {
  return <PipProvider registry={registry}>{children}</PipProvider>;
}
```

```tsx
// app/layout.tsx  — stays a Server Component
import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

The provider must sit **above** the route segments it serves — that is the whole mechanism. Putting
it inside a route group defeats the purpose, because the group unmounts on navigation out of it.

### 2. Give it a slot on the one page that owns it

```tsx
// app/dashboard/page.tsx
"use client"

import { PipAnchor, PipTrigger } from '@pip-it-up/react';

export default function DashboardPage() {
  return (
    <main>
      <header>
        <h1>Dashboard</h1>
        <PipTrigger pipId="tracker">Pop out</PipTrigger>
      </header>

      <PipAnchor
        id="tracker"
        placeholder={<div className="grid place-items-center">📺 In PiP</div>}
      />

      <section>Everything below the anchor stays put when the tracker pops out.</section>
    </main>
  );
}
```

`app/reports/page.tsx`, `app/settings/page.tsx` and the rest need **no changes at all** — no anchor,
no placeholder, not even an import. Navigate to them with the tracker popped out and the window keeps
floating above them.

### What happens on navigation

| Action | Result |
| :--- | :--- |
| Pop out on `/dashboard` | window opens, the anchor holds its measured box |
| Navigate to `/reports` | the anchor unmounts; the PiP window **stays open** |
| Close the window while on `/reports` | the widget parks out of sight, still alive, keeping its state |
| Navigate back to `/dashboard` | it re-docks into the anchor **automatically** — no restore step |

### Server rendering

`<PipProvider>` and `<PipAnchor>` are SSR-safe and need no `dynamic(..., { ssr: false })` wrapper:

- On the server the provider renders only its `children` — no portals, no DOM access.
- Anchors render their box and placeholder, so the server HTML has the right shape and size.
- The hosted subtrees attach on the client after hydration.

Both passes produce identical markup, so there is no hydration mismatch. Only the `"use client"`
boundary is required, because the hooks and DOM work are client-side.

### Throttling a parked widget

While parked, the widget is invisible but still mounted, so unthrottled work would burn CPU for a
route nobody is looking at. Use the dormancy hooks inside it:

```tsx
"use client"

import { useDormancy, useAdaptiveInterval, useActiveEffect } from '@pip-it-up/react';

export function LiveTracker() {
  const { level } = useDormancy();

  // 1s docked, 15s when the tab is hidden, 60s when parked, off when frozen.
  useAdaptiveInterval(() => refetch());

  // Only holds the socket while genuinely active.
  useActiveEffect(() => {
    const socket = subscribe();
    return () => socket.close();
  }, []);

  return <div data-level={level}>{/* ... */}</div>;
}
```

### React Router / TanStack Router

Identical, because the mechanism is only that a route change unmounts one `<PipAnchor>` and mounts
another. Put `<PipProvider>` above `<Routes>` (or above your router outlet) and render the anchor in
the one route that owns the widget.
