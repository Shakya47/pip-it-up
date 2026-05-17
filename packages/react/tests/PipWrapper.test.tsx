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
      <PipWrapper id="portal-test-id" open={true} mode="portal" onOpenChange={() => { }}>
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

  it('renders custom placeholder when open and in move mode', async () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = () => ({ width: 400, height: 300 } as any);

    const { rerender } = render(
      <PipWrapper id="placeholder-test" open={true} mode="move" placeholder={<div data-testid="custom-placeholder">Custom</div>}>
        <div data-testid="move-child">Content</div>
      </PipWrapper>
    );

    const { waitFor } = await import('@testing-library/react');
    const { getPip } = await import('@pip-it-up/core');

    await waitFor(async () => {
      const placeholder = screen.getByTestId('custom-placeholder');
      expect(placeholder).toBeInTheDocument();

      const pip = getPip('placeholder-test');
      const pipDoc = pip?.getPipWindow()?.document;
      const child = pipDoc?.body.querySelector('[data-testid="move-child"]');
      expect(child).toBeDefined();
      expect(child?.textContent).toBe('Content');

      const originEl = placeholder.parentElement?.parentElement;
      expect(originEl?.style.width).toBe('400px');
      expect(originEl?.style.height).toBe('300px');
    });

    rerender(
      <PipWrapper id="placeholder-test" open={false} mode="move" placeholder={<div data-testid="custom-placeholder">Custom</div>}>
        <div data-testid="move-child">Content</div>
      </PipWrapper>
    );

    await waitFor(() => {
      const originEl = screen.getByTestId('move-child').parentElement;
      expect(originEl?.style.width).toBe('');
      expect(originEl?.style.height).toBe('');
    });

    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  it('correctly reports isInsidePip from context (Bug 1)', () => {
    let insidePipValue = true; // assume true to verify it changes to false
    const Child = () => {
      const { isInsidePip } = usePipContext();
      insidePipValue = isInsidePip;
      return null;
    };

    render(<PipWrapper open={true}><Child /></PipWrapper>);

    // In JSDOM, window.documentPictureInPicture.window is a mock, not equal to window.
    expect(insidePipValue).toBe(false);
  });

  it('recreates instance on remount to simulate Strict Mode (Bug 2)', async () => {
    const { getPip } = await import('@pip-it-up/core');
    const { unmount } = render(<PipWrapper id="remount-test">Child</PipWrapper>);

    const instance1 = getPip('remount-test');
    expect(instance1).not.toBeNull();

    unmount();

    render(<PipWrapper id="remount-test">Child</PipWrapper>);
    const instance2 = getPip('remount-test');

    expect(instance2).not.toBeNull();
    expect(instance1).not.toBe(instance2);
  });

  it('calls setDefaultElements on mount with DOM refs (Polish 6)', async () => {
    const { getPip } = await import('@pip-it-up/core');
    const { createPip } = await import('@pip-it-up/core');

    // Spy on setDefaultElements by wrapping the instance

    render(
      <PipWrapper id="sde-test">
        <div data-testid="sde-content">Content</div>
      </PipWrapper>
    );

    const instance = getPip('sde-test');
    expect(instance).not.toBeNull();

    // The instance should have default elements set by the useLayoutEffect.
    // We can verify by calling open() and checking that it works (uses default elements).
    // If setDefaultElements wasn't called, open() would have no content element.
    await act(async () => {
      await instance!.open();
    });

    expect(instance!.isOpen()).toBe(true);
    expect(instance!.getPipWindow()).not.toBeNull();
  });

  it('triggers a development warning when iframe is detected inside PipWrapper', async () => {
    const originalEnv = process.env.NODE_ENV;
    // @ts-ignore
    process.env.NODE_ENV = 'development';
    
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <PipWrapper id="iframe-warning-test" open={true}>
        <iframe></iframe>
      </PipWrapper>
    );

    const { waitFor } = await import('@testing-library/react');
    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalled();
    });

    warnSpy.mockRestore();
    // @ts-ignore
    process.env.NODE_ENV = originalEnv;
  });
});
