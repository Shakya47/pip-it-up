import { beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { mockDocumentPictureInPicture, clearMockDocumentPictureInPicture } from '../../core/tests/helpers/mockDocumentPictureInPicture';
import { clearRegistry } from '@pip-it-up/core';

beforeEach(() => {
  mockDocumentPictureInPicture();
});

afterEach(() => {
  clearMockDocumentPictureInPicture();
  cleanup();
  clearRegistry();
});
