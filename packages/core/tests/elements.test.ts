import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mergeElements, isUsable, ELEMENT_SLOTS } from '../src/elements';
import type { ElementPatch } from '../src/types';

describe('ELEMENT_SLOTS', () => {
  it('contains contentEl and originEl', () => {
    expect(ELEMENT_SLOTS).toEqual(['contentEl', 'originEl']);
  });

  it('index exports mergeElements, isUsable, and ELEMENT_SLOTS', async () => {
    const index = await import('../src/index');
    expect(index.mergeElements).toBe(mergeElements);
    expect(index.isUsable).toBe(isUsable);
    expect(index.ELEMENT_SLOTS).toBe(ELEMENT_SLOTS);
  });
});

describe('mergeElements', () => {
  it('undefined value does not clobber a sibling slot', () => {
    const c = document.createElement('div');
    const result = mergeElements({ contentEl: c }, { originEl: undefined });
    expect(result.contentEl).toBe(c);
  });

  it('absent key does not clobber', () => {
    const c = document.createElement('div');
    const o = document.createElement('div');
    const cur = { contentEl: c, originEl: o };
    const result = mergeElements(cur, {});
    expect(result).toBe(cur);
  });

  it('null clears the slot by deleting the key', () => {
    const o = document.createElement('div');
    const result = mergeElements({ originEl: o }, { originEl: null });
    expect('originEl' in result).toBe(false);
  });

  it('HTMLElement claims the slot', () => {
    const o = document.createElement('div');
    const result = mergeElements({}, { originEl: o });
    expect(result.originEl).toBe(o);
  });

  it('no-op returns current by reference', () => {
    const c = document.createElement('div');
    const cur = { contentEl: c };
    expect(mergeElements(cur, {})).toBe(cur);
  });

  it('same-value claim returns current by reference', () => {
    const o = document.createElement('div');
    const cur = { originEl: o };
    expect(mergeElements(cur, { originEl: o })).toBe(cur);
  });

  it('clearing an empty slot returns current by reference', () => {
    const cur = {};
    expect(mergeElements(cur, { originEl: null })).toBe(cur);
  });

  it('does not mutate the input', () => {
    const c = document.createElement('div');
    const o = document.createElement('div');
    const cur = { contentEl: c };
    mergeElements(cur, { originEl: o });
    expect(cur).toEqual({ contentEl: c });
  });

  it('ignores unknown keys', () => {
    const o = document.createElement('div');
    const result = mergeElements({}, { bogus: o } as unknown as ElementPatch);
    expect(result).toEqual({});
  });

  it('claims multiple slots in a single patch and updates existing draft', () => {
    const c = document.createElement('div');
    const o = document.createElement('div');
    const cur = {};
    const result = mergeElements(cur, { contentEl: c, originEl: o });
    expect(result).not.toBe(cur);
    expect(result).toEqual({ contentEl: c, originEl: o });
  });

  it('clears one slot and updates another in the same patch', () => {
    const c = document.createElement('div');
    const o1 = document.createElement('div');
    const o2 = document.createElement('div');
    const cur = { contentEl: c, originEl: o1 };
    const result = mergeElements(cur, { contentEl: null, originEl: o2 });
    expect('contentEl' in result).toBe(false);
    expect(result.originEl).toBe(o2);
  });
});

describe('isUsable', () => {
  let createdNodes: HTMLElement[] = [];

  beforeEach(() => {
    createdNodes = [];
  });

  afterEach(() => {
    for (const node of createdNodes) {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    }
  });

  it('isUsable rejects null and undefined', () => {
    expect(isUsable(null)).toBe(false);
    expect(isUsable(undefined)).toBe(false);
  });

  it('isUsable rejects a detached element', () => {
    const el = document.createElement('div');
    expect(isUsable(el)).toBe(false);
  });

  it('isUsable rejects a node in a document with no defaultView', () => {
    const d = document.implementation.createHTMLDocument('t');
    const el = d.createElement('div');
    d.body.appendChild(el);
    expect(isUsable(el)).toBe(false);
  });

  it('isUsable rejects a node whose window is closed', () => {
    const d = document.implementation.createHTMLDocument('t');
    const el = d.createElement('div');
    d.body.appendChild(el);
    Object.defineProperty(d, 'defaultView', {
      value: { closed: true },
      configurable: true,
    });
    expect(isUsable(el)).toBe(false);
  });

  it('isUsable accepts an attached element', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    createdNodes.push(el);
    expect(isUsable(el)).toBe(true);
  });

  it('isUsable(document.body) is true in a jsdom test environment', () => {
    expect(isUsable(document.body)).toBe(true);
  });

  it('isUsable rejects a node with no ownerDocument', () => {
    const stubEl = {
      isConnected: true,
      ownerDocument: null,
    } as unknown as Element;
    expect(isUsable(stubEl)).toBe(false);
  });

  it('isUsable accepts a node in an open secondary window', () => {
    const d = document.implementation.createHTMLDocument('t');
    const el = d.createElement('div');
    d.body.appendChild(el);
    Object.defineProperty(d, 'defaultView', {
      value: { closed: false },
      configurable: true,
    });
    expect(isUsable(el)).toBe(true);
  });
});
