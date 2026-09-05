import { beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { mockDocumentPictureInPicture, clearMockDocumentPictureInPicture } from '../../core/tests/helpers/mockDocumentPictureInPicture';
import { clearRegistry } from '../../core/src/registry';

import { installMockResizeObserver, type ResizeObserverController } from './helpers/mockResizeObserver';

let roController: ResizeObserverController | null = null;

beforeEach(() => {
  mockDocumentPictureInPicture();
  roController = installMockResizeObserver();
});

afterEach(() => {
  roController?.restore();
  roController = null;
  clearMockDocumentPictureInPicture();
  cleanup();
  clearRegistry();
});
