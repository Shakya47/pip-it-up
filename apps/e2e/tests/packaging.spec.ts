/**
 * flows/packaging.md (PK): MANUAL_SMOKE part C, automated. `pnpm pack` each published package and
 * inspect the tarball: no `workspace:` protocol may ship, and the files package.json points at
 * must be inside. Uses `pnpm pack` (which rewrites `workspace:*` like `changeset publish` does);
 * `npm pack` would leave it in place and always fail. Needs the packages built (`pnpm build`).
 * No browser: plain `@playwright/test`, not the suite fixtures.
 */
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REPO_ROOT } from '../lib/targets';

type Manifest = Record<string, unknown> & {
  main?: string;
  module?: string;
  types?: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

function pack(pkg: 'core' | 'react') {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), `pip-pack-${pkg}-`));
  execFileSync('pnpm', ['pack', '--pack-destination', out], { cwd: path.join(REPO_ROOT, 'packages', pkg), stdio: 'pipe' });
  const tarball = path.join(out, fs.readdirSync(out).find((f) => f.endsWith('.tgz'))!);
  const files = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' }).split('\n').filter(Boolean);
  const manifestText = execFileSync('tar', ['-xzOf', tarball, 'package/package.json'], { encoding: 'utf8' });
  return { files, manifestText, manifest: JSON.parse(manifestText) as Manifest, cleanup: () => fs.rmSync(out, { recursive: true, force: true }) };
}

for (const pkg of ['core', 'react'] as const) {
  test.describe(`@pip-it-up/${pkg}`, () => {
    const id = pkg === 'core' ? { ws: 'PK1', files: 'PK2' } : { ws: 'PK3', files: 'PK4' };

    test(`${id.ws} the packed package.json has no workspace: protocol @smoke`, async () => {
      const { manifestText, cleanup } = pack(pkg);
      try {
        expect(manifestText).not.toContain('workspace:');
      } finally {
        cleanup();
      }
    });

    test(`${id.files} main, module and types all point at files inside the tarball`, async () => {
      const { files, manifest, cleanup } = pack(pkg);
      try {
        for (const field of ['main', 'module', 'types'] as const) {
          expect(manifest[field], `${field} is set`).toBeTruthy();
          expect(files, `${field}: ${manifest[field]}`).toContain(`package/${String(manifest[field]).replace(/^\.\//, '')}`);
        }
      } finally {
        cleanup();
      }
    });
  });
}
