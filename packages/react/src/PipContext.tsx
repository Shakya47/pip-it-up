"use client";

import { createContext } from 'react';
import type { PipInstance, PipState } from '@pip-it-up/core';

export interface PipContextValue {
  instance: PipInstance;
  state: PipState;
  isInsidePip: boolean;
}

export const PipContext = createContext<PipContextValue | null>(null);
