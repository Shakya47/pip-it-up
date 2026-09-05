import type { ElementSlot, ElementPatch, PipElements } from './types';

export const ELEMENT_SLOTS: readonly ElementSlot[] = ['contentEl', 'originEl'];

export function mergeElements(current: PipElements, patch: ElementPatch): PipElements {
  let draft: PipElements | null = null;

  for (const slot of ELEMENT_SLOTS) {
    if (!(slot in patch)) continue;
    const value = patch[slot];
    if (value === undefined) continue;
    const next = value === null ? undefined : value;
    if (current[slot] === next) continue;
    if (draft === null) draft = { ...current };
    if (next === undefined) {
      delete draft[slot];
    } else {
      draft[slot] = next;
    }
  }

  return draft ?? current;
}

export function isUsable(el: Element | null | undefined): el is HTMLElement {
  if (!el) return false;
  if (!el.isConnected) return false;
  const doc = el.ownerDocument;
  if (!doc) return false;
  const view = doc.defaultView;
  if (!view) return false;
  if (view !== window && view.closed) return false;
  return true;
}
