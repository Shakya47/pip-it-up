import { describe, it, expect, vi, afterEach } from 'vitest';
import { PipError, warnPip, isDevEnv } from '../src/errors';

describe('errors', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('is an instance of PipError and Error', () => {
    const e = new PipError('ERR_NO_HOST', 'nope');
    expect(e instanceof PipError).toBe(true);
    expect(e instanceof Error).toBe(true);
  });

  it('sets name to PipError', () => {
    const e = new PipError('ERR_NO_HOST', 'nope');
    expect(e.name).toBe('PipError');
  });

  it('exposes the unprefixed code', () => {
    const e = new PipError('ERR_NO_HOST', 'nope');
    expect(e.code).toBe('ERR_NO_HOST');
  });

  it('formats the message with one prefix', () => {
    const e = new PipError('ERR_NO_HOST', 'nope');
    expect(e.message).toBe('[pip-it-up] ERR_NO_HOST: nope');
  });

  it('warnPip emits the same prefix', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnPip('ERR_DUPLICATE_ANCHOR', 'two');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('[pip-it-up] ERR_DUPLICATE_ANCHOR: two');
  });

  it('isDevEnv is false in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(isDevEnv()).toBe(false);
  });

  it('isDevEnv is true in test', () => {
    vi.stubEnv('NODE_ENV', 'test');
    expect(isDevEnv()).toBe(true);
  });

  it('isDevEnv survives a missing process', () => {
    vi.stubGlobal('process', undefined);
    expect(() => isDevEnv()).not.toThrow();
    expect(isDevEnv()).toBe(false);
  });
});
