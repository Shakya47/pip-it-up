export type ActivityLevel = 'active' | 'background' | 'dormant' | 'frozen';
export type Placement = 'anchor' | 'pip' | 'garage';

export interface HostSnapshot {
  readonly id: string;
  readonly level: ActivityLevel;
  readonly placement: Placement;
  /** A PiP window is open for this id. */
  readonly isOpen: boolean;
  /** The host document (opener for anchor/garage, PiP document for pip) is visible. */
  readonly visible: boolean;
  /** Increments on every transition into a rendered placement. Drives `useRevealEffect`. */
  readonly revealCount: number;
}

/** Mutable inputs the store tracks per id. */
export interface HostInputs {
  placement: Placement;
  isOpen: boolean;
  visible: boolean;
  frozen: boolean;
}

/**
 * Pure level derivation. The ONLY place activity level is computed.
 *
 * | placement | visible | frozen | level      |
 * |-----------|---------|--------|------------|
 * | anchor    | true    | false  | active     |
 * | anchor    | false   | false  | background |
 * | pip       | true    | false  | active     |
 * | pip       | false   | false  | background |
 * | garage    | true    | false  | dormant    |
 * | garage    | false   | false  | frozen     |
 * | any       | any     | true   | frozen     |
 */
export function deriveLevel(
  placement: Placement,
  visible: boolean,
  frozen: boolean,
): ActivityLevel {
  if (frozen) return 'frozen';
  if (placement === 'garage') return visible ? 'dormant' : 'frozen';
  return visible ? 'active' : 'background';
}

export interface DormancyStore {
  /** Create or update the inputs for `id`, recomputing and publishing only on real change. */
  setInputs(id: string, patch: Partial<HostInputs>): void;
  /** Remove `id` entirely. Subsequent `getSnapshot(id)` returns the frozen default snapshot. */
  deleteHost(id: string): void;
  /** Referentially stable: returns the identical object until a field actually changes. */
  getSnapshot(id: string): HostSnapshot;
  /** Always the same frozen object per id; identical on the server and during hydration. */
  getServerSnapshot(id: string): HostSnapshot;
  subscribe(id: string, fn: () => void): () => void;
  /** Set `frozen` on every host at once (Page Lifecycle freeze/resume). */
  setGlobalFrozen(frozen: boolean): void;
  /** Set `visible` on every host whose placement is not `pip` (opener visibility). */
  setOpenerVisible(visible: boolean): void;
}

interface Entry {
  inputs: HostInputs;
  snapshot: HostSnapshot; // cached and frozen
  listeners: Set<() => void>;
  revealCount: number;
  initialized: boolean;
}

const DEFAULT_SNAPSHOT: HostSnapshot = Object.freeze({
  id: '',
  level: 'dormant',
  placement: 'garage',
  isOpen: false,
  visible: false,
  revealCount: 0,
});

export function createDormancyStore(): DormancyStore {
  const entries = new Map<string, Entry>();
  const serverSnapshots = new Map<string, HostSnapshot>();

  function getOrCreateEntry(id: string): Entry {
    let entry = entries.get(id);
    if (!entry) {
      const inputs: HostInputs = {
        placement: 'garage',
        isOpen: false,
        visible: true,
        frozen: false,
      };
      const level = deriveLevel(inputs.placement, inputs.visible, inputs.frozen);
      entry = {
        inputs,
        snapshot: Object.freeze({
          id,
          level,
          placement: inputs.placement,
          isOpen: inputs.isOpen,
          visible: inputs.visible,
          revealCount: 0,
        }),
        listeners: new Set(),
        revealCount: 0,
        initialized: false,
      };
      entries.set(id, entry);
    }
    return entry;
  }

  function setInputs(id: string, patch: Partial<HostInputs>): void {
    const entry = getOrCreateEntry(id);
    const wasInitialized = entry.initialized;
    entry.initialized = true;

    const oldPlacement = entry.inputs.placement;
    let changed = false;

    if (patch.placement !== undefined && patch.placement !== entry.inputs.placement) {
      entry.inputs.placement = patch.placement;
      changed = true;
    }
    if (patch.isOpen !== undefined && patch.isOpen !== entry.inputs.isOpen) {
      entry.inputs.isOpen = patch.isOpen;
      changed = true;
    }
    if (patch.visible !== undefined && patch.visible !== entry.inputs.visible) {
      entry.inputs.visible = patch.visible;
      changed = true;
    }
    if (patch.frozen !== undefined && patch.frozen !== entry.inputs.frozen) {
      entry.inputs.frozen = patch.frozen;
      changed = true;
    }

    if (!changed) return;

    if (
      wasInitialized &&
      oldPlacement === 'garage' &&
      (entry.inputs.placement === 'anchor' || entry.inputs.placement === 'pip')
    ) {
      entry.revealCount += 1;
    }

    const level = deriveLevel(entry.inputs.placement, entry.inputs.visible, entry.inputs.frozen);
    entry.snapshot = Object.freeze({
      id,
      level,
      placement: entry.inputs.placement,
      isOpen: entry.inputs.isOpen,
      visible: entry.inputs.visible,
      revealCount: entry.revealCount,
    });

    const listenersSnapshot = Array.from(entry.listeners);
    for (const listener of listenersSnapshot) {
      try {
        listener();
      } catch (err) {
        console.error('[pip-it-up] dormancy listener failed:', err);
      }
    }
  }

  function deleteHost(id: string): void {
    entries.get(id)?.listeners.clear();
    entries.delete(id);
    serverSnapshots.delete(id);
  }

  function getSnapshot(id: string): HostSnapshot {
    const entry = entries.get(id);
    if (!entry) {
      return DEFAULT_SNAPSHOT;
    }
    return entry.snapshot;
  }

  function getServerSnapshot(id: string): HostSnapshot {
    let snap = serverSnapshots.get(id);
    if (!snap) {
      snap = Object.freeze({
        id,
        level: 'dormant',
        placement: 'garage',
        isOpen: false,
        visible: false,
        revealCount: 0,
      });
      serverSnapshots.set(id, snap);
    }
    return snap;
  }

  function subscribe(id: string, fn: () => void): () => void {
    const entry = getOrCreateEntry(id);
    entry.listeners.add(fn);
    return () => {
      entries.get(id)?.listeners.delete(fn);
    };
  }

  function setGlobalFrozen(frozen: boolean): void {
    const ids = Array.from(entries.keys());
    for (const id of ids) {
      if (!entries.has(id)) continue;
      setInputs(id, { frozen });
    }
  }

  function setOpenerVisible(visible: boolean): void {
    const ids = Array.from(entries.keys());
    for (const id of ids) {
      const entry = entries.get(id);
      if (!entry) continue;
      if (entry.inputs.placement !== 'pip') {
        setInputs(id, { visible });
      }
    }
  }

  return {
    setInputs,
    deleteHost,
    getSnapshot,
    getServerSnapshot,
    subscribe,
    setGlobalFrozen,
    setOpenerVisible,
  };
}
