'use client';

import { useEffect, useState } from 'react';
import { PipTrigger, PipWrapper } from '@pip-it-up/react';

function Counter() {
  const [n, setN] = useState(0);
  return (
    <button type="button" onClick={() => setN(n + 1)}>
      Count: {n}
    </button>
  );
}

/** Server-rendered <PipWrapper>: the status flips to "Hydrated" once React has taken over. */
export function SsrDemo() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return (
    <>
      <p role="status">{hydrated ? 'Hydrated' : 'Server HTML'}</p>
      <PipWrapper>
        <section aria-label="SSR content">
          <h2>SSR content</h2>
          <Counter />
          <PipTrigger />
        </section>
      </PipWrapper>
      <p>Content below</p>
    </>
  );
}
