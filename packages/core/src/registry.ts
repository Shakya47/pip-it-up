import type { PipInstance } from './types';

const registry = new Map<string, PipInstance>();
const listeners = new Map<string, Set<() => void>>();

export const registerPip = (id: string, instance: PipInstance) => {
  const existing = registry.get(id);
  if (existing && existing !== instance) {
    console.warn(
      `[pip-it-up] Overwriting existing registration for id "${id}". ` +
      `Multiple PipWrapper instances with the same id may cause unexpected behavior.`
    );
  }
  registry.set(id, instance);
  notifyListeners(id);
};

/**
 * Remove a registration. Compare-and-delete: when `instance` is supplied, the entry is removed
 * only if it is still the current owner of `id`.
 *
 * Eviction policy for this registry:
 *  1. Registration is last-writer-wins and warns on collision. It never throws — a throw would
 *     crash the app during React Strict Mode's double mount.
 *  2. Unregistration is owner-only. A non-owner call is a silent no-op.
 *  3. Same-reference re-registration is silent.
 *  4. This is a same-page trust boundary, not a security boundary: any same-origin script can
 *     call getPip(id).open(). Never derive ids from user-generated content.
 *
 * @param id       the registration key
 * @param instance the caller's instance. Omit only for legacy callers; omitting disables the
 *                 ownership check and restores the pre-0.2 unconditional-delete behaviour.
 */
export const unregisterPip = (id: string, instance?: PipInstance) => {
  if (instance && registry.get(id) !== instance) return;
  registry.delete(id);
  notifyListeners(id);
};

export const getPip = (id: string): PipInstance | null => {
  return registry.get(id) || null;
};

export const subscribeRegistry = (id: string, fn: () => void): (() => void) => {
  let set = listeners.get(id);
  if (!set) {
    set = new Set();
    listeners.set(id, set);
  }
  set.add(fn);
  return () => {
    set?.delete(fn);
    if (set?.size === 0) {
      listeners.delete(id);
    }
  };
};

const notifyListeners = (id: string) => {
  const set = listeners.get(id);
  if (set) {
    for (const fn of set) {
      fn();
    }
  }
};

export const clearRegistry = () => {
  registry.clear();
  listeners.clear();
};
