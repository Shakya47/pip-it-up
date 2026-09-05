declare global {
  interface Element {
    moveBefore(node: Node, ref: Node | null): void;
  }
}

export interface MoveBeforeController {
  /** Every successful `moveBefore(node, ref)` call, in order. */
  readonly calls: ReadonlyArray<{ parent: Element; node: Node }>;
  /** Make the next `moveBefore` call throw a HierarchyRequestError-shaped DOMException. */
  failNextCall(): void;
  restore(): void;
}

let activeMoveBeforeController: MoveBeforeController | null = null;

/** Installs `Element.prototype.moveBefore`, which jsdom does not implement. */
export function installMockMoveBefore(): MoveBeforeController {
  if (activeMoveBeforeController !== null) {
    throw new Error('moveBefore mock is already installed. Call restore() before installing again.');
  }

  const hadMoveBefore = Object.prototype.hasOwnProperty.call(Element.prototype, 'moveBefore');
  const previousMoveBefore = (Element.prototype as { moveBefore?: (node: Node, ref: Node | null) => void }).moveBefore;
  const calls: Array<{ parent: Element; node: Node }> = [];
  let shouldFailNext = false;
  let restored = false;

  Element.prototype.moveBefore = function (this: Element, node: Node, ref: Node | null): void {
    if (shouldFailNext) {
      shouldFailNext = false;
      throw new DOMException('cross-document move', 'HierarchyRequestError');
    }
    this.insertBefore(node, ref);
    calls.push({ parent: this, node });
  };

  const controller: MoveBeforeController = {
    get calls(): ReadonlyArray<{ parent: Element; node: Node }> {
      return calls;
    },

    failNextCall(): void {
      shouldFailNext = true;
    },

    restore(): void {
      if (restored) return;
      restored = true;
      if (hadMoveBefore && previousMoveBefore) {
        Element.prototype.moveBefore = previousMoveBefore;
      } else {
        delete (Element.prototype as { moveBefore?: unknown }).moveBefore;
      }
      calls.length = 0;
      shouldFailNext = false;
      activeMoveBeforeController = null;
    },
  };

  activeMoveBeforeController = controller;
  return controller;
}

/** Ensures `Element.prototype.moveBefore` is ABSENT, to test the appendChild fallback. */
export function removeMoveBeforeSupport(): () => void {
  const hadMoveBefore = Object.prototype.hasOwnProperty.call(Element.prototype, 'moveBefore');
  const previousMoveBefore = (Element.prototype as { moveBefore?: (node: Node, ref: Node | null) => void }).moveBefore;
  delete (Element.prototype as { moveBefore?: unknown }).moveBefore;

  return () => {
    if (hadMoveBefore && previousMoveBefore) {
      Element.prototype.moveBefore = previousMoveBefore;
    }
  };
}
