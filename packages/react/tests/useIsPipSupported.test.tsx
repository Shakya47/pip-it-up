import { render, renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useIsPipSupported } from '../src/useIsPipSupported';

describe('useIsPipSupported', () => {
  it('returns false initially and true after effect if supported', () => {
    let renders = 0;
    let initialValue: boolean | null = null;
    let finalValue: boolean | null = null;
    
    function TestComponent() {
      const supported = useIsPipSupported();
      renders++;
      if (renders === 1) initialValue = supported;
      finalValue = supported;
      return null;
    }
    
    render(<TestComponent />);
    
    expect(initialValue).toBe(false);
    expect(finalValue).toBe(true);
  });
});
