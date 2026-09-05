import { useEffect, useLayoutEffect } from 'react';

/**
 * `useLayoutEffect` on the client, `useEffect` on the server.
 *
 * React logs a warning when `useLayoutEffect` runs during a server render, because its effect
 * cannot be encoded into the server renderer's output. Selecting `useEffect` when `window` is
 * absent suppresses that while preserving synchronous, pre-paint timing in the browser - which
 * every DOM placement and layout-reservation effect in this package depends on.
 *
 * Note: in a jsdom test environment `window` IS defined, so this resolves to `useLayoutEffect`
 * even under `renderToString`. The server-only branch is therefore exercised in real Node SSR,
 * not in the test suite.
 */
export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;
