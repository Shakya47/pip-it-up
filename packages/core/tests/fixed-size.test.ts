import { describe, it, expect, vi } from 'vitest';
import { attachFixedSizeGuard } from '../src/fixed-size';

describe('fixed-size guard', () => {
  const makeWindow = () => ({
    resizeTo: vi.fn(),
    addEventListener: vi.fn(),
    document: { documentElement: { style: {} as Record<string, string> }, body: { style: {} as Record<string, string> } },
  });

  it('locks html and body to the size with overflow hidden', () => {
    const win = makeWindow();
    attachFixedSizeGuard(win as unknown as Window, 500, 400);

    expect(win.document.documentElement.style).toMatchObject({ width: '500px', height: '400px', overflow: 'hidden' });
    expect(win.document.body.style).toMatchObject({ width: '500px', height: '400px', overflow: 'hidden', margin: '0' });
  });

  it('never tries to resize the window back (resizeTo needs a user gesture and sets the outer size)', () => {
    const win = makeWindow();
    attachFixedSizeGuard(win as unknown as Window, 500, 400);

    expect(win.addEventListener).not.toHaveBeenCalled();
    expect(win.resizeTo).not.toHaveBeenCalled();
  });
});
