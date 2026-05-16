import { beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { mockDocumentPictureInPicture, clearMockDocumentPictureInPicture } from '../../core/tests/helpers/mockDocumentPictureInPicture';
import { clearRegistry } from '../../core/src/registry';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() { }
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
