import { describe, it, expect, vi } from 'vitest';
import * as api from '../src/index';

describe('packages/react public API surface', () => {
  it('exports the teleportation components', () => {
    expect(typeof api.PipProvider).toBe('function');
    expect(typeof api.PipAnchor).toBe('function');
  });

  it('exports the four dormancy hooks', () => {
    expect(typeof api.useDormancy).toBe('function');
    expect(typeof api.useActiveEffect).toBe('function');
    expect(typeof api.useRevealEffect).toBe('function');
    expect(typeof api.useAdaptiveInterval).toBe('function');
  });

  it('does not export internal mechanics', () => {
    const internalSymbols = [
      'SwitchingPortal',
      'createShuttle',
      'moveHost',
      'getGarage',
      'GARAGE_ATTR',
      'useLayoutReservation',
      'buildReservationStyle',
      'PipTeleportContext',
      'PipHostContext',
      'useTeleport',
      'useHost',
      'createDormancyStore',
      'deriveLevel',
      'PipError',
      'warnPip',
      'isDevEnv',
      'resolveContentEl',
      'HANDOFF_MS',
      'GC_GRACE_MS',
      'GC_RECHECK_MS',
      'RESTORE_EPSILON_PX',
      'DUPLICATE_ANCHOR_FRAMES',
      'MIN_ADAPTIVE_PERIOD_MS',
      'DEFAULT_ACTIVITY_PERIODS',
    ];

    for (const sym of internalSymbols) {
      expect(api).not.toHaveProperty(sym);
    }
  });

  it('does not export PipPortal', () => {
    expect(api).not.toHaveProperty('PipPortal');
  });

  it('type-only exports are absent at runtime', () => {
    const keys = Object.keys(api);
    expect(keys).not.toContain('ActivityLevel');
    expect(keys).not.toContain('HostSnapshot');
    expect(keys).not.toContain('Placement');
    expect(keys).not.toContain('PipProviderProps');
    expect(keys).not.toContain('PipAnchorProps');
    expect(keys).not.toContain('PipWrapperProps');
    expect(keys).not.toContain('PipTriggerProps');
    expect(keys).not.toContain('PipContextValue');
  });

  it('runtime export count is pinned', () => {
    expect(Object.keys(api).length).toBe(14);
  });

  it('exports useAutoPip', () => {
    expect(typeof api.useAutoPip).toBe('function');
  });

  it('barrel import does not touch document at module scope', async () => {
    vi.resetModules();
    vi.stubGlobal('document', undefined);
    try {
      const mod = await import('../src/index');
      expect(mod).toBeDefined();
      expect(typeof mod.PipProvider).toBe('function');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('pre-existing exports still present', () => {
    expect(api.PipWrapper).toBeDefined();
    expect(api.PipTrigger).toBeDefined();
    expect(api.usePip).toBeDefined();
    expect(api.usePipContext).toBeDefined();
    expect(api.useIsPipSupported).toBeDefined();
    expect(api.useVideoPip).toBeDefined();
    expect(api.PipContext).toBeDefined();
  });
});
