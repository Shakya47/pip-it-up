/**
 * Clones every `link[rel="stylesheet"]` and `style` from the opener into the PiP document.
 *
 * REQUIRED: without this the PiP window renders unstyled. It cannot be disabled without
 * breaking core functionality (MAINTENANCE_GUIDE Section 6).
 *
 * Consequence 1 — external CSS is fetched TWICE, once per document. For an authenticated or
 * private-CDN stylesheet the PiP fetch may fail silently, producing an unstyled PiP window
 * with no error. Workaround: `copyStyles: 'once'` plus pre-inlined critical CSS.
 *
 * Consequence 2 — cloned `style` text is replicated verbatim. Any attacker-influenced CSS in
 * the opener reaches the PiP document too. That is an opener-side problem, but style sync
 * widens its blast radius to a second document.
 *
 * The head MutationObserver watches `subtree: true, characterData: true` so every CSS-in-JS
 * rule append is replicated; that is intentional and load-bearing for Tailwind and Emotion.
 * The requestAnimationFrame batching in scheduleTextUpdate is what keeps it cheap. Do not
 * remove the batching.
 */
export const copyStylesOnce = (pipWindow: Window) => {
  const pipDoc = pipWindow.document;
  const openerDoc = window.document;

  const stylesheets = Array.from(openerDoc.querySelectorAll('link[rel="stylesheet"], style'));
  for (const sheet of stylesheets) {
    pipDoc.head.appendChild(sheet.cloneNode(true));
  }

  syncAttrs(openerDoc.documentElement, pipDoc.documentElement);
  syncAttrs(openerDoc.body, pipDoc.body);
};

const syncAttrs = (source: HTMLElement, target: HTMLElement) => {
  target.className = source.className;
  target.style.cssText = source.style.cssText;
  for (const attr of Array.from(source.attributes)) {
    if (attr.name.startsWith('data-')) {
      target.setAttribute(attr.name, attr.value);
    }
  }
};

// See copyStylesOnce JSDoc above for style copying invariants, Consequence 1 (fetch twice), and Consequence 2 (CSS replication).
// packages/core/src/styles.ts — observers are not listeners; signature unchanged (DEF-401 §2, §4.8).
export const startStylesSync = (pipWindow: Window): (() => void) => {
  const pipDoc = pipWindow.document;
  const openerDoc = window.document;
  const nodeMap = new WeakMap<Node, Node>();

  const stylesheets = Array.from(openerDoc.querySelectorAll('link[rel="stylesheet"], style'));
  for (const sheet of stylesheets) {
    const clone = sheet.cloneNode(true);
    nodeMap.set(sheet, clone);
    pipDoc.head.appendChild(clone);
  }

  syncAttrs(openerDoc.documentElement, pipDoc.documentElement);
  syncAttrs(openerDoc.body, pipDoc.body);

  const pendingTextUpdates = new Map<Node, Node>();
  let pendingRafId: number | null = null;

  const flushTextUpdates = () => {
    pendingRafId = null;
    for (const [source, clone] of pendingTextUpdates) {
      clone.textContent = source.textContent;
    }
    pendingTextUpdates.clear();
  };

  const scheduleTextUpdate = (sourceStyle: Node, clone: Node) => {
    pendingTextUpdates.set(sourceStyle, clone);
    if (pendingRafId === null) {
      pendingRafId = requestAnimationFrame(flushTextUpdates);
    }
  };

  const syncStyleAncestor = (target: Node) => {
    let current: Node | null = target;
    while (current && current.nodeName !== 'STYLE') {
      current = current.parentNode;
    }
    if (current) {
      const clone = nodeMap.get(current);
      if (clone) {
        scheduleTextUpdate(current, clone);
      }
    }
  };

  const headObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node.nodeName === 'STYLE' || (node.nodeName === 'LINK' && (node as HTMLLinkElement).rel === 'stylesheet')) {
            const existingClone = nodeMap.get(node);
            if (existingClone) continue;

            const clone = node.cloneNode(true);
            nodeMap.set(node, clone);
            pipDoc.head.appendChild(clone);
          }
        }
        for (const node of Array.from(mutation.removedNodes)) {
          const clone = nodeMap.get(node);
          if (clone && clone.parentNode) {
            clone.parentNode.removeChild(clone);
            nodeMap.delete(node);
          }
        }

        // Sync text node child updates within observed STYLE elements (e.g. CSS-in-JS rule appends)
        syncStyleAncestor(mutation.target);
      } else if (mutation.type === 'characterData') {
        syncStyleAncestor(mutation.target);
      }
    }
  });

  headObserver.observe(openerDoc.head, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  const attrObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        const source = mutation.target as HTMLElement;
        const attrName = mutation.attributeName;
        if (!attrName) continue;
        let target: HTMLElement | null = null;
        if (source === openerDoc.documentElement) target = pipDoc.documentElement;
        else if (source === openerDoc.body) target = pipDoc.body;
        if (target) {
          const val = source.getAttribute(attrName);
          if (val === null) {
            target.removeAttribute(attrName);
          } else {
            target.setAttribute(attrName, val);
          }
        }
      }
    }
  });

  attrObserver.observe(openerDoc.documentElement, { attributes: true });
  attrObserver.observe(openerDoc.body, { attributes: true });

  return () => {
    // Leak vector L12: both observers and the pending-update map must be released.
    headObserver.disconnect();
    attrObserver.disconnect();
    if (pendingRafId !== null) {
      cancelAnimationFrame(pendingRafId);
      pendingRafId = null;
    }
    pendingTextUpdates.clear();
  };
};
