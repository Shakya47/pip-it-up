import { describe, it, expect, vi } from 'vitest';
import { applyMoveMode, applyCloneMode } from '../src/dom-modes';

describe('dom-modes', () => {
  it('move mode appends node and restores', () => {
    const pipWin: any = { document: { body: document.createElement('body') } };
    const content = document.createElement('div');
    const origin = document.createElement('div');
    document.body.appendChild(origin);
    origin.appendChild(content);

    const cleanup = applyMoveMode(pipWin, content, { getOriginEl: () => origin, reserveSpace: false });
    
    expect(pipWin.document.body.contains(content)).toBe(true);
    expect(origin.contains(content)).toBe(false);

    cleanup();
    expect(origin.contains(content)).toBe(true);
    document.body.removeChild(origin);
  });

  it('move mode reserves space', () => {
    const pipWin: any = { document: { body: document.createElement('body') } };
    const content = document.createElement('div');
    content.getBoundingClientRect = () => ({ width: 100, height: 200 } as any);
    const origin = document.createElement('div');
    document.body.appendChild(origin);
    origin.appendChild(content);

    const cleanup = applyMoveMode(pipWin, content, { getOriginEl: () => origin, reserveSpace: true });
    
    expect(origin.style.minWidth).toBe('100px');
    expect(origin.style.minHeight).toBe('200px');

    cleanup();
    expect(origin.style.minWidth).toBe('');
    expect(origin.style.minHeight).toBe('');
    document.body.removeChild(origin);
  });

  it('clone mode clones node', () => {
    const pipWin: any = { document: { body: document.createElement('body') } };
    const content = document.createElement('div');
    content.id = 'test-clone';

    applyCloneMode(pipWin, content);
    
    expect(pipWin.document.body.children[0].id).toBe('test-clone');
    expect(pipWin.document.body.children[0]).not.toBe(content);
  });

  it('restores into the node resolved at close time', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    document.body.appendChild(a);
    document.body.appendChild(b);
    const content = document.createElement('div');
    a.appendChild(content);

    const win: any = { document: { body: document.createElement('body') } };
    let origin: HTMLElement | undefined = a;
    const cleanup = applyMoveMode(win, content, { getOriginEl: () => origin, reserveSpace: true });

    origin = b;
    cleanup();

    expect(b.contains(content)).toBe(true);
    expect(a.contains(content)).toBe(false);

    document.body.removeChild(a);
    document.body.removeChild(b);
  });

  it('falls back when the origin is detached', () => {
    const win: any = { document: { body: document.createElement('body') } };
    const content = document.createElement('div');
    const detachedOrigin = document.createElement('div');
    const fallback = document.createElement('div');
    document.body.appendChild(fallback);

    const cleanup = applyMoveMode(win, content, {
      getOriginEl: () => detachedOrigin,
      reserveSpace: true,
      getFallbackParent: () => fallback,
    });
    cleanup();

    expect(fallback.contains(content)).toBe(true);
    document.body.removeChild(fallback);
  });

  it('warns and leaves content in place with no fallback', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const win: any = { document: { body: document.createElement('body') } };
    const content = document.createElement('div');
    const detachedOrigin = document.createElement('div');

    const cleanup = applyMoveMode(win, content, {
      getOriginEl: () => detachedOrigin,
      reserveSpace: true,
    });
    const parentBefore = content.parentNode;
    cleanup();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[pip-it-up] No usable restore target for move mode; content remains in the PiP document.'
    );
    expect(content.parentNode).toBe(parentBefore);
    warnSpy.mockRestore();
  });

  it('never calls contentEl.remove on the warn path', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const win: any = { document: { body: document.createElement('body') } };
    const content = document.createElement('div');
    const removeSpy = vi.spyOn(content, 'remove');
    const detachedOrigin = document.createElement('div');

    const cleanup = applyMoveMode(win, content, {
      getOriginEl: () => detachedOrigin,
      reserveSpace: true,
    });
    cleanup();

    expect(removeSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('clears content styles even when the origin is unusable', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const win: any = { document: { body: document.createElement('body') } };
    const content = document.createElement('div');
    content.getBoundingClientRect = () => ({ width: 100, height: 200 } as any);
    const detachedOrigin = document.createElement('div');

    const cleanup = applyMoveMode(win, content, {
      getOriginEl: () => detachedOrigin,
      reserveSpace: true,
    });
    expect(content.style.width).toBe('100px');
    expect(content.style.height).toBe('200px');
    cleanup();

    expect(content.style.width).toBe('');
    expect(content.style.height).toBe('');
    warnSpy.mockRestore();
  });

  it('writes no styles when reserveSpace is false', () => {
    const win: any = { document: { body: document.createElement('body') } };
    const content = document.createElement('div');
    content.getBoundingClientRect = () => ({ width: 100, height: 200 } as any);
    const origin = document.createElement('div');
    document.body.appendChild(origin);

    applyMoveMode(win, content, { getOriginEl: () => origin, reserveSpace: false });
    expect(origin.style.minWidth).toBe('');
    expect(origin.style.width).toBe('');
    expect(origin.style.minHeight).toBe('');
    expect(origin.style.height).toBe('');
    expect(content.style.width).toBe('');
    expect(content.style.height).toBe('');
    document.body.removeChild(origin);
  });

  it('does not write styles to a detached origin at open', () => {
    const win: any = { document: { body: document.createElement('body') } };
    const content = document.createElement('div');
    content.getBoundingClientRect = () => ({ width: 100, height: 200 } as any);
    const detachedOrigin = document.createElement('div');

    applyMoveMode(win, content, { getOriginEl: () => detachedOrigin, reserveSpace: true });
    expect(detachedOrigin.style.width).toBe('');
    expect(detachedOrigin.style.minWidth).toBe('');
    expect(detachedOrigin.style.height).toBe('');
    expect(detachedOrigin.style.minHeight).toBe('');
    expect(content.style.width).toBe('100px');
    expect(content.style.height).toBe('200px');
  });

  it('survives a throwing getOriginEl', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const win: any = { document: { body: document.createElement('body') } };
    const content = document.createElement('div');
    content.getBoundingClientRect = () => ({ width: 100, height: 200 } as any);

    const cleanup = applyMoveMode(win, content, {
      getOriginEl: () => {
        throw new Error('boom');
      },
      reserveSpace: true,
    });
    expect(() => cleanup()).not.toThrow();
    expect(content.style.width).toBe('');
    expect(content.style.height).toBe('');
    warnSpy.mockRestore();
  });

  it('disposer is idempotent', () => {
    const win: any = { document: { body: document.createElement('body') } };
    const content = document.createElement('div');
    const origin = document.createElement('div');
    document.body.appendChild(origin);

    const cleanup = applyMoveMode(win, content, { getOriginEl: () => origin, reserveSpace: true });
    expect(() => {
      cleanup();
      cleanup();
    }).not.toThrow();
    expect(origin.contains(content)).toBe(true);
    document.body.removeChild(origin);
  });

  it('uses appendChild, never adoptNode', () => {
    const adoptSpy = vi.spyOn(document, 'adoptNode');
    const win: any = { document: { body: document.createElement('body') } };
    const content = document.createElement('div');
    const origin = document.createElement('div');
    document.body.appendChild(origin);

    const cleanup = applyMoveMode(win, content, { getOriginEl: () => origin, reserveSpace: true });
    cleanup();
    expect(adoptSpy).not.toHaveBeenCalled();
    adoptSpy.mockRestore();
    document.body.removeChild(origin);
  });
});
