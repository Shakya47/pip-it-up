export { PipWrapper } from './PipWrapper';
export type { PipWrapperProps } from './PipWrapper';

export { PipTrigger } from './PipTrigger';
export type { PipTriggerProps } from './PipTrigger';

export { usePip } from './usePip';
export { usePipContext } from './usePipContext';
export { useIsPipSupported } from './useIsPipSupported';
export { useVideoPip } from './useVideoPip';
export { useAutoPip } from './useAutoPip';
export type { UseAutoPipOptions } from './useAutoPip';

export { PipContext } from './PipContext';
export type { PipContextValue } from './PipContext';

// --- Route-persistent teleportation (added by this epic) ---
export { PipProvider } from './PipProvider';
export type { PipProviderProps } from './PipProvider';
export { PipAnchor } from './PipAnchor';
export type { PipAnchorProps } from './PipAnchor';
export {
  useDormancy,
  useActiveEffect,
  useRevealEffect,
  useAdaptiveInterval,
} from './useDormancy';
export type { ActivityLevel, HostSnapshot, Placement } from './dormancy';
