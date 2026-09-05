import type { ElementRegistration, PipInstance, PipOptions } from '@pip-it-up/core';
import { createPip, registerPip, unregisterPip } from '@pip-it-up/core';
import {
  type ReactNode,
  useRef,
  useSyncExternalStore,
  useReducer,
  useEffect,
} from 'react';
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect';
import {
  PipTeleportContext,
  PipHostContext,
  type DockedSize,
  type PipHostApi,
  type PipTeleportApi,
} from './PipTeleportContext';
import {
  createDormancyStore,
  type DormancyStore,
  type Placement,
} from './dormancy';
import { SwitchingPortal, createShuttle } from './SwitchingPortal';
import { getGarage, moveHost } from './garage';
import { PipContext } from './PipContext';
import { warnPip, isDevEnv } from './errors';
import { GC_GRACE_MS, GC_RECHECK_MS } from './constants';

export interface PipProviderProps {
  /**
   * Persistent subtrees, keyed by id. Each value is rendered exactly once, into that id's
   * immortal shuttle. Memoise this object to avoid needless provider re-renders: correctness
   * does not depend on it (element TYPE identity governs reconciliation, and that is stable for
   * inline JSX), but every provider render re-renders all hosted subtrees.
   */
  registry: Record<string, ReactNode>;
  /** Per-id core options. `mode` and `id` are forced and cannot be overridden. */
  options?: Record<string, Omit<PipOptions, 'mode' | 'id'>>;
  /** Eviction lease in ms for an orphaned id. Default `GC_GRACE_MS` (30000). See REACT-312. */
  gcGraceMs?: number;
  /** `'pause'` (default) pauses garage-parked media; `'keep'` lets it play. */
  dormantMedia?: 'pause' | 'keep';
  children?: ReactNode;
}

/** One provider-owned record per registry id. Created lazily; destroyed only by the GC sweep. */
export interface PipEntry {
  readonly id: string;
  readonly shuttle: HTMLDivElement;
  readonly instance: PipInstance;
  /** Anchor node currently owning this id, or `null` when parked. */
  anchorEl: HTMLElement | null;
  /** Every live anchor claim, insertion-ordered. Size greater than 1 only during a route handoff. */
  readonly claims: Set<HTMLElement>;
  /** Per-claimed-node core registration handles, so the right one is released. */
  readonly originRegistrations: WeakMap<HTMLElement, ElementRegistration>;
  /** Last measured docked border box, for anti-CLS pre-reservation. */
  lastDockedSize: DockedSize | null;
  /** `Date.now()` when the id left `registry`, else `null`. See REACT-312. */
  orphanedAt: number | null;
  /** Grace or re-check timer handle. See REACT-312. */
  gcTimer: ReturnType<typeof setTimeout> | null;
  /** Unregister function from `instance.registerTeardown`. See REACT-313. */
  releaseTeardown: (() => void) | null;
  /** Handle for the `contentEl` registration. Released in the GC sweep. */
  contentRegistration: ElementRegistration | null;
  /** Stable per-id callbacks, allocated once so portal props never change identity. */
  readonly hostApi: PipHostApi;
  readonly onShuttleReady: (shuttle: HTMLDivElement | null) => void;
  readonly placementListeners: Set<() => void>;
  placement: Placement;
}

const emptySubscribe = (): (() => void) => () => {};
const getTrue = (): boolean => true;
const getFalse = (): boolean => false;

/** Resolves the measurable box for core's sizing path. Exported for direct testing. */
export function resolveContentEl(shuttle: HTMLDivElement): HTMLElement {
  return (shuttle.firstElementChild as HTMLElement | null) ?? shuttle;
}

/**
 * Registers the synchronous repatriation hook for one entry, plus the belt-and-braces
 * `pagehide` listener on the PiP window. Idempotent per entry.
 * Returns a disposer that unregisters the core hook.
 */
function attachTeardown(entry: PipEntry): () => void {
  if (entry.releaseTeardown === null) {
    entry.releaseTeardown = entry.instance.registerTeardown(() => {
      // Synchronous, imperative, idempotent. The portal's containerInfo does not change, so React
      // is not involved and does not need to be.
      moveHost(entry.shuttle, entry.anchorEl ?? getGarage());
    });
  }
  return () => {
    entry.releaseTeardown?.();
    entry.releaseTeardown = null;
  };
}

interface PipEntryHostProps {
  entry: PipEntry;
  children: ReactNode;
  dormantMedia: 'pause' | 'keep';
  store: DormancyStore;
  setPlacement: (entry: PipEntry, next: Placement) => void;
  forceRender: () => void;
  pausedMediaMap: Map<string, Set<HTMLMediaElement>>;
}

function PipEntryHost(props: PipEntryHostProps): ReactNode {
  const {
    entry,
    children,
    dormantMedia,
    store,
    setPlacement,
    forceRender,
    pausedMediaMap,
  } = props;
  const { id, instance, hostApi, placement, onShuttleReady } = entry;
  const state = instance.getState();

  // 4.9 Content registration: keyed on [entry.placement, children]
  useIsomorphicLayoutEffect(() => {
    const contentEl = resolveContentEl(entry.shuttle);
    if (entry.contentRegistration === null) {
      entry.contentRegistration = instance.registerElements({ contentEl });
    } else {
      entry.contentRegistration.update({ contentEl });
    }
  }, [placement, children, instance, entry]);

  // 4.10 Registry publication: registerPip(id, entry.instance), unregisterPip(id, entry.instance)
  useIsomorphicLayoutEffect(() => {
    registerPip(id, instance);
    return () => {
      unregisterPip(id, instance);
    };
  }, [id, instance]);

  // 4.11 Instance state subscription & synchronous repatriation hook
  useIsomorphicLayoutEffect(() => {
    attachTeardown(entry);

    let lastPipDoc: Document | null = null;
    const unsubscribe = instance.subscribe(() => {
      const instState = instance.getState();
      const isOpen = instance.isOpen();
      const nextPlacement: Placement = isOpen
        ? 'pip'
        : (entry.anchorEl ? 'anchor' : 'garage');
      setPlacement(entry, nextPlacement);
      store.setInputs(id, { isOpen });

      // 4.12 Per open PiP window visibilitychange & belt-and-braces pagehide listener
      if (instState.pipWindow && instState.pipWindow.document !== lastPipDoc) {
        lastPipDoc = instState.pipWindow.document;
        instState.pipWindow.document.addEventListener(
          'visibilitychange',
          () => {
            if (instState.pipWindow) {
              store.setInputs(id, { visible: !instState.pipWindow.document.hidden });
            }
          },
          { signal: instance.signal }
        );
        instState.pipWindow.addEventListener(
          'pagehide',
          () => {
            moveHost(entry.shuttle, entry.anchorEl ?? getGarage());
          },
          { signal: instance.signal }
        );
      }
      forceRender();
    });
    return unsubscribe;
  }, [entry, instance, id, setPlacement, store, forceRender]);

  // 4.14 Dormant media policy
  useEffect(() => {
    let pausedSet = pausedMediaMap.get(id);
    if (!pausedSet) {
      pausedSet = new Set<HTMLMediaElement>();
      pausedMediaMap.set(id, pausedSet);
    }
    let prevLevel = store.getSnapshot(id).level;

    const unsubscribe = store.subscribe(id, () => {
      const snap = store.getSnapshot(id);
      const nextLevel = snap.level;
      const wasDormantOrFrozen = prevLevel === 'dormant' || prevLevel === 'frozen';
      const isDormantOrFrozen = nextLevel === 'dormant' || nextLevel === 'frozen';
      prevLevel = nextLevel;

      if (dormantMedia !== 'keep') {
        if (!wasDormantOrFrozen && isDormantOrFrozen) {
          const mediaElements = entry.shuttle.querySelectorAll<HTMLMediaElement>('video, audio');
          mediaElements.forEach((media) => {
            if (!media.paused) {
              pausedSet!.add(media);
              media.pause();
            }
          });
        } else if (wasDormantOrFrozen && !isDormantOrFrozen) {
          pausedSet!.forEach((media) => {
            try {
              const res = media.play();
              if (res && typeof res.catch === 'function') {
                res.catch(() => {});
              }
            } catch {
              /* swallowed per §4.14 */
            }
          });
          pausedSet!.clear();
        }
      }
    });

    return unsubscribe;
  }, [id, entry.shuttle, store, dormantMedia, pausedMediaMap]);

  const target =
    entry.placement === 'pip' && state.pipWindow
      ? state.pipWindow.document.body
      : entry.placement === 'anchor'
        ? entry.anchorEl
        : null;

  return (
    <SwitchingPortal id={id} target={target} onShuttleReady={onShuttleReady}>
      <PipHostContext.Provider value={hostApi}>
        <PipContext.Provider
          value={{
            instance,
            state,
            isInsidePip: placement === 'pip',
          }}
        >
          {children}
        </PipContext.Provider>
      </PipHostContext.Provider>
    </SwitchingPortal>
  );
}

export const clientMountCache = new WeakMap<object, Map<string, PipEntry>>();
export let __latestEntriesForTests: Map<string, PipEntry> | null = null;

export function PipProvider(props: PipProviderProps): ReactNode {
  const {
    registry,
    options,
    gcGraceMs = GC_GRACE_MS,
    dormantMedia = 'pause',
    children,
  } = props;
  const [, forceRender] = useReducer((n: number) => n + 1, 0);

  // 4.1 Client gate and stable containers
  const isClient = useSyncExternalStore(emptySubscribe, getTrue, getFalse);

  const entriesRef = useRef<Map<string, PipEntry> | null>(null);
  if (!entriesRef.current) {
    const cached = clientMountCache.get(props);
    if (cached) {
      entriesRef.current = cached;
    } else {
      const map = new Map<string, PipEntry>();
      entriesRef.current = map;
      if (typeof props === 'object' && props !== null) {
        clientMountCache.set(props, map);
      }
    }
  }
  const entries = entriesRef.current;
  __latestEntriesForTests = entries;

  const storeRef = useRef<DormancyStore | null>(null);
  if (!storeRef.current) storeRef.current = createDormancyStore();
  const store = storeRef.current;

  const keySetRef = useRef<Set<string>>(new Set(Object.keys(registry)));
  keySetRef.current = new Set(Object.keys(registry));
  const keySignature = JSON.stringify(Object.keys(registry).sort());


  function leaseCount(entry: PipEntry): number {
    return entry.claims.size + (entry.instance.isOpen() ? 1 : 0);
  }

  function sweep(entry: PipEntry): void {
    entry.releaseTeardown?.();
    entry.releaseTeardown = null;
    entry.contentRegistration?.release();
    entry.contentRegistration = null;
    unregisterPip(entry.id, entry.instance);
    entry.instance.destroy();
    entry.shuttle.remove();
    entry.lastDockedSize = null;
    store.deleteHost(entry.id);
    entries.delete(entry.id);
  }

  function armSweep(entry: PipEntry, delay: number, currentGcGraceMs: number): void {
    if (entry.gcTimer !== null) clearTimeout(entry.gcTimer);
    entry.gcTimer = setTimeout(() => {
      entry.gcTimer = null;
      if (entry.orphanedAt === null) return;
      if (leaseCount(entry) > 0) {
        armSweep(entry, GC_RECHECK_MS, currentGcGraceMs);
        return;
      }
      if (entry.instance.getState().isOpen) {
        armSweep(entry, GC_RECHECK_MS, currentGcGraceMs);
        return;
      }
      sweep(entry);
    }, delay);
  }

  function onKeyRemoved(entry: PipEntry, currentGcGraceMs: number): void {
    if (entry.orphanedAt !== null) return;
    entry.orphanedAt = Date.now();
    entry.instance.close();
    armSweep(entry, currentGcGraceMs, currentGcGraceMs);
  }

  function onKeyReadopted(entry: PipEntry): void {
    if (entry.orphanedAt === null) return;
    entry.orphanedAt = null;
    if (entry.gcTimer !== null) {
      clearTimeout(entry.gcTimer);
      entry.gcTimer = null;
    }
  }

  useIsomorphicLayoutEffect(() => {
    keySetRef.current = new Set(Object.keys(registry));
    const present = new Set(Object.keys(registry));
    for (const entry of Array.from(entries.values())) {
      if (present.has(entry.id)) {
        onKeyReadopted(entry);
      } else {
        onKeyRemoved(entry, gcGraceMs ?? GC_GRACE_MS);
      }
    }
  }, [keySignature, gcGraceMs]);

  const pausedMediaMapRef = useRef<Map<string, Set<HTMLMediaElement>> | null>(null);
  if (!pausedMediaMapRef.current) pausedMediaMapRef.current = new Map();
  const pausedMediaMap = pausedMediaMapRef.current;

  const duplicateRafMapRef = useRef<Map<string, number> | null>(null);
  if (!duplicateRafMapRef.current) duplicateRafMapRef.current = new Map();
  const duplicateRafMap = duplicateRafMapRef.current;

  function setPlacement(entry: PipEntry, next: Placement): void {
    if (entry.placement === next) return;
    entry.placement = next;
    store.setInputs(entry.id, { placement: next, isOpen: entry.instance.isOpen() });
    const listeners = Array.from(entry.placementListeners);
    for (const fn of listeners) {
      try {
        fn();
      } catch (err) {
        console.error('[pip-it-up] placement listener failed:', err);
      }
    }
    forceRender();
  }

  // 4.2 Lazy entry creation, during render, for every current registry key
  const ids = Object.keys(registry);
  if (isClient) {
    for (const id of ids) {
      if (entries.has(id)) continue;
      const shuttle = createShuttle(id);
      const instance = createPip({ ...(options?.[id] ?? {}), id, mode: 'portal' });
      const placementListeners = new Set<() => void>();
      const entry: PipEntry = {
        id,
        shuttle,
        instance,
        anchorEl: null,
        claims: new Set(),
        originRegistrations: new WeakMap(),
        lastDockedSize: null,
        orphanedAt: null,
        gcTimer: null,
        releaseTeardown: null,
        contentRegistration: null,
        hostApi: {
          id,
          subscribe: (fn) => store.subscribe(id, fn),
          getSnapshot: () => store.getSnapshot(id),
          getServerSnapshot: () => store.getServerSnapshot(id),
        },
        onShuttleReady: (readyShuttle: HTMLDivElement | null) => {
          if (readyShuttle) {
            (entry as { shuttle: HTMLDivElement }).shuttle = readyShuttle;
          }
        },
        placementListeners,
        placement: 'garage',
      };
      entries.set(id, entry);
      store.setInputs(id, { placement: 'garage', isOpen: false, visible: true, frozen: false });
    }
  }

  // 4.3 Stable PipTeleportApi — built once with useRef, never useMemo
  const apiRef = useRef<PipTeleportApi | null>(null);
  if (!apiRef.current) {
    const claimAnchor = (id: string, node: HTMLElement): void => {
      const entry = entries.get(id);
      if (!entry) return;
      entry.claims.add(node);
      entry.anchorEl = node;
      entry.originRegistrations.set(
        node,
        entry.instance.registerElements({ originEl: node })
      );
      setPlacement(entry, entry.instance.isOpen() ? 'pip' : 'anchor');
      forceRender();
      if (isDevEnv()) {
        if (duplicateRafMap.has(id)) {
          cancelAnimationFrame(duplicateRafMap.get(id)!);
        }
        const rafId = requestAnimationFrame(() => {
          duplicateRafMap.delete(id);
          const live = Array.from(entry.claims).filter((n) => n.isConnected);
          if (live.length > 1) {
            warnPip(
              'ERR_DUPLICATE_ANCHOR',
              `${live.length} live <PipAnchor id="${id}"> elements are mounted at once. Only one anchor per id may be mounted; the most recently mounted one wins.`
            );
          }
        });
        duplicateRafMap.set(id, rafId);
      }
    };

    const releaseAnchor = (id: string, node: HTMLElement | null): void => {
      const entry = entries.get(id);
      if (!entry || !node) return;
      entry.claims.delete(node);
      entry.originRegistrations.get(node)?.release();
      entry.originRegistrations.delete(node);
      if (entry.anchorEl !== node) return;
      const remaining = Array.from(entry.claims);
      entry.anchorEl = remaining.length > 0 ? remaining[remaining.length - 1] : null;
      setPlacement(
        entry,
        entry.instance.isOpen() ? 'pip' : (entry.anchorEl ? 'anchor' : 'garage')
      );
      forceRender();
    };

    const reportDockedSize = (id: string, size: DockedSize): void => {
      const entry = entries.get(id);
      if (entry) {
        entry.lastDockedSize = size;
      }
    };

    const getLastDockedSize = (id: string): DockedSize | null => {
      return entries.get(id)?.lastDockedSize ?? null;
    };

    const getPlacement = (id: string): Placement => {
      return entries.get(id)?.placement ?? 'garage';
    };

    const getInstance = (id: string): PipInstance | null => {
      return entries.get(id)?.instance ?? null;
    };

    const hasId = (id: string): boolean => {
      return keySetRef.current.has(id);
    };

    const subscribePlacement = (id: string, fn: () => void): (() => void) => {
      const entry = entries.get(id);
      if (!entry) return () => {};
      entry.placementListeners.add(fn);
      return () => {
        entry.placementListeners.delete(fn);
      };
    };

    apiRef.current = {
      claimAnchor,
      releaseAnchor,
      reportDockedSize,
      getLastDockedSize,
      getPlacement,
      getInstance,
      hasId,
      subscribePlacement,
    };
  }

  // 4.12 Visibility and Page Lifecycle wiring
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const onDocVisibility = () => {
      store.setOpenerVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', onDocVisibility, { signal });

    const onFreeze = () => {
      store.setGlobalFrozen(true);
    };
    window.addEventListener('freeze', onFreeze, { signal });

    const onResume = () => {
      store.setGlobalFrozen(false);
    };
    window.addEventListener('resume', onResume, { signal });

    return () => {
      controller.abort();
    };
  }, [store]);

  // 4.15 Provider unmount (REACT-312 §4.7)
  //
  // The sweep is DEFERRED by one macrotask, and cancelled if the provider mounts again before it
  // fires. This is required for React Strict Mode, which simulates an unmount by re-running
  // effects (mount -> unmount -> mount) WITHOUT re-rendering. Entry creation lives in the render
  // body (4.2), so a cleanup that swept synchronously would destroy every entry with nothing left
  // to recreate them: the next `claimAnchor` would find no entry, the shuttle would stay parked in
  // the garage, and a mounted anchor would show its placeholder forever.
  //
  // Deferring makes cleanup and setup symmetric again without moving creation out of render.
  // A real unmount is not followed by a mount, so the sweep runs on the next macrotask.
  // See MAINTENANCE_GUIDE Section 2 (Instance Stability).
  const providerMountedRef = useRef(false);
  const teardownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    providerMountedRef.current = true;
    if (teardownTimerRef.current !== null) {
      clearTimeout(teardownTimerRef.current);
      teardownTimerRef.current = null;
    }

    return () => {
      providerMountedRef.current = false;

      // Timers are cleared immediately: a GC timer firing against a provider that is going away
      // must not run, whether or not the sweep itself is ultimately cancelled.
      for (const entry of Array.from(entries.values())) {
        if (entry.gcTimer !== null) {
          clearTimeout(entry.gcTimer);
          entry.gcTimer = null;
        }
      }

      if (teardownTimerRef.current !== null) clearTimeout(teardownTimerRef.current);
      teardownTimerRef.current = setTimeout(() => {
        teardownTimerRef.current = null;
        if (providerMountedRef.current) return; // remounted (Strict Mode): keep every entry
        for (const entry of Array.from(entries.values())) {
          sweep(entry);
        }
      }, 0);
    };
  }, [entries]);

  // 4.8 Portal rendering
  return (
    <PipTeleportContext.Provider value={apiRef.current}>
      {children}
      {isClient &&
        ids.map((id) => {
          const entry = entries.get(id);
          if (!entry) return null;
          return (
            <PipEntryHost
              key={id}
              entry={entry}
              dormantMedia={dormantMedia}
              store={store}
              setPlacement={setPlacement}
              forceRender={forceRender}
              pausedMediaMap={pausedMediaMap}
            >
              {registry[id]}
            </PipEntryHost>
          );
        })}
    </PipTeleportContext.Provider>
  );
}
