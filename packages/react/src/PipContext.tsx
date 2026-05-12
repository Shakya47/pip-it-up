"use client";

import { createContext } from 'react';
import type { PipInstance, PipState } from '@pip-it-up/core';

export interface PipContextValue<T = unknown> {
  instance: PipInstance;
  state: PipState;
}

export const PipContext = createContext<PipContextValue<any> | null>(null);
