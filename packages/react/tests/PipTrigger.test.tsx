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
    
    // Instead of screen, use within(pipWinBody) or screen if it didn't move
    const { findByRole } = within(pipWinBody);
    expect(await findByRole('button', { name: '⊠ Close' })).toBeTruthy();
  });

  it('works decoupled via pipId', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <PipTrigger pipId="test-id" />
        <PipWrapper id="test-id">Content</PipWrapper>
      </div>
    );

    // Wait for the button to appear
    const trigger = await screen.findByRole('button', { name: '↗ Pop out' }, { timeout: 3000 });
    
    await user.click(trigger);
    
    // The trigger might be in the main document, or the wrapper's content moved
    // Let's check both
    const pipWin = (window as any).documentPictureInPicture.window;
    const { findByRole } = within(document.body);
    // Since trigger is outside the wrapper here, it stays in main document
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
    // temporarily mock window to not have documentPictureInPicture
    const original = (window as any).documentPictureInPicture;
    delete (window as any).documentPictureInPicture;
    
    render(
      <PipTrigger renderUnsupported={<span data-testid="unsupported">Not supported</span>} />
    );
    
    expect(screen.getByTestId('unsupported')).toBeInTheDocument();
    
    // restore
    (window as any).documentPictureInPicture = original;
  });
});
