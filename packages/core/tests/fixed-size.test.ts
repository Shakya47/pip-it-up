import { describe, it, expect, vi } from 'vitest';
import { attachFixedSizeGuard } from '../src/fixed-size';

describe('fixed-size guard', () => {
  it('should call resizeTo on window resize', () => {
    const mockWindow: any = {
      innerWidth: 100,
      innerHeight: 100,
      resizeTo: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const cleanup = attachFixedSizeGuard(mockWindow, 500, 400);
    expect(mockWindow.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));

    const resizeHandler = mockWindow.addEventListener.mock.calls[0][1];
    
    mockWindow.innerWidth = 800;
    resizeHandler();

    expect(mockWindow.resizeTo).toHaveBeenCalledWith(500, 400);

    cleanup();
    expect(mockWindow.removeEventListener).toHaveBeenCalledWith('resize', resizeHandler);
  });
});
