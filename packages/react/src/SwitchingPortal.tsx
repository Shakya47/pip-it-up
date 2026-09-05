import {
  type ReactNode,
  useRef,
  useSyncExternalStore,
} from 'react';
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect';
import ReactDOM from 'react-dom';
import { getGarage, moveHost } from './garage';

export interface SwitchingPortalProps {
  /** Stable identity for this hosted subtree. Written to the shuttle as `data-pip-shuttle`. */
  id: string;
  /** The subtree to host. Rendered exactly once, into the immortal shuttle. */
  children: ReactNode;
  /**
   * Current destination for the shuttle element.
   * `null` parks it in the attached garage — used before an anchor has attached and while dormant.
   */
  target: HTMLElement | null;
  /**
   * Called with the shuttle element on the commit in which it is first allocated, and with `null`
   * on unmount. Lets the owner register `contentEl` and a teardown hook without reaching into refs.
   */
  onShuttleReady?: (shuttle: HTMLDivElement | null) => void;
}

// Module-private helpers — exact declarations
const emptySubscribe = (): (() => void) => () => {};
const getTrue = (): boolean => true;
const getFalse = (): boolean => false;

/** Allocates the immortal carrier element. Exported for the owner's teardown paths and for tests. */
export function createShuttle(id: string): HTMLDivElement {
  const el = document.createElement('div');
  el.setAttribute('data-pip-shuttle', id);
  el.style.display = 'contents';
  return el;
}

export function SwitchingPortal(props: SwitchingPortalProps): ReactNode {
  const { id, children, target, onShuttleReady } = props;

  const isClient = useSyncExternalStore(emptySubscribe, getTrue, getFalse);
  const shuttleRef = useRef<HTMLDivElement | null>(null);

  if (isClient && shuttleRef.current === null) {
    shuttleRef.current = createShuttle(id);
  }

  const shuttle = shuttleRef.current;

  useIsomorphicLayoutEffect(() => {
    if (!shuttle) return;
    onShuttleReady?.(shuttle);
    return () => {
      onShuttleReady?.(null);
    };
  }, [shuttle, onShuttleReady]);

  useIsomorphicLayoutEffect(() => {
    if (!shuttle) return;
    moveHost(shuttle, target ?? getGarage());
  }, [shuttle, target]);

  if (!shuttle) return null;

  return ReactDOM.createPortal(children, shuttle);
}
