import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getGarage,
  moveHost,
  __resetGarageCacheForTests,
  GARAGE_ATTR,
} from '../src/garage';
import { PipError } from '../src/errors';

describe('garage and moveHost', () => {
  afterEach(() => {
    document.querySelectorAll(`[${GARAGE_ATTR}]`).forEach((el) => el.remove());
    __resetGarageCacheForTests();
    vi.restoreAllMocks();
  });

  it('creates one garage attached to body', () => {
    const el = getGarage();
    expect(el.isConnected).toBe(true);
    expect(el.parentElement).toBe(document.body);
  });

  it('returns the same element on repeat calls', () => {
    const el1 = getGarage();
    const el2 = getGarage();
    expect(el1).toBe(el2);
  });

  it('adopts an existing garage after a cache reset', () => {
    getGarage();
    __resetGarageCacheForTests();
    getGarage();
    expect(document.querySelectorAll('[data-pip-garage]').length).toBe(1);
  });

  it('recreates the garage when it was removed', () => {
    const el1 = getGarage();
    el1.remove();
    const el2 = getGarage();
    expect(el2.isConnected).toBe(true);
    expect(el2).not.toBe(el1);
  });

  it('carries inert and aria-hidden', () => {
    const el = getGarage();
    expect(el.hasAttribute('inert')).toBe(true);
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('skips layout and paint via content-visibility', () => {
    const el = getGarage();
    expect(el.style.cssText).toContain('content-visibility: hidden');
    expect(el.style.cssText).toContain('contain-intrinsic-size: 0 0');
  });

  it('no-ops when already last child', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const node = document.createElement('div');
    target.appendChild(node);

    const records: MutationRecord[] = [];
    const observer = new MutationObserver((mutations) => {
      records.push(...mutations);
    });
    observer.observe(target, { childList: true });

    moveHost(node, target);

    records.push(...observer.takeRecords());
    expect(records.length).toBe(0);

    observer.disconnect();
    target.remove();
  });

  it('moves a non-last child to the end', () => {
    const target = document.createElement('div');
    const node = document.createElement('div');
    const other = document.createElement('div');
    target.appendChild(node);
    target.appendChild(other);
    document.body.appendChild(target);

    moveHost(node, target);
    expect(target.lastChild).toBe(node);

    target.remove();
  });

  it('prefers moveBefore in the same document', () => {
    const target = document.createElement('div');
    const node = document.createElement('div');
    document.body.appendChild(target);
    document.body.appendChild(node);

    const moveBeforeSpy = vi.fn();
    (target as unknown as { moveBefore: typeof moveBeforeSpy }).moveBefore = moveBeforeSpy;
    const appendChildSpy = vi.spyOn(target, 'appendChild');

    moveHost(node, target);

    expect(moveBeforeSpy).toHaveBeenCalledWith(node, null);
    expect(appendChildSpy).not.toHaveBeenCalled();

    target.remove();
    node.remove();
  });

  it('falls back to appendChild when moveBefore throws', () => {
    const target = document.createElement('div');
    const node = document.createElement('div');
    document.body.appendChild(target);
    document.body.appendChild(node);

    (target as unknown as { moveBefore: () => void }).moveBefore = vi.fn(() => {
      throw new Error('HierarchyRequestError');
    });

    expect(() => moveHost(node, target)).not.toThrow();
    expect(target.contains(node)).toBe(true);

    target.remove();
    node.remove();
  });

  it('never calls moveBefore across documents', () => {
    const doc2 = document.implementation.createHTMLDocument('t');
    const target = doc2.createElement('div');
    doc2.body.appendChild(target);

    const moveBeforeSpy = vi.fn();
    (target as unknown as { moveBefore: typeof moveBeforeSpy }).moveBefore = moveBeforeSpy;

    const node = document.createElement('div');
    document.body.appendChild(node);

    moveHost(node, target);

    expect(moveBeforeSpy).not.toHaveBeenCalled();
    expect(target.contains(node)).toBe(true);

    node.remove();
  });

  it('never calls adoptNode', () => {
    const adoptSpy = vi.spyOn(document, 'adoptNode');
    const target = document.createElement('div');
    const node = document.createElement('div');
    document.body.appendChild(target);
    document.body.appendChild(node);

    moveHost(node, target);

    expect(adoptSpy).not.toHaveBeenCalled();
    adoptSpy.mockRestore();
    target.remove();
    node.remove();
  });

  it('throws ERR_SHUTTLE_MOVE_FAILED when both primitives fail', () => {
    const target = document.createElement('div');
    const node = document.createElement('div');
    document.body.appendChild(target);
    document.body.appendChild(node);

    (target as unknown as { moveBefore: () => void }).moveBefore = vi.fn(() => {
      throw new Error('moveBefore failure');
    });
    vi.spyOn(target, 'appendChild').mockImplementation(() => {
      throw new Error('appendChild failure');
    });

    let caughtError: unknown;
    try {
      moveHost(node, target);
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(PipError);
    expect((caughtError as PipError).code).toBe('ERR_SHUTTLE_MOVE_FAILED');

    target.remove();
    node.remove();
  });

  it('skips moveBefore for a disconnected node', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const node = document.createElement('div');

    const moveBeforeSpy = vi.fn();
    (target as unknown as { moveBefore: typeof moveBeforeSpy }).moveBefore = moveBeforeSpy;

    moveHost(node, target);

    expect(moveBeforeSpy).not.toHaveBeenCalled();
    expect(target.lastChild).toBe(node);

    target.remove();
  });
});
