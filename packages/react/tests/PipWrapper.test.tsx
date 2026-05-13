import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PipWrapper } from '../src/PipWrapper';
import { usePipContext } from '../src/usePipContext';
import { usePip } from '../src/usePip';

describe('PipWrapper', () => {
  it('renders children normally in uncontrolled mode', () => {
    render(<PipWrapper>Hello World</PipWrapper>);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('can be controlled via open prop', async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<PipWrapper open={false} onOpenChange={onOpenChange}>Child</PipWrapper>);
    
    rerender(<PipWrapper open={true} onOpenChange={onOpenChange}>Child</PipWrapper>);
    
    const { waitFor } = await import('@testing-library/react');
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(true);
    });
  });

  it('provides context', () => {
    let ctxInstance: any;
    const Child = () => {
      const { instance } = usePipContext();
      ctxInstance = instance;
      return null;
    };

    render(<PipWrapper><Child /></PipWrapper>);
    expect(ctxInstance).toBeDefined();
    expect(typeof ctxInstance.open).toBe('function');
  });

  it('registers globally if id is provided', async () => {
    render(<PipWrapper id="global-test-id">Child</PipWrapper>);
    const { getPip } = await import('@pip-it-up/core');
    expect(getPip('global-test-id')).not.toBeNull();
  });

  it('renders portal children into pipWindow when mode is portal', async () => {
    const { renderHook } = await import('@testing-library/react');
    const { result } = renderHook(() => usePip());
    
    render(
      <PipWrapper id="portal-test-id" open={true} mode="portal" onOpenChange={() => {}}>
        <div data-testid="portal-child">Portal Content</div>
      </PipWrapper>
    );

    const { waitFor } = await import('@testing-library/react');
    await waitFor(async () => {
      const { getPip } = await import('@pip-it-up/core');
      const pip = getPip('portal-test-id');
      expect(pip).not.toBeNull();
      
      const pipDoc = pip!.getPipWindow()?.document;
      const child = pipDoc?.body.querySelector('[data-testid="portal-child"]');
      expect(child).toBeDefined();
      expect(child?.textContent).toBe('Portal Content');
    });
  });

  it('preserves children state when moving to pip', async () => {
    render(
      <PipWrapper id="move-test-id" open={true} mode="move">
        <input data-testid="move-input" defaultValue="hello" />
      </PipWrapper>
    );

    const { waitFor } = await import('@testing-library/react');
    await waitFor(async () => {
      const { getPip } = await import('@pip-it-up/core');
      const pip = getPip('move-test-id');
      expect(pip).not.toBeNull();
      
      const pipDoc = pip!.getPipWindow()?.document;
      const input = pipDoc?.body.querySelector('[data-testid="move-input"]') as HTMLInputElement;
      expect(input).toBeDefined();
      expect(input.value).toBe('hello');
    });
  });
});
