import { beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { mockDocumentPictureInPicture, clearMockDocumentPictureInPicture } from '../../core/tests/helpers/mockDocumentPictureInPicture';
import { clearRegistry } from '../../core/src/registry';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    callback: any;
    constructor(callback: any) {
      this.callback = callback;
    }
    observe(element: any) {
      if (this.callback) {
        const rect = typeof element.getBoundingClientRect === 'function'
          ? element.getBoundingClientRect()
          : { width: 0, height: 0 };
        this.callback([
          {
            target: element,
            contentRect: rect,
            borderBoxSize: [{ inlineSize: rect.width, blockSize: rect.height }]
          }
        ]);
      }
    }
    unobserve() { }
    disconnect() { }
  } as unknown as typeof globalThis.ResizeObserver;
}
beforeEach(() => {
  mockDocumentPictureInPicture();
});

afterEach(() => {
  clearMockDocumentPictureInPicture();
  cleanup();
  clearRegistry();
});
