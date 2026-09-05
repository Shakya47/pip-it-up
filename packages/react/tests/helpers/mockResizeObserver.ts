export interface ResizeObserverController {
  /** Emit a resize for `el` to every observer currently observing it. */
  emit(el: Element, size: { inlineSize: number; blockSize: number }): void;
  /** How many observers are currently observing `el`. */
  observerCount(el: Element): number;
  /** Total live observer instances that have not been disconnected. */
  liveObservers(): number;
  /** Every `observe(el, options)` call, in order. */
  readonly observeCalls: ReadonlyArray<{ target: Element; options?: ResizeObserverOptions }>;
  /** Restores the previous global and clears all state. */
  restore(): void;
}

let activeController: ResizeObserverController | null = null;

export function getActiveResizeObserverController(): ResizeObserverController | null {
  return activeController;
}

/** Installs a controllable `globalThis.ResizeObserver`. Call in `beforeEach`. */
export function installMockResizeObserver(): ResizeObserverController {
  if (activeController !== null) {
    throw new Error('ResizeObserver mock is already installed. Call restore() before installing again.');
  }

  const previousGlobal = globalThis.ResizeObserver;
  const observeCalls: Array<{ target: Element; options?: ResizeObserverOptions }> = [];
  const elementObservers = new Map<Element, Set<MockResizeObserverInstance>>();
  const liveInstances = new Set<MockResizeObserverInstance>();
  let restored = false;

  class MockResizeObserverInstance {
    private callback: ResizeObserverCallback;
    private targets = new Set<Element>();

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
      liveInstances.add(this);
    }

    observe(target: Element, options?: ResizeObserverOptions): void {
      observeCalls.push({ target, options });
      let set = elementObservers.get(target);
      if (!set) {
        set = new Set();
        elementObservers.set(target, set);
      }
      set.add(this);
      this.targets.add(target);
    }

    unobserve(target: Element): void {
      elementObservers.get(target)?.delete(this);
      this.targets.delete(target);
    }

    disconnect(): void {
      for (const target of this.targets) {
        elementObservers.get(target)?.delete(this);
      }
      this.targets.clear();
      liveInstances.delete(this);
    }

    _invoke(entry: ResizeObserverEntry): void {
      this.callback([entry], this as unknown as ResizeObserver);
    }
  }

  globalThis.ResizeObserver = MockResizeObserverInstance as unknown as typeof ResizeObserver;

  const controller: ResizeObserverController = {
    emit(el: Element, size: { inlineSize: number; blockSize: number }): void {
      const observers = elementObservers.get(el);
      if (!observers || observers.size === 0) return;

      const entry = {
        target: el,
        contentRect: {
          x: 0,
          y: 0,
          width: size.inlineSize,
          height: size.blockSize,
          top: 0,
          right: size.inlineSize,
          bottom: size.blockSize,
          left: 0,
          toJSON: () => ({}),
        } as DOMRectReadOnly,
        borderBoxSize: [{ inlineSize: size.inlineSize, blockSize: size.blockSize }],
        contentBoxSize: [{ inlineSize: size.inlineSize, blockSize: size.blockSize }],
        devicePixelContentBoxSize: [{ inlineSize: size.inlineSize, blockSize: size.blockSize }],
      } as unknown as ResizeObserverEntry;

      for (const observer of Array.from(observers)) {
        observer._invoke(entry);
      }
    },

    observerCount(el: Element): number {
      return elementObservers.get(el)?.size ?? 0;
    },

    liveObservers(): number {
      return liveInstances.size;
    },

    get observeCalls(): ReadonlyArray<{ target: Element; options?: ResizeObserverOptions }> {
      return observeCalls;
    },

    restore(): void {
      if (restored) return;
      restored = true;
      globalThis.ResizeObserver = previousGlobal;
      elementObservers.clear();
      liveInstances.clear();
      observeCalls.length = 0;
      activeController = null;
    },
  };

  activeController = controller;
  return controller;
}
