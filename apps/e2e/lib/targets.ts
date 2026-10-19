import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const E2E_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = path.resolve(E2E_ROOT, '../..');

/**
 * Every app the suite drives, from lib/targets.json (shared with scripts/dev-server.mjs).
 *
 * A target is served on a fixed port, so a project always knows its URL. `dir` is the app's folder
 * (repo-relative); the dev-server script runs its own `node_modules/.bin/<server>` there and
 * timestamps the output into `logs/<name>.log`. Vite targets get `--port <port> --strictPort`, so
 * two of them can never swap ports silently. `next dev` has no strictPort flag: it gets
 * `--port <port>` only, and a taken port is left to Next.js's own handling (Playwright then waits
 * on, or with reuseExistingServer reuses, whatever answers on that port). `tests` are the globs (under `tests/`) its
 * projects run. `extensions` are optional contract extensions it implements (`persist`: the
 * route-persistent specs, tag `@ext-persist`).
 *
 * - playground: the real app (MANUAL_SMOKE).
 * - vanilla: the contract on createPip() directly; the reference target, run in every browser.
 * - react: the contract on @pip-it-up/react (React 19, StrictMode) plus React-only specs.
 * - next: Next.js App Router. The React contract client-only at `/`, plus server-rendered pages for
 *   the SSR / hydration specs (tests/ssr).
 * A new binding adds an entry here and an `apps/e2e-<framework>` app implementing the contract.
 */
export type TargetName = 'playground' | 'vanilla' | 'react' | 'next';
export type Extension = 'persist';

/** `server`: how dev-server.mjs starts it. Default `vite` (`vite --port <port> --strictPort`); `next` runs `next dev --port <port>` (no strictPort). */
export type Target = { name: TargetName; dir: string; port: number; server?: 'vite' | 'next'; tests: string[]; extensions: Extension[] };

const raw = JSON.parse(fs.readFileSync(path.join(E2E_ROOT, 'lib', 'targets.json'), 'utf8')) as Record<
  TargetName,
  Omit<Target, 'name'>
>;

export const TARGETS = Object.fromEntries(
  Object.entries(raw).map(([name, t]) => [name, { name, ...t }]),
) as Record<TargetName, Target>;

export const targetURL = (target: Target) => `http://localhost:${target.port}`;
