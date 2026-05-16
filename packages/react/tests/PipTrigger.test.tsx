import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { PipWrapper } from '../src/PipWrapper';
import { PipTrigger } from '../src/PipTrigger';

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
    render(
      <PipTrigger asChild>
        <a href="#" data-testid="custom">Custom</a>
      </PipTrigger>
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
});
