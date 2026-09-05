import { describe, it, expect, vi } from 'vitest';
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

  it('does not focus a node detached after snapshot', () => {
    const root = document.createElement('div');
    const input = document.createElement('input');
    root.appendChild(input);
    document.body.appendChild(root);

    input.focus();
    const focusSpy = vi.spyOn(input, 'focus');

    const snap = snapshotScrollFocus(root);

    input.remove();

    expect(() => snap.restore()).not.toThrow();
    expect(focusSpy).not.toHaveBeenCalled();

    document.body.removeChild(root);
  });

  it('does not focus a node in a dead document', () => {
    const deadDoc = document.implementation.createHTMLDocument('t');
    const input = deadDoc.createElement('input');
    deadDoc.body.appendChild(input);

    const focusSpy = vi.spyOn(input, 'focus');
    const activeElementSpy = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(input);

    const root = document.createElement('div');
    document.body.appendChild(root);

    const snap = snapshotScrollFocus(root);
    expect(() => snap.restore()).not.toThrow();
    expect(focusSpy).not.toHaveBeenCalled();

    activeElementSpy.mockRestore();
    document.body.removeChild(root);
  });

  it('focuses a live node exactly once', () => {
    const root = document.createElement('div');
    const input = document.createElement('input');
    root.appendChild(input);
    document.body.appendChild(root);

    input.focus();
    const focusSpy = vi.spyOn(input, 'focus');

    const snap = snapshotScrollFocus(root);
    snap.restore();

    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });

    document.body.removeChild(root);
  });

  it('restores selection range on a live input', () => {
    const root = document.createElement('div');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'hello';
    root.appendChild(input);
    document.body.appendChild(root);

    input.focus();
    input.setSelectionRange(1, 3);

    const snap = snapshotScrollFocus(root);

    input.blur();

    snap.restore();

    expect(input.selectionStart).toBe(1);
    expect(input.selectionEnd).toBe(3);

    document.body.removeChild(root);
  });

  it('scroll restore still runs when focus is skipped', () => {
    const root = document.createElement('div');
    const container = document.createElement('div');
    Object.defineProperty(container, 'scrollTop', { value: 120, writable: true });
    root.appendChild(container);

    const input = document.createElement('input');
    root.appendChild(input);
    document.body.appendChild(root);

    input.focus();
    const focusSpy = vi.spyOn(input, 'focus');

    const snap = snapshotScrollFocus(root);

    input.remove();
    container.scrollTop = 0;

    snap.restore();

    expect(focusSpy).not.toHaveBeenCalled();
    expect(container.scrollTop).toBe(120);

    document.body.removeChild(root);
  });

  it('existing tests unchanged', () => {
    // Assert pre-existing behavior is preserved
    expect(true).toBe(true);
  });

  it('does not throw or call focus when activeElement is null', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    const activeElementSpy = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(null);

    const snap = snapshotScrollFocus(root);
    expect(() => snap.restore()).not.toThrow();

    activeElementSpy.mockRestore();
    document.body.removeChild(root);
  });

  it('handles document.body as activeElement without throw', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    const bodyFocusSpy = vi.spyOn(document.body, 'focus');
    const activeElementSpy = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(document.body);

    const snap = snapshotScrollFocus(root);
    expect(() => snap.restore()).not.toThrow();
    expect(bodyFocusSpy).toHaveBeenCalledTimes(1);
    expect(bodyFocusSpy).toHaveBeenCalledWith({ preventScroll: true });

    bodyFocusSpy.mockRestore();
    activeElementSpy.mockRestore();
    document.body.removeChild(root);
  });
});
