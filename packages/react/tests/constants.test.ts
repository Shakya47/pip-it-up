import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  HANDOFF_MS,
  GC_GRACE_MS,
  GC_RECHECK_MS,
  RESTORE_EPSILON_PX,
  DUPLICATE_ANCHOR_FRAMES,
  MIN_ADAPTIVE_PERIOD_MS,
  DEFAULT_ACTIVITY_PERIODS,
} from '../src/constants';

describe('constants', () => {
  it('exports the exact documented values', () => {
    expect(HANDOFF_MS).toBe(200);
    expect(GC_GRACE_MS).toBe(30000);
    expect(GC_RECHECK_MS).toBe(5000);
    expect(RESTORE_EPSILON_PX).toBe(1);
    expect(DUPLICATE_ANCHOR_FRAMES).toBe(1);
    expect(MIN_ADAPTIVE_PERIOD_MS).toBe(250);
  });

  it('default activity periods match the dormancy table', () => {
    expect(DEFAULT_ACTIVITY_PERIODS).toEqual({
      active: 1000,
      background: 15000,
      dormant: 60000,
      frozen: null,
    });
  });

  it('activity period table is frozen', () => {
    try {
      (DEFAULT_ACTIVITY_PERIODS as Record<string, unknown>).active = 5;
    } catch {
      // Ignored: frozen object throws in strict mode
    }
    expect(DEFAULT_ACTIVITY_PERIODS.active).toBe(1000);
  });

  it('adaptive floor is below the active period', () => {
    expect(MIN_ADAPTIVE_PERIOD_MS).toBeLessThan(DEFAULT_ACTIVITY_PERIODS.active!);
  });

  it('module has no imports', () => {
    const filePath = path.resolve(__dirname, '../src/constants.ts');
    const source = fs.readFileSync(filePath, 'utf-8');
    expect(source).not.toMatch(/^import /m);
  });
});
