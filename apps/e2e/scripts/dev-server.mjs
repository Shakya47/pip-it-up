#!/usr/bin/env node
// Start the dev server of one or more e2e targets (lib/targets.json), each with every output
// line timestamped into apps/e2e/logs/<target>.log, so failing tests and bug reports can pull
// the server-side lines from the moment a test failed.
//
//   pnpm e2e:server               # every target; agents: run it in the background, keep it running
//   pnpm e2e:server playground    # just one
//
// Playwright's webServer runs this same script (one target each) when nothing is listening on a
// target's port yet. The previous log is kept as <target>.prev.log.
//
// The targets import @pip-it-up/* from their built dist/, so locally this builds the packages
// first (turbo, cached: about a second when nothing changed), and a server never starts on stale
// code. After changing library code while it runs, rebuild (`pnpm build`) or keep
// `pnpm --filter "./packages/*" dev` running. `--no-build` (Playwright's webServer passes it: the
// config builds once for all servers) and CI (its own build step) only build when dist/ is missing.

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const E2E_ROOT = path.resolve(import.meta.dirname, '..');
const REPO_ROOT = path.resolve(E2E_ROOT, '../..');
const LOG_DIR = path.join(E2E_ROOT, 'logs');
const TARGETS = JSON.parse(fs.readFileSync(path.join(E2E_ROOT, 'lib', 'targets.json'), 'utf8'));

const requested = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const names = requested.length ? requested : Object.keys(TARGETS);
for (const name of names) {
  if (!TARGETS[name]) {
    console.error(`Unknown target "${name}". Known: ${Object.keys(TARGETS).join(', ')}`);
    process.exit(1);
  }
}

const missingDist = ['core', 'react'].filter((p) => !fs.existsSync(path.join(REPO_ROOT, 'packages', p, 'dist', 'index.mjs')));
const skipBuild = process.argv.includes('--no-build') || !!process.env.CI || !!process.env.E2E_SKIP_BUILD;
if (missingDist.length || !skipBuild) {
  console.log(
    missingDist.length
      ? `[e2e] packages/${missingDist.join(', packages/')} not built yet; building the packages first`
      : '[e2e] building the packages (turbo, cached) so the targets serve current code',
  );
  const built = spawnSync('pnpm', ['exec', 'turbo', 'run', 'build', '--filter=./packages/*', '--output-logs=errors-only'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
  if (built.status !== 0) process.exit(built.status ?? 1);
}

fs.mkdirSync(LOG_DIR, { recursive: true });

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;

function pipe(stream, out, log, label) {
  let pending = '';
  stream.on('data', (chunk) => {
    out.write(chunk);
    pending += chunk.toString();
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? '';
    for (const line of lines) {
      const clean = line.replace(ANSI, '');
      if (clean.trim()) log.write(`${new Date().toISOString()} ${label} ${clean}\n`);
    }
  });
}

// Vite runs as a DIRECT child in this script's process group (not `detached`, not via `pnpm exec`).
// Playwright stops a webServer by signalling its process group; a detached child escaped that,
// outlived the run, was silently reused by the next run (`reuseExistingServer`), and crashed on
// EPIPE the first time it forwarded a browser console message to its dead stdout.
const children = [];
for (const name of names) {
  const { dir, port, server = 'vite' } = TARGETS[name];
  const cwd = path.join(REPO_ROOT, dir);
  const bin = path.join(cwd, 'node_modules', '.bin', server);
  if (!fs.existsSync(bin)) {
    console.error(`[e2e] ${name}: no ${path.relative(REPO_ROOT, bin)}. Run \`pnpm install\` first.`);
    process.exit(1);
  }
  const logFile = path.join(LOG_DIR, `${name}.log`);
  if (fs.existsSync(logFile)) fs.renameSync(logFile, path.join(LOG_DIR, `${name}.prev.log`));
  const log = fs.createWriteStream(logFile, { flags: 'a' });
  const args = server === 'next' ? ['dev', '--port', String(port)] : ['--port', String(port), '--strictPort'];
  log.write(`${new Date().toISOString()} [e2e] starting "${server} ${args.join(' ')}" in ${dir}\n`);
  const child = spawn(bin, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  pipe(child.stdout, process.stdout, log, '[out]');
  pipe(child.stderr, process.stderr, log, '[err]');
  child.on('exit', (code, signal) => {
    log.write(`${new Date().toISOString()} [e2e] ${name} dev server exited (${signal ?? `code ${code}`})\n`);
    log.end();
    // One target dying takes the rest down, so Playwright notices instead of timing out.
    stopAll('SIGTERM');
    if (children.every((c) => c.exitCode !== null || c.signalCode !== null)) process.exit(code ?? 0);
  });
  children.push(child);
}

function stopAll(signal) {
  for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill(signal);
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => stopAll(signal));
process.on('exit', () => stopAll('SIGTERM'));
// Never write to a closed stdout (Playwright or the terminal went away): just stop.
process.stdout.on('error', () => stopAll('SIGTERM'));
process.stderr.on('error', () => stopAll('SIGTERM'));
