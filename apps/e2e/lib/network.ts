import type { BrowserContext } from '@playwright/test';

/**
 * Keep runs deterministic and polite. Routes are set on the CONTEXT so they also cover requests
 * made from a Document PiP window (the Leaflet map loads tiles from inside it once popped out).
 *
 * - OpenStreetMap tiles: stubbed. OSM's tile policy forbids automated heavy use, and the tests
 *   only need Leaflet's own state (center, zoom, marker), not real imagery.
 * - The CodeSandbox badge in the playground header: stubbed, it's decoration.
 * - Monaco loads from cdn.jsdelivr.net (the `@monaco-editor/react` default loader). That is left
 *   live: tests that depend on it are tagged `@network`.
 */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const SVG_EMPTY = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';

export async function stubExternal(context: BrowserContext) {
  await context.route(/^https:\/\/([a-c]\.)?tile\.openstreetmap\.org\//, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1X1 }),
  );
  await context.route(/^https:\/\/codesandbox\.io\//, (route) =>
    route.fulfill({ status: 200, contentType: 'image/svg+xml', body: SVG_EMPTY }),
  );
}
