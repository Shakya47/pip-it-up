import { createContext, useContext } from 'react';
import type { PipInstance } from '@pip-it-up/core';
import { PipError } from './errors';

export type Placement = 'anchor' | 'pip' | 'garage';

export interface HostSnapshot {
  readonly id: string;
  readonly level: 'active' | 'background' | 'dormant' | 'frozen';
  readonly placement: Placement;
  /** A PiP window is open for this id. */
  readonly isOpen: boolean;
  /** The host document (opener for anchor/garage, PiP document for pip) is visible. */
  readonly visible: boolean;
  /** Increments on every transition into a rendered placement. Drives `useRevealEffect`. */
  readonly revealCount: number;
}

export interface DockedSize {
  readonly inlineSize: number;
  readonly blockSize: number;
}

export interface PipTeleportApi {
  /** Claim the docking slot for `id` with `node`. Last writer wins. Called from a callback ref. */
  claimAnchor(id: string, node: HTMLElement): void;
  /** Release a previously claimed node. Compare-and-clear; a stale release is inert. */
  releaseAnchor(id: string, node: HTMLElement | null): void;
  /** Mirror a measured docked border box into the provider's per-id cache. */
  reportDockedSize(id: string, size: DockedSize): void;
  /** Read the cached docked size. Returns `null` when nothing has been measured for `id`. */
  getLastDockedSize(id: string): DockedSize | null;
  /** Current placement for `id`. Returns `'garage'` for an unknown id. */
  getPlacement(id: string): Placement;
  /** The core instance for `id`, or `null` when `id` is not registered. */
  getInstance(id: string): PipInstance | null;
  /** `true` when `id` is a key of the provider's `registry` prop. */
  hasId(id: string): boolean;
  /** Subscribe to placement changes for one id only. Returns an unsubscribe function. */
  subscribePlacement(id: string, fn: () => void): () => void;
}

export interface PipHostApi {
  readonly id: string;
  subscribe(fn: () => void): () => void;
  getSnapshot(): HostSnapshot;
  getServerSnapshot(): HostSnapshot;
}

export const PipTeleportContext = createContext<PipTeleportApi | null>(null);
PipTeleportContext.displayName = 'PipTeleportContext';

export const PipHostContext = createContext<PipHostApi | null>(null);
PipHostContext.displayName = 'PipHostContext';

/** @throws PipError('ERR_NO_PROVIDER') when rendered outside `<PipProvider>`. */
export function useTeleport(): PipTeleportApi {
  const api = useContext(PipTeleportContext);
  if (!api) {
    throw new PipError(
      'ERR_NO_PROVIDER',
      'This component must be rendered inside <PipProvider>. Mount <PipProvider> at your application root (app/layout.tsx, pages/_app.tsx, or above <Routes>).'
    );
  }
  return api;
}

/** @throws PipError('ERR_NO_HOST') when called outside a registry subtree. */
export function useHost(): PipHostApi {
  const host = useContext(PipHostContext);
  if (!host) {
    throw new PipError(
      'ERR_NO_HOST',
      'useDormancy() and the dormancy effect hooks may only be called inside a subtree hosted by <PipProvider>.'
    );
  }
  return host;
}
