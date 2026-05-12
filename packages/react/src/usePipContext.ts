"use client";

import { useContext } from 'react';
import { PipContext } from './PipContext';
import type { PipContextValue } from './PipContext';

export function usePipContext<T = unknown>(): PipContextValue<T> {
  const context = useContext(PipContext);
  if (!context) {
    throw new Error('usePipContext must be used within a <PipWrapper>');
  }
  return context;
}
