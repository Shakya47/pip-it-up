"use client";

import { useState, useEffect } from 'react';
import { isSupported } from '@pip-it-up/core';

export const useIsPipSupported = () => {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(isSupported());
  }, []);

  return supported;
};
