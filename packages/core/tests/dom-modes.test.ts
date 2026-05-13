import { describe, it, expect } from 'vitest';
import { applyMoveMode, applyCloneMode, applyPortalAnchorMode } from '../src/dom-modes';

describe('dom-modes', () => {
  it('move mode appends node and restores', () => {
    const pipWin: any = { document: { body: document.createElement('body') } };
    const content = document.createElement('div');
    const origin = document.createElement('div');
    origin.appendChild(content);

    const cleanup = applyMoveMode(pipWin, content, origin);
    
    expect(pipWin.document.body.contains(content)).toBe(true);
    expect(origin.contains(content)).toBe(false);

    cleanup();
    expect(origin.contains(content)).toBe(true);
  });

  it('clone mode clones node', () => {
    const pipWin: any = { document: { body: document.createElement('body') } };
    const content = document.createElement('div');
    content.id = 'test-clone';

    applyCloneMode(pipWin, content);
    
    expect(pipWin.document.body.children[0].id).toBe('test-clone');
    expect(pipWin.document.body.children[0]).not.toBe(content);
  });

  it('portal mode does not alter dom directly', () => {
    const pipWin: any = { document: { body: document.createElement('body') } };
    
    const cleanup = applyPortalAnchorMode(pipWin);
    
    expect(typeof cleanup).toBe('function');
    
    cleanup();
  });
});
