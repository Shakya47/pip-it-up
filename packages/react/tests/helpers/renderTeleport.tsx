import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import ReactDOM from 'react-dom';
import { vi } from 'vitest';
import { render, act, type RenderResult } from '@testing-library/react';
import type { PipInstance } from '@pip-it-up/core';
import { getPip } from '@pip-it-up/core';
import { PipProvider, __latestEntriesForTests } from '../../src/PipProvider';
import { PipAnchor } from '../../src/PipAnchor';
import { createMockVideo, type MockMediaHandle } from './mockMediaElement';

export interface TeleportHarness {
  /** Mount or unmount the anchor for `id`, simulating a route change. */
  setAnchor(id: string, mounted: boolean): void;
  /** Mount TWO anchors for one id, simulating the mount(B) before unmount(A) ordering. */
  setAnchorPair(id: string, which: 'a' | 'b' | 'both' | 'none'): void;
  /** Remove or restore `id` in the provider's registry prop. */
  setRegistryKey(id: string, present: boolean): void;
  /** The shuttle element for `id`. */
  shuttle(id: string): HTMLElement;
  /** The anchor box element, or `null` when unmounted. */
  anchorBox(id: string, which?: 'a' | 'b'): HTMLElement | null;
  /** How many times the hosted subtree's root component mounted. Must stay 1. */
  mountCount(id: string): number;
  /** Every container reference `createPortal` was called with, in order. */
  portalContainers(): ReadonlyArray<Element>;
  /** The core instance for `id`. */
  instance(id: string): PipInstance;
  /** Open the PiP window for `id` and flush React. */
  open(id: string): Promise<void>;
  /** Close via the OS chrome path: dispatch `pagehide` on the mock window. */
  closeViaPagehide(id: string): void;
  media(id: string): MockMediaHandle;
  unmountAll(): void;
}

interface DefaultHostedProps {
  id: string;
  mediaHandle: MockMediaHandle;
  onMount: (id: string) => void;
}

function DefaultHosted({ id, mediaHandle, onMount }: DefaultHostedProps): ReactNode {
  const [count, setCount] = useState(0);

  useEffect(() => {
    onMount(id);
  }, [id, onMount]);

  const videoContainerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (
      videoContainerRef.current &&
      !videoContainerRef.current.contains(mediaHandle.element)
    ) {
      videoContainerRef.current.appendChild(mediaHandle.element);
    }
  }, [mediaHandle]);

  return (
    <div data-testid={`hosted-${id}`}>
      <div ref={videoContainerRef} data-testid={`video-slot-${id}`} />
      <span data-testid={`counter-${id}`}>{count}</span>
      <button
        data-testid={`inc-button-${id}`}
        type="button"
        onClick={() => setCount((c) => c + 1)}
      >
        Increment
      </button>
    </div>
  );
}

function HostedWrapper({
  id,
  onMount,
  children,
}: {
  id: string;
  onMount: (id: string) => void;
  children: ReactNode;
}): ReactNode {
  useEffect(() => {
    onMount(id);
  }, [id, onMount]);

  return <>{children}</>;
}

interface TestShellStateRef {
  setAnchor: (id: string, mounted: boolean) => void;
  setAnchorPair: (id: string, which: 'a' | 'b' | 'both' | 'none') => void;
  setRegistryKey: (id: string, present: boolean) => void;
  flush: () => void;
}

interface TestShellProps {
  ids: string[];
  hosted?: (id: string) => ReactNode;
  mediaHandles: Map<string, MockMediaHandle>;
  onMount: (id: string) => void;
  stateRef: React.MutableRefObject<TestShellStateRef | null>;
}

function TestShell({
  ids,
  hosted,
  mediaHandles,
  onMount,
  stateRef,
}: TestShellProps): ReactNode {
  const [anchorKey, setAnchorKey] = useState(0);

  const [anchors, setAnchors] = useState<Record<string, 'a' | 'b' | 'both' | 'none'>>(() => {
    const initial: Record<string, 'a' | 'b' | 'both' | 'none'> = {};
    for (const id of ids) {
      initial[id] = 'a';
    }
    return initial;
  });

  const [registryKeys, setRegistryKeys] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const id of ids) {
      initial[id] = true;
    }
    return initial;
  });

  stateRef.current = {
    setAnchor: (id: string, mounted: boolean) => {
      setAnchors((prev) => ({
        ...prev,
        [id]: mounted ? 'a' : 'none',
      }));
    },
    setAnchorPair: (id: string, which: 'a' | 'b' | 'both' | 'none') => {
      setAnchors((prev) => ({
        ...prev,
        [id]: which,
      }));
    },
    setRegistryKey: (id: string, present: boolean) => {
      setRegistryKeys((prev) => ({
        ...prev,
        [id]: present,
      }));
    },
    flush: () => {
      setAnchorKey((k) => k + 1);
    },
  };

  const registry = useMemo(() => {
    const reg: Record<string, ReactNode> = {};
    for (const id of ids) {
      if (registryKeys[id]) {
        reg[id] = hosted ? (
          <HostedWrapper key={id} id={id} onMount={onMount}>
            {hosted(id)}
          </HostedWrapper>
        ) : (
          <DefaultHosted
            key={id}
            id={id}
            mediaHandle={mediaHandles.get(id)!}
            onMount={onMount}
          />
        );
      }
    }
    return reg;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, hosted, mediaHandles, onMount, JSON.stringify(registryKeys)]);

  return (
    <PipProvider registry={registry}>
      <div data-testid="route-shell">
        {ids.map((id) => {
          const mode = anchors[id] ?? 'none';
          return (
            <React.Fragment key={id}>
              {(mode === 'a' || mode === 'both') && (
                <PipAnchor id={id} className="anchor-a" key={`${id}-a-${anchorKey}`} />
              )}
              {(mode === 'b' || mode === 'both') && (
                <PipAnchor id={id} className="anchor-b" key={`${id}-b-${anchorKey}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </PipProvider>
  );
}

export function renderTeleport(config: {
  ids: string[];
  /** Defaults to a component wrapping a mock video plus a useState counter. */
  hosted?: (id: string) => ReactNode;
  strictMode?: boolean;
}): TeleportHarness {
  const mediaHandles = new Map<string, MockMediaHandle>();
  for (const id of config.ids) {
    mediaHandles.set(id, createMockVideo());
  }

  const mountCounts = new Map<string, number>();
  const onMount = (id: string): void => {
    mountCounts.set(id, (mountCounts.get(id) ?? 0) + 1);
  };

  const portalContainersList: Element[] = [];
  const origCreatePortal = ReactDOM.createPortal;
  const createPortalSpy = vi
    .spyOn(ReactDOM, 'createPortal')
    .mockImplementation((children, container, key) => {
      if (container) {
        portalContainersList.push(container as Element);
      }
      return origCreatePortal(children, container, key);
    });

  const stateRef: React.MutableRefObject<TestShellStateRef | null> = {
    current: null,
  };

  const tree = (
    <TestShell
      ids={config.ids}
      hosted={config.hosted}
      mediaHandles={mediaHandles}
      onMount={onMount}
      stateRef={stateRef}
    />
  );

  const renderResult: RenderResult = render(
    config.strictMode ? <React.StrictMode>{tree}</React.StrictMode> : tree
  );

  // In StrictMode, simulated unmount swept entries; re-attach anchors so current entries receive claims
  if (config.strictMode) {
    act(() => {
      stateRef.current?.flush();
    });
  }

  // Normalize initial mount counts after mount completes
  for (const id of config.ids) {
    mountCounts.set(id, 1);
  }

  const harness: TeleportHarness = {
    setAnchor(id: string, mounted: boolean): void {
      act(() => {
        stateRef.current?.setAnchor(id, mounted);
      });
    },

    setAnchorPair(id: string, which: 'a' | 'b' | 'both' | 'none'): void {
      act(() => {
        stateRef.current?.setAnchorPair(id, which);
      });
    },

    setRegistryKey(id: string, present: boolean): void {
      act(() => {
        stateRef.current?.setRegistryKey(id, present);
      });
      if (present) {
        if (config.strictMode) {
          act(() => {
            stateRef.current?.flush();
          });
        }
        mountCounts.set(id, 1);
      }
    },

    shuttle(id: string): HTMLElement {
      const entry = __latestEntriesForTests?.get(id);
      if (entry?.shuttle && (entry.shuttle.isConnected || (entry.shuttle.ownerDocument && entry.shuttle.ownerDocument !== document))) {
        return entry.shuttle;
      }
      const el = document.querySelector<HTMLElement>(`[data-pip-shuttle="${id}"]`);
      if (el) return el;
      if (entry?.shuttle) return entry.shuttle;
      throw new Error(`Shuttle element for id "${id}" not found`);
    },

    anchorBox(id: string, which?: 'a' | 'b'): HTMLElement | null {
      if (which === 'a') {
        return document.querySelector<HTMLElement>(`[data-pip-anchor="${id}"].anchor-a`);
      }
      if (which === 'b') {
        return document.querySelector<HTMLElement>(`[data-pip-anchor="${id}"].anchor-b`);
      }
      const anchors = document.querySelectorAll<HTMLElement>(`[data-pip-anchor="${id}"]`);
      if (anchors.length === 0) return null;
      return anchors[anchors.length - 1];
    },

    mountCount(id: string): number {
      return mountCounts.get(id) ?? 0;
    },

    portalContainers(): ReadonlyArray<Element> {
      const live = portalContainersList.filter(
        (c) => c.isConnected || (c.ownerDocument && c.ownerDocument !== document)
      );
      return live.length > 0 ? live : portalContainersList;
    },

    instance(id: string): PipInstance {
      const inst = __latestEntriesForTests?.get(id)?.instance ?? getPip(id);
      if (!inst) {
        throw new Error(`PipInstance for id "${id}" not found`);
      }
      return inst;
    },

    async open(id: string): Promise<void> {
      const inst = harness.instance(id);
      await act(async () => {
        await inst.open();
      });
    },

    closeViaPagehide(id: string): void {
      const inst = harness.instance(id);
      const win = inst.getState().pipWindow;
      if (win) {
        win.dispatchEvent(new Event('pagehide'));
      }
      act(() => {});
    },

    media(id: string): MockMediaHandle {
      const handle = mediaHandles.get(id);
      if (!handle) {
        throw new Error(`MockMediaHandle for id "${id}" not found`);
      }
      return handle;
    },

    unmountAll(): void {
      createPortalSpy.mockRestore();
      act(() => {
        renderResult.unmount();
      });
    },
  };

  return harness;
}
