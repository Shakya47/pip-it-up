/**
 * flows/packaging.md PK5: the packed tarballs work for a real consumer OUTSIDE the workspace.
 * `pnpm pack` core and react, `npm install` them with react, react-dom and vite into a fresh temp
 * folder (no workspace links, no hoisting help), `vite build`, serve the build, and open a real PiP
 * window through the published API. Slow (an npm install from the registry, ~40 MB): its project
 * only exists with E2E_TARBALL=1 (and in full CI runs: push to main, manual).
 * Plain @playwright/test: the suite fixtures assume a workspace target.
 */
import { test, expect } from '@playwright/test';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REPO_ROOT } from '../lib/targets';

const PORT = 5190;
let dir = '';
let server: ChildProcess | null = null;

const APP = {
  'index.html': `<!doctype html><html><head><meta charset="UTF-8"><link rel="icon" href="data:,"><title>tarball consumer</title></head>
<body><main id="app"></main><script type="module" src="/src/main.jsx"></script></body></html>`,
  'vite.config.js': `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()] });\n`,
  'src/main.jsx': `import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PipWrapper, PipTrigger } from '@pip-it-up/react';
import { isSupported } from '@pip-it-up/core';

function Counter() {
  const [n, setN] = useState(0);
  return <button type="button" onClick={() => setN(n + 1)}>Count: {n}</button>;
}

createRoot(document.getElementById('app')).render(
  <StrictMode>
    <p>Core says supported: {String(isSupported())}</p>
    <PipWrapper>
      <section aria-label="Packed content">
        <h2>Packed content</h2>
        <Counter />
        <PipTrigger />
      </section>
    </PipWrapper>
  </StrictMode>,
);
`,
};

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(300_000);
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pip-tarball-consumer-'));
  const tarballs: Record<string, string> = {};
  for (const pkg of ['core', 'react']) {
    const out = execFileSync('pnpm', ['pack', '--pack-destination', dir], { cwd: path.join(REPO_ROOT, 'packages', pkg), encoding: 'utf8' });
    tarballs[`@pip-it-up/${pkg}`] = `file:./${path.basename(out.trim().split('\n').pop()!)}`;
  }
  const manifest = {
    name: 'pip-it-up-tarball-consumer',
    private: true,
    type: 'module',
    dependencies: { ...tarballs, react: '^19.2.6', 'react-dom': '^19.2.6' },
    devDependencies: { vite: '^8.0.12', '@vitejs/plugin-react': '^6.0.1' },
  };
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(manifest, null, 2));
  for (const [file, body] of Object.entries(APP)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), body);
  }
  execFileSync('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: dir, stdio: 'pipe' });
  execFileSync('npx', ['vite', 'build'], { cwd: dir, stdio: 'pipe' });
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: dir, stdio: 'ignore' });
  await expect
    .poll(() => fetch(`http://localhost:${PORT}/`).then((r) => r.ok, () => false), { timeout: 30_000, message: 'vite preview up' })
    .toBe(true);
});

test.afterAll(() => {
  server?.kill('SIGTERM');
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

test('PK5 a consumer app built from the packed tarballs opens a real PiP window and keeps its state', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => (m.type() === 'error' || /\[pip-it-up\]/.test(m.text())) && problems.push(`${m.type()}: ${m.text()}`));
  await page.goto(`http://localhost:${PORT}/`);
  await expect(page.getByText('Core says supported: true')).toBeVisible();
  const region = page.getByRole('region', { name: 'Packed content' });
  await region.getByRole('button', { name: 'Count: 0' }).click();

  const [pip] = await Promise.all([page.waitForEvent('popup'), region.getByRole('button', { name: '↗ Pop out' }).click()]);

  await expect(pip.getByRole('region', { name: 'Packed content' }).getByRole('button', { name: 'Count: 1' })).toBeVisible();
  await pip.close();
  await expect(region.getByRole('button', { name: 'Count: 1' })).toBeVisible();
  expect(problems).toEqual([]);
});
