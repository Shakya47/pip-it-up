import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { CLOSE_POLL_MS } from '../src/constants';

describe('constants', () => {
  it('exports CLOSE_POLL_MS as 250', () => {
    expect(CLOSE_POLL_MS).toBe(250);
  });

  it('constants module has no side effects', async () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    await import('../src/constants');
    expect(setIntervalSpy).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });

  it('importing constants.ts must not evaluate any window or document access', () => {
    const filePath = path.resolve(__dirname, '../src/constants.ts');
    const source = fs.readFileSync(filePath, 'utf-8');
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    expect(codeOnly).not.toMatch(/\b(window|document)\b/);
    expect(codeOnly).not.toMatch(/^(const|let|var)\s+.*(window|document)\./m);
  });

  it('constants.ts must have no imports of its own', () => {
    const filePath = path.resolve(__dirname, '../src/constants.ts');
    const source = fs.readFileSync(filePath, 'utf-8');
    const importMatches = source.match(/^\s*import\b/gm);
    expect(importMatches).toBeNull();
  });

  it('CLOSE_POLL_MS must not be re-declared anywhere else in packages/core/src', () => {
    const srcDir = path.resolve(__dirname, '../src');
    const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.ts') && f !== 'constants.ts');
    for (const file of files) {
      const content = fs.readFileSync(path.join(srcDir, file), 'utf-8');
      expect(content).not.toMatch(/\bconst\s+CLOSE_POLL_MS\s*=/);
    }
  });
});
