import React from 'react';
import { render, screen, within, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { mockDocumentPictureInPicture } from '../../core/tests/helpers/mockDocumentPictureInPicture';
import { usePip } from '../src/usePip';
import { PipWrapper } from '../src/PipWrapper';
import { PipTrigger } from '../src/PipTrigger';

/** Remove Document PiP for one test; `restore()` puts it back. */
function withoutDocumentPip() {
  const w = window as unknown as Record<string, unknown>;
  const saved = w.documentPictureInPicture;
  delete w.documentPictureInPicture;
  return { restore: () => (w.documentPictureInPicture = saved) };
}

describe('PipTrigger', () => {
  it('toggles wrapper inside context', async () => {
    const user = userEvent.setup();
    render(
      <PipWrapper>
        <PipTrigger />
      </PipWrapper>
    );

    const trigger = await screen.findByRole('button', { name: '↗ Pop out' });
    await user.click(trigger);

    const pipWin = (window as any).documentPictureInPicture.window;
    const pipWinBody = pipWin ? pipWin.document.body : document.body;

    const { queryByRole } = within(pipWinBody);
    expect(queryByRole('button', { name: '⊠ Close' })).toBeNull();
  });

  it('works decoupled via pipId', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <PipTrigger pipId="test-id" />
        <PipWrapper id="test-id">Content</PipWrapper>
      </div>
    );

    const trigger = await screen.findByRole('button', { name: '↗ Pop out' }, { timeout: 3000 });

    await user.click(trigger);


    const { findByRole } = within(document.body);
    expect(await findByRole('button', { name: '⊠ Close' })).toBeInTheDocument();
  });

  it('supports asChild pattern', async () => {
    // Inside a wrapper: a trigger with no instance to open renders nothing (it can't do anything).
    render(
      <PipWrapper>
        <PipTrigger asChild>
          <a href="#" data-testid="custom">Custom</a>
        </PipTrigger>
      </PipWrapper>
    );
    const link = await screen.findByTestId('custom');
    expect(link.tagName).toBe('A');
    expect(link.textContent).toBe('Custom');
  });

  it('renders renderUnsupported when API is not supported', () => {
    const original = (window as any).documentPictureInPicture;
    delete (window as any).documentPictureInPicture;

    render(
      <PipTrigger renderUnsupported={<span data-testid="unsupported">Not supported</span>} />
    );

    expect(screen.getByTestId('unsupported')).toBeInTheDocument();

    (window as any).documentPictureInPicture = original;
  });

  it('renders disabled state when wrapper mounts later', async () => {
    const { rerender } = render(
      <div>
        <PipTrigger pipId="delayed-id">Remote Trigger</PipTrigger>
      </div>
    );

    const trigger = screen.getByRole('button');
    expect(trigger).toBeDisabled();
    expect(trigger.textContent).toBe('Remote Trigger');

    rerender(
      <div>
        <PipTrigger pipId="delayed-id">Remote Trigger</PipTrigger>
        <PipWrapper id="delayed-id">Content</PipWrapper>
      </div>
    );

    const { waitFor } = await import('@testing-library/react');
    await waitFor(() => {
      expect(trigger).not.toBeDisabled();
      expect(trigger.textContent).toBe('Remote Trigger');
    });
  });

  it('colocated trigger opens PiP via setDefaultElements path', async () => {
    const user = userEvent.setup();
    const { getPip } = await import('@pip-it-up/core');

    render(
      <PipWrapper id="colocated-trigger-test">
        <div data-testid="content">Content</div>
        <PipTrigger />
      </PipWrapper>
    );

    const instance = getPip('colocated-trigger-test');
    expect(instance).not.toBeNull();

    const trigger = await screen.findByRole('button', { name: '↗ Pop out' });
    await user.click(trigger);

    const { waitFor } = await import('@testing-library/react');
    await waitFor(() => {
      expect(instance!.isOpen()).toBe(true);
      expect(instance!.getPipWindow()).not.toBeNull();
    });
  });

  it('decoupled trigger opens PiP via setDefaultElements path', async () => {
    const user = userEvent.setup();
    const { getPip } = await import('@pip-it-up/core');

    render(
      <div>
        <PipTrigger pipId="decoupled-trigger-test" />
        <PipWrapper id="decoupled-trigger-test">
          <div data-testid="decoupled-content">Content</div>
        </PipWrapper>
      </div>
    );

    const { waitFor } = await import('@testing-library/react');

    // Wait for the registry to connect the trigger to the wrapper
    await waitFor(() => {
      expect(getPip('decoupled-trigger-test')).not.toBeNull();
    });

    const trigger = await screen.findByRole('button', { name: '↗ Pop out' });
    await user.click(trigger);

    await waitFor(() => {
      const instance = getPip('decoupled-trigger-test');
      expect(instance!.isOpen()).toBe(true);
      expect(instance!.getPipWindow()).not.toBeNull();
    });
  });

  it('renders correct ARIA attributes reflecting isOpen state', async () => {
    const user = userEvent.setup();
    render(
      <PipWrapper id="aria-test">
        <PipTrigger hideInPip={false} aria-label="Custom Toggle Label" />
      </PipWrapper>
    );

    const trigger = await screen.findByRole('button', { name: 'Custom Toggle Label' });
    expect(trigger).toHaveAttribute('aria-pressed', 'false');
    expect(trigger).toHaveAttribute('aria-label', 'Custom Toggle Label');

    await user.click(trigger);

    const { waitFor } = await import('@testing-library/react');
    await waitFor(() => {
      const pipWin = (window as any).documentPictureInPicture.window;
      expect(pipWin).not.toBeNull();
      const { getByRole } = within(pipWin.document.body);
      const activeTrigger = getByRole('button', { name: 'Custom Toggle Label' });
      expect(activeTrigger).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('without Document PiP, shows renderUnsupported when its wrapper has nothing to fall back to (e2e RX8)', () => {
    // A browser with video PiP only (Safari): browser-level support is true, but this content has no
    // <video>, so the instance can't open anything.
    const original = withoutDocumentPip();
    Object.defineProperty(document, 'pictureInPictureEnabled', { value: true, configurable: true });
    try {
      render(
        <PipWrapper>
          <p>plain content, no video</p>
          <PipTrigger renderUnsupported={<span data-testid="unsupported">Not supported</span>} />
        </PipWrapper>
      );
      expect(screen.getByTestId('unsupported')).toBeInTheDocument();
    } finally {
      delete (document as unknown as Record<string, unknown>).pictureInPictureEnabled;
      original.restore();
    }
  });

  it('without Document PiP, still renders when the wrapper has a fallback configured', async () => {
    const original = withoutDocumentPip();
    render(
      <PipWrapper fallback="new-tab" fallbackUrl="/standalone">
        <p>plain content</p>
        <PipTrigger renderUnsupported={<span data-testid="unsupported">Not supported</span>} />
      </PipWrapper>
    );
    expect(await screen.findByRole('button', { name: '↗ Pop out' })).toBeInTheDocument();
    expect(screen.queryByTestId('unsupported')).toBeNull();
    original.restore();
  });

  describe('when open() fails', () => {
    const settle = () => act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    it('catches the rejection and warns once when nothing else reports it', async () => {
      mockDocumentPictureInPicture({ rejectWithNotAllowed: true });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const unhandled = vi.fn();
      process.on('unhandledRejection', unhandled);
      try {
        render(<PipWrapper><div>content</div><PipTrigger /></PipWrapper>);
        fireEvent.click(await screen.findByRole('button', { name: '↗ Pop out' }));
        await settle();
        const reports = warn.mock.calls.filter((c) => String(c[0]).includes('[PipTrigger]'));
        expect(reports).toHaveLength(1);
        expect(String(reports[0][0])).toContain('NotAllowedError');
        expect(unhandled).not.toHaveBeenCalled();
      } finally {
        process.off('unhandledRejection', unhandled);
        warn.mockRestore();
      }
    });

    it('does not warn when the wrapper has onError (core already reported it)', async () => {
      mockDocumentPictureInPicture({ rejectWithNotAllowed: true });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onError = vi.fn();
      try {
        render(<PipWrapper onError={onError}><div>content</div><PipTrigger /></PipWrapper>);
        fireEvent.click(await screen.findByRole('button', { name: '↗ Pop out' }));
        await settle();
        expect(onError).toHaveBeenCalledTimes(1);
        expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('[PipTrigger]'), expect.anything());
      } finally {
        warn.mockRestore();
      }
    });

    it('does not warn when the remote (pipId) usePip owner has onError', async () => {
      mockDocumentPictureInPicture({ rejectWithNotAllowed: true });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onError = vi.fn();
      function Owner() {
        const { contentRef } = usePip({ id: 'remote-owner', onError });
        return <div ref={contentRef}>content</div>;
      }
      try {
        render(<><Owner /><PipTrigger pipId="remote-owner" /></>);
        fireEvent.click(await screen.findByRole('button', { name: '↗ Pop out' }));
        await settle();
        expect(onError).toHaveBeenCalledTimes(1);
        expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('[PipTrigger]'), expect.anything());
      } finally {
        warn.mockRestore();
      }
    });

    it('does not warn when close() cancels the pending open (ERR_OPEN_ABORTED)', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(<PipWrapper id="abort-trigger"><div>content</div><PipTrigger /></PipWrapper>);
        const button = await screen.findByRole('button', { name: '↗ Pop out' });
        const { getPip } = await import('@pip-it-up/core');
        const toggle = vi.spyOn(getPip('abort-trigger')!, 'toggle');
        fireEvent.click(button);
        getPip('abort-trigger')!.close();
        await settle();
        // The open really was cancelled (not completed and then closed).
        expect(toggle.mock.results[0].value).toMatchObject({ code: 'ERR_OPEN_ABORTED' });
        expect(getPip('abort-trigger')!.isOpen()).toBe(false);
        expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('[PipTrigger]'), expect.anything());
      } finally {
        warn.mockRestore();
      }
    });
  });
});
