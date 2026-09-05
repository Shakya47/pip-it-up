import { vi } from 'vitest';

export const DEFAULT_INNER_WIDTH = 900;
export const DEFAULT_INNER_HEIGHT = 600;
export const MOCK_DOCUMENT_TITLE = 'pip';

/** The mock window surface the core code paths actually touch. */
export interface MockPipWindow {
  readonly document: Document;
  innerWidth: number;
  innerHeight: number;
  closed: boolean;
  /** Marks the window closed, detaches `defaultView`, and dispatches `pagehide`. */
  close(): void;
  resizeTo(width: number, height: number): void;
  addEventListener(type: string, listener: EventListener, options?: AddEventListenerOptions): void;
  removeEventListener(type: string, listener: EventListener, options?: EventListenerOptions): void;
  dispatchEvent(event: Event): boolean;
  focus(): void;
  /** Test-only introspection: how many listeners are registered for `type`. */
  __listenerCount(type: string): number;
}

export interface MockPipOptions {
  /**
   * When `true` (default), the mock document reports a `defaultView` pointing at the mock
   * window, so `isUsable()` accepts nodes inside it. Set `false` to simulate a document whose
   * browsing context is already gone.
   */
  withDefaultView?: boolean;
  /** When `true`, `requestWindow` rejects with a `NotAllowedError`. Default `false`. */
  rejectWithNotAllowed?: boolean;
}

interface MockPipWindowInternal extends MockPipWindow {
  _listeners: Record<string, EventListener[]>;
  Node?: typeof Node;
  Element?: typeof Element;
  HTMLElement?: typeof HTMLElement;
  SVGElement?: typeof SVGElement;
  getComputedStyle?: typeof window.getComputedStyle;
}

let currentPipWindow: MockPipWindow | null = null;

export function mockDocumentPictureInPicture(options?: MockPipOptions): {
  requestWindow: ReturnType<typeof vi.fn>;
  /** The most recently created mock window, or `null` before the first `requestWindow`. */
  getCurrent(): MockPipWindow | null;
} {
  currentPipWindow = null;

  const mockRequestWindow = vi.fn(
    async (pipOptions?: { width?: number; height?: number; [key: string]: unknown }) => {
      if (options?.rejectWithNotAllowed) {
        return Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
      }

      const pipDoc = document.implementation.createHTMLDocument(MOCK_DOCUMENT_TITLE);

      const win: MockPipWindowInternal = {
        document: pipDoc,
        innerWidth: pipOptions?.width || DEFAULT_INNER_WIDTH,
        innerHeight: pipOptions?.height || DEFAULT_INNER_HEIGHT,
        closed: false,
        _listeners: {},
        close: function (this: MockPipWindowInternal) {
          if (this.closed) return;
          this.closed = true;
          Object.defineProperty(pipDoc, 'defaultView', { value: null, configurable: true });
          this.dispatchEvent(new Event('pagehide'));
        },
        resizeTo: function (this: MockPipWindowInternal, width: number, height: number) {
          this.innerWidth = width;
          this.innerHeight = height;
        },
        addEventListener: function (
          this: MockPipWindowInternal,
          type: string,
          listener: EventListener,
          opts?: AddEventListenerOptions
        ) {
          if (opts?.signal?.aborted) return;
          const bucket = this._listeners[type] ?? (this._listeners[type] = []);
          bucket.push(listener);
          opts?.signal?.addEventListener(
            'abort',
            () => {
              this._listeners[type] = (this._listeners[type] ?? []).filter((l) => l !== listener);
            },
            { once: true }
          );
        },
        removeEventListener: function (
          this: MockPipWindowInternal,
          type: string,
          listener: EventListener
        ) {
          if (this._listeners[type]) {
            this._listeners[type] = this._listeners[type].filter((l) => l !== listener);
          }
        },
        dispatchEvent: function (this: MockPipWindowInternal, event: Event): boolean {
          const typeListeners = this._listeners[event.type];
          if (typeListeners) {
            const copy = [...typeListeners];
            for (const listener of copy) {
              if (this._listeners[event.type]?.includes(listener)) {
                if (typeof listener === 'function') {
                  listener.call(this, event);
                } else if (
                  listener &&
                  typeof (listener as EventListenerObject).handleEvent === 'function'
                ) {
                  (listener as EventListenerObject).handleEvent(event);
                }
              }
            }
          }
          return !event.defaultPrevented;
        },
        focus: vi.fn(),
        getComputedStyle:
          typeof window !== 'undefined' && typeof window.getComputedStyle === 'function'
            ? window.getComputedStyle.bind(window)
            : undefined,
        Node: typeof window !== 'undefined' ? window.Node : undefined,
        Element: typeof window !== 'undefined' ? window.Element : undefined,
        HTMLElement: typeof window !== 'undefined' ? window.HTMLElement : undefined,
        SVGElement: typeof window !== 'undefined' ? window.SVGElement : undefined,
        __listenerCount: function (this: MockPipWindowInternal, type: string): number {
          return this._listeners[type]?.length ?? 0;
        },
      };

      if (options?.withDefaultView !== false) {
        Object.defineProperty(pipDoc, 'defaultView', { value: win, configurable: true });
      }

      currentPipWindow = win;
      return win as unknown as Window;
    }
  );

  Object.defineProperty(window, 'documentPictureInPicture', {
    value: {
      requestWindow: mockRequestWindow,
      get window() {
        return currentPipWindow && !currentPipWindow.closed
          ? (currentPipWindow as unknown as Window)
          : null;
      },
    },
    writable: true,
    configurable: true,
  });

  return {
    requestWindow: mockRequestWindow as unknown as ReturnType<typeof vi.fn>,
    getCurrent: () => currentPipWindow,
  };
}

export function clearMockDocumentPictureInPicture(): void {
  currentPipWindow = null;
  delete (window as unknown as { documentPictureInPicture?: unknown }).documentPictureInPicture;
}
