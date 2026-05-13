import { describe, it, expect } from 'vitest';
import * as exports from '../src/index';

describe('exports', () => {
  it('exports necessary members', () => {
    expect(exports.PipWrapper).toBeDefined();
    expect(exports.PipTrigger).toBeDefined();
    expect(exports.usePip).toBeDefined();
    expect(exports.usePipContext).toBeDefined();
    expect(exports.useIsPipSupported).toBeDefined();
  });
});
