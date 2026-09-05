import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { useAutoPip } from '../src/useAutoPip';

const setVisibility = (value: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', { value, configurable: true });
};

const hideTab = async () => {
  setVisibility('hidden');
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
  });
};

describe('useAutoPip', () => {
  beforeEach(() => {
    setVisibility('visible');
    Object.defineProperty(navigator, 'userActivation', {
      value: { isActive: true, hasBeenActive: true },
      configurable: true,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'userActivation');
    vi.restoreAllMocks();
  });

  it('enters PiP on tab hide with no options at all (always on)', async () => {
    const enter = vi.fn();
    const Harness = () => {
      useAutoPip(enter);
      return null;
    };
    render(<Harness />);

    await hideTab();

    expect(enter).toHaveBeenCalledTimes(1);
  });

  it('does not attach while `enabled` is false, and attaches when it flips true', async () => {
    const enter = vi.fn();
    let setEnabled!: (v: boolean) => void;
    const Harness = () => {
      const [enabled, set] = useState(false);
      setEnabled = set;
      useAutoPip(enter, { enabled });
      return null;
    };
    render(<Harness />);

    await hideTab();
    expect(enter).not.toHaveBeenCalled();

    await act(async () => setEnabled(true));
    await hideTab();
    expect(enter).toHaveBeenCalledTimes(1);
  });

  it('detaches when `enabled` flips back to false', async () => {
    const enter = vi.fn();
    let setEnabled!: (v: boolean) => void;
    const Harness = () => {
      const [enabled, set] = useState(true);
      setEnabled = set;
      useAutoPip(enter, { enabled });
      return null;
    };
    render(<Harness />);

    await act(async () => setEnabled(false));
    await hideTab();

    expect(enter).not.toHaveBeenCalled();
  });

  it('calls the newest `enter` after a re-render without reattaching', async () => {
    const first = vi.fn();
    const second = vi.fn();
    let bump!: (v: number) => void;
    const addSpy = vi.spyOn(document, 'addEventListener');
    const Harness = () => {
      const [n, set] = useState(0);
      bump = set;
      // A fresh inline arrow every render is the normal calling convention.
      useAutoPip(() => (n === 0 ? first() : second()));
      return null;
    };
    render(<Harness />);

    const attachedAfterMount = addSpy.mock.calls.filter(
      ([type]) => type === 'visibilitychange'
    ).length;

    await act(async () => bump(1));

    // Identity churn in the callback must not cost a detach/reattach cycle.
    expect(
      addSpy.mock.calls.filter(([type]) => type === 'visibilitychange').length
    ).toBe(attachedAfterMount);

    await hideTab();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('reads the newest `when` guard', async () => {
    const enter = vi.fn();
    let setBlocked!: (v: boolean) => void;
    const Harness = () => {
      const [blocked, set] = useState(true);
      setBlocked = set;
      useAutoPip(enter, { when: () => !blocked });
      return null;
    };
    render(<Harness />);

    await hideTab();
    expect(enter).not.toHaveBeenCalled();

    await act(async () => setBlocked(false));
    await hideTab();
    expect(enter).toHaveBeenCalledTimes(1);
  });

  it('surfaces a rejection through `onResult`', async () => {
    const error = new DOMException('denied', 'NotAllowedError');
    const onResult = vi.fn();
    const Harness = () => {
      useAutoPip(() => Promise.reject(error), { onResult });
      return null;
    };
    render(<Harness />);

    await hideTab();

    expect(onResult).toHaveBeenCalledWith({ ok: false, error, hadActivation: true });
  });

  it('attempts exactly once per hide under Strict Mode', async () => {
    const enter = vi.fn();
    const Harness = () => {
      useAutoPip(enter);
      return null;
    };
    render(
      <StrictMode>
        <Harness />
      </StrictMode>
    );

    await hideTab();

    // Strict Mode mounts, unmounts and remounts effects. A leaked listener from the discarded
    // mount would make this 2.
    expect(enter).toHaveBeenCalledTimes(1);
  });

  it('removes its listener on unmount', async () => {
    const enter = vi.fn();
    const Harness = () => {
      useAutoPip(enter);
      return null;
    };
    const { unmount } = render(<Harness />);

    unmount();
    await hideTab();

    expect(enter).not.toHaveBeenCalled();
  });
});
