import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  PipTeleportContext,
  PipHostContext,
  useTeleport,
  useHost,
  type PipTeleportApi,
  type PipHostApi,
} from '../src/PipTeleportContext';
import { PipError } from '../src/errors';

describe('PipTeleportContext and PipHostContext', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('useTeleport throws ERR_NO_PROVIDER outside a provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Probe() {
      useTeleport();
      return null;
    }

    let thrown: unknown;
    try {
      render(<Probe />);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(PipError);
    expect((thrown as PipError).code).toBe('ERR_NO_PROVIDER');
    consoleSpy.mockRestore();
  });

  it('useTeleport throws in production too', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Probe() {
      useTeleport();
      return null;
    }

    let thrown: unknown;
    try {
      render(<Probe />);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(PipError);
    expect((thrown as PipError).code).toBe('ERR_NO_PROVIDER');
    consoleSpy.mockRestore();
  });

  it('useTeleport returns the provided api by reference', () => {
    const api: PipTeleportApi = {
      claimAnchor: vi.fn(),
      releaseAnchor: vi.fn(),
      reportDockedSize: vi.fn(),
      getLastDockedSize: vi.fn(),
      getPlacement: vi.fn(),
      getInstance: vi.fn(),
      hasId: vi.fn(),
      subscribePlacement: vi.fn(),
    };

    let returned: PipTeleportApi | undefined;
    function Probe() {
      returned = useTeleport();
      return null;
    }

    render(
      <PipTeleportContext.Provider value={api}>
        <Probe />
      </PipTeleportContext.Provider>
    );

    expect(returned).toBe(api);
  });

  it('useHost throws ERR_NO_HOST outside a host', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Probe() {
      useHost();
      return null;
    }

    let thrown: unknown;
    try {
      render(<Probe />);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(PipError);
    expect((thrown as PipError).code).toBe('ERR_NO_HOST');
    consoleSpy.mockRestore();
  });

  it('useHost throws in production too', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Probe() {
      useHost();
      return null;
    }

    let thrown: unknown;
    try {
      render(<Probe />);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(PipError);
    expect((thrown as PipError).code).toBe('ERR_NO_HOST');
    consoleSpy.mockRestore();
  });

  it('useHost returns the provided host by reference', () => {
    const host: PipHostApi = {
      id: 'test-id',
      subscribe: vi.fn(),
      getSnapshot: vi.fn(),
      getServerSnapshot: vi.fn(),
    };

    let returned: PipHostApi | undefined;
    function Probe() {
      returned = useHost();
      return null;
    }

    render(
      <PipHostContext.Provider value={host}>
        <Probe />
      </PipHostContext.Provider>
    );

    expect(returned).toBe(host);
  });

  it('error message names the mount location', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Probe() {
      useTeleport();
      return null;
    }

    let thrown: unknown;
    try {
      render(<Probe />);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(PipError);
    const message = (thrown as PipError).message;
    expect(message).toContain('<PipProvider>');
    expect(message).toContain('layout.tsx');
    consoleSpy.mockRestore();
  });

  it('contexts expose displayName', () => {
    expect(PipTeleportContext.displayName).toBe('PipTeleportContext');
    expect(PipHostContext.displayName).toBe('PipHostContext');
  });
});
