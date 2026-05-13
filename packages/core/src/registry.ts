import type { PipInstance } from './types';

const registry = new Map<string, PipInstance>();
const listeners = new Map<string, Set<() => void>>();

export const registerPip = (id: string, instance: PipInstance) => {
  registry.set(id, instance);
  notifyListeners(id);
};

export const unregisterPip = (id: string) => {
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
