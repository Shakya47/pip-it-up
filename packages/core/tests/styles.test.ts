import { describe, it, expect, beforeEach, vi } from 'vitest';
import { copyStylesOnce, startStylesSync } from '../src/styles';

describe('styles', () => {
  let pipWindow: any;

  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.documentElement.className = '';
    document.documentElement.style.cssText = '';
    pipWindow = {
      document: {
        head: document.createElement('head'),
        body: document.createElement('body'),
        documentElement: document.createElement('html'),
      }
    };
  });

  it('copyStylesOnce copies existing styles', () => {
    const style = document.createElement('style');
    style.textContent = 'body { color: red; }';
    document.head.appendChild(style);

    document.documentElement.className = 'dark';

    copyStylesOnce(pipWindow);

    expect(pipWindow.document.head.innerHTML).toContain('color: red');
    expect(pipWindow.document.documentElement.className).toBe('dark');
  });

  it('startStylesSync tracks new styles', async () => {
    const cleanup = startStylesSync(pipWindow);
    
    // Add new style
    const style = document.createElement('style');
    style.textContent = 'p { margin: 0; }';
    document.head.appendChild(style);

    // Poll for the mutation observer instead of a fixed wait (fixed waits flake under load)
    await vi.waitFor(() => expect(pipWindow.document.head.innerHTML).toContain('margin: 0'));
    
    // Change style text via nodeValue to trigger characterData mutation
    if (style.firstChild) {
      style.firstChild.nodeValue = 'p { margin: 10px; }';
    }
    await vi.waitFor(() => expect(pipWindow.document.head.innerHTML).toContain('margin: 10px'));
    
    // Remove style
    document.head.removeChild(style);
    await vi.waitFor(() => expect(pipWindow.document.head.innerHTML).not.toContain('margin: 10px'));
    
    cleanup();
  });

  it('startStylesSync tracks attribute changes', async () => {
    const cleanup = startStylesSync(pipWindow);
    
    document.documentElement.setAttribute('data-theme', 'dark');
    await vi.waitFor(() => expect(pipWindow.document.documentElement.getAttribute('data-theme')).toBe('dark'));
    
    document.body.removeAttribute('data-theme'); // initially not set, just to test remove
    document.body.setAttribute('data-theme', 'light');
    await vi.waitFor(() => expect(pipWindow.document.body.getAttribute('data-theme')).toBe('light'));

    document.documentElement.removeAttribute('data-theme');
    await vi.waitFor(() => expect(pipWindow.document.documentElement.getAttribute('data-theme')).toBeNull());

    cleanup();
  });
});
