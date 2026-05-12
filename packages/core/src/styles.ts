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

export const startStylesSync = (pipWindow: Window): (() => void) => {
  const pipDoc = pipWindow.document;
  const openerDoc = window.document;
  const nodeMap = new WeakMap<Node, Node>();

  // Initial copy
  const stylesheets = Array.from(openerDoc.querySelectorAll('link[rel="stylesheet"], style'));
  for (const sheet of stylesheets) {
    const clone = sheet.cloneNode(true);
    nodeMap.set(sheet, clone);
    pipDoc.head.appendChild(clone);
  }

  syncAttrs(openerDoc.documentElement, pipDoc.documentElement);
  syncAttrs(openerDoc.body, pipDoc.body);

  const headObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node.nodeName === 'STYLE' || (node.nodeName === 'LINK' && (node as HTMLLinkElement).rel === 'stylesheet')) {
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
      } else if (mutation.type === 'characterData') {
        // Find the style tag parent
        let current: Node | null = mutation.target;
        while (current && current.nodeName !== 'STYLE') {
          current = current.parentNode;
        }
        if (current) {
          const clone = nodeMap.get(current);
          if (clone) {
            clone.textContent = current.textContent;
          }
        }
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
    headObserver.disconnect();
    attrObserver.disconnect();
  };
};
