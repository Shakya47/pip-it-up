"use client";

import { ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { usePipContext } from './usePipContext';
import { PipContext } from './PipContext';

interface PipPortalProps {
  children: ReactNode;
  pipWindow: Window;
}

/**
 * @internal
 * PipPortal is an internal component used only by PipWrapper.
 * It relies on usePipContext() which throws if there's no <PipWrapper> ancestor.
 * If this component is ever exported publicly, replace usePipContext() with
 * useContext(PipContext) and handle the null case gracefully.
 */
export const PipPortal = ({ children, pipWindow }: PipPortalProps) => {
  const context = usePipContext();

  return createPortal(
    <PipContext.Provider value={{ ...context, isInsidePip: true }}>
      {children}
    </PipContext.Provider>,
    pipWindow.document.body
  );
};
