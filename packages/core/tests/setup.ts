import { beforeEach, afterEach } from 'vitest';
import { mockDocumentPictureInPicture, clearMockDocumentPictureInPicture } from './helpers/mockDocumentPictureInPicture';
import { clearRegistry } from '../src/registry';

beforeEach(() => {
  mockDocumentPictureInPicture();
});

afterEach(() => {
  clearMockDocumentPictureInPicture();
  clearRegistry();
});
