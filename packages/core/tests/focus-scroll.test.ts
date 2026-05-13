import { describe, it, expect } from 'vitest';
import { snapshotScrollFocus } from '../src/focus-scroll';

describe('focus-scroll', () => {
  it('snapshots and restores scroll', () => {
    const root = document.createElement('div');
    const child = document.createElement('div');
    
    Object.defineProperty(child, 'scrollTop', { value: 100, writable: true });
    root.appendChild(child);

    const snap = snapshotScrollFocus(root);
    
    child.scrollTop = 0;
    snap.restore();

    expect(child.scrollTop).toBe(100);
  });

  it('snapshots and restores input selection', () => {
    const root = document.createElement('div');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'hello world';
    root.appendChild(input);
    document.body.appendChild(root);

    // mock setSelectionRange and properties
    let start = 2, end = 5, dir: any = 'forward';
    Object.defineProperty(input, 'selectionStart', { get: () => start, set: (v) => start = v });
    Object.defineProperty(input, 'selectionEnd', { get: () => end, set: (v) => end = v });
    Object.defineProperty(input, 'selectionDirection', { get: () => dir, set: (v) => dir = v });
    
    input.setSelectionRange = (s, e, d) => {
      start = s ?? 0;
      end = e ?? 0;
      dir = d;
    };
    
    input.focus();
    
    const snap = snapshotScrollFocus(root);
    
    // mess it up
    input.setSelectionRange(0, 0, 'none');
    
    snap.restore();
    
    expect(start).toBe(2);
    expect(end).toBe(5);
    expect(dir).toBe('forward');
    
    document.body.removeChild(root);
  });
});
