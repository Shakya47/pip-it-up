'use client';

import { useEffect, useMemo, useState } from 'react';
import { PipAnchor, PipProvider, PipTrigger, useDormancy } from '@pip-it-up/react';

function Widget() {
  const { placement } = useDormancy();
  const [n, setN] = useState(0);
  return (
    <section aria-label="Persistent widget">
      <h2>Persistent widget</h2>
      <p>Placement: {placement}</p>
      <button type="button" onClick={() => setN(n + 1)}>
        Count: {n}
      </button>
    </section>
  );
}

/** Server-rendered <PipProvider> + <PipAnchor>. */
export function PersistDemo() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const registry = useMemo(() => ({ widget: <Widget /> }), []);
  return (
    <PipProvider registry={registry}>
      <p role="status">{hydrated ? 'Hydrated' : 'Server HTML'}</p>
      <PipTrigger pipId="widget" />
      <PipAnchor id="widget" placeholder={<p>Widget is away</p>} />
      <p>Content below</p>
    </PipProvider>
  );
}
