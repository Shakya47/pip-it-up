"use client";

import { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface PipPortalProps {
  children: ReactNode;
  pipWindow: Window;
}

export const PipPortal = ({ children, pipWindow }: PipPortalProps) => {
  return createPortal(children, pipWindow.document.body);
};
