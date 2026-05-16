import { describe, it, expect } from 'vitest';
import { applyMoveMode, applyCloneMode } from '../src/dom-modes';

describe('dom-modes', () => {
  it('move mode appends node and restores', () => {
    const pipWin: any = { document: { body: document.createElement('body') } };
    const content = document.createElement('div');
    const origin = document.createElement('div');
    origin.appendChild(content);

    const cleanup = applyMoveMode(pipWin, content, origin, false);
    
    expect(pipWin.document.body.contains(content)).toBe(true);
    expect(origin.contains(content)).toBe(false);

    cleanup();
    expect(origin.contains(content)).toBe(true);
  });

  it('move mode reserves space', () => {
    const pipWin: any = { document: { body: document.createElement('body') } };
    const content = document.createElement('div');
    content.getBoundingClientRect = () => ({ width: 100, height: 200 } as any);
    const origin = document.createElement('div');
    origin.appendChild(content);

    const cleanup = applyMoveMode(pipWin, content, origin, true);
    
    expect(origin.style.minWidth).toBe('100px');
    expect(origin.style.minHeight).toBe('200px');

    cleanup();
    expect(origin.style.minWidth).toBe('');
    expect(origin.style.minHeight).toBe('');
  });

  it('clone mode clones node', () => {
    const pipWin: any = { document: { body: document.createElement('body') } };
    const content = document.createElement('div');
    content.id = 'test-clone';

    applyCloneMode(pipWin, content);
    
    expect(pipWin.document.body.children[0].id).toBe('test-clone');
    expect(pipWin.document.body.children[0]).not.toBe(content);
  });

});
