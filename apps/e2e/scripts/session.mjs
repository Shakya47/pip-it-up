#!/usr/bin/env node
// Open a browser on an e2e target, for exploring by hand or by an agent. Real Document PiP
// windows work here (a top-level page, not an iframe), with the same settings as the suite
// (`viewport: null`). Ported from nexus apps/e2e/scripts/session.mjs, minus the sign-in parts.
//
//   pnpm e2e:session                          # playground, Chrome, headed
//   pnpm e2e:session playground /#/dashboard
//   pnpm e2e:session playground / --browser=firefox
//
// Chromium browsers also expose DevTools on http://127.0.0.1:9222, so an agent can attach:
//   npx playwright mcp --cdp-endpoint http://127.0.0.1:9222     (or connectOverCDP from a script)
// The target's dev server must be running (`pnpm e2e:server`). Ctrl+C closes the browser.

import fs from 'node:fs';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const E2E_ROOT = path.resolve(import.meta.dirname, '..');
const TARGETS = JSON.parse(fs.readFileSync(path.join(E2E_ROOT, 'lib', 'targets.json'), 'utf8'));

const args = process.argv.slice(2);
const flag = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const [targetName = 'playground', target = '/'] = args.filter((a) => !a.startsWith('--'));
const browserName = flag('browser', 'chrome');

const t = TARGETS[targetName];
if (!t) {
  console.error(`Unknown target "${targetName}". Known: ${Object.keys(TARGETS).join(', ')}`);
  process.exit(1);
}

const LAUNCH = {
  chrome: () => chromium.launch({ channel: 'chrome', headless: false, args: ['--remote-debugging-port=9222'] }),
  msedge: () => chromium.launch({ channel: 'msedge', headless: false, args: ['--remote-debugging-port=9222'] }),
  chromium: () => chromium.launch({ channel: 'chromium', headless: false, args: ['--remote-debugging-port=9222'] }),
  firefox: () => firefox.launch({ headless: false }),
  webkit: () => webkit.launch({ headless: false }),
};
if (!LAUNCH[browserName]) {
  console.error(`Unknown browser "${browserName}". Known: ${Object.keys(LAUNCH).join(', ')}`);
  process.exit(1);
}

const url = new URL(target, `http://localhost:${t.port}`).toString();
const browser = await LAUNCH[browserName]();
const context = await browser.newContext({ viewport: null });
const page = await context.newPage();
context.on('page', (p) => console.log(`[session] new page (PiP window or popup): ${p.url()}`));
await page.goto(url);
console.log(`\nSession open: ${browserName} at ${url}`);
if (browserName !== 'firefox' && browserName !== 'webkit') console.log('DevTools endpoint: http://127.0.0.1:9222');
console.log('Ctrl+C to close.');

const close = async () => {
  await browser.close().catch(() => {});
  process.exit(0);
};
process.on('SIGINT', close);
process.on('SIGTERM', close);
browser.on('disconnected', () => process.exit(0));
