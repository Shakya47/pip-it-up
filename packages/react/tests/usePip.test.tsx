import React from 'react';
import { renderHook, act, render, screen } from '@testing-library/react';
import { createPip, getPip, registerPip } from '@pip-it-up/core';
import { describe, it, expect, vi } from 'vitest';
import { usePip } from '../src/usePip';

describe('usePip', () => {
  it('returns manual control flow API', async () => {
    const { result } = renderHook(() => usePip());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.isSupported).toBe(true);

    await act(async () => {
      await result.current.open();
    });

    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.close();
    });

    expect(result.current.isOpen).toBe(false);

    await act(async () => {
      await result.current.toggle();
    });
    expect(result.current.isOpen).toBe(true);

    await act(async () => {
      await result.current.toggle();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('is SSR safe', () => {
    // We cannot delete window entirely in a jsdom environment because React render Hook requires it.
    // However, if we just ensure documentPictureInPicture is missing, we test the isSupported fallback
    const original = (global.window as any).documentPictureInPicture;
    delete (global.window as any).documentPictureInPicture;

    const { result } = renderHook(() => usePip());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.isSupported).toBe(false);

    (global.window as any).documentPictureInPicture = original;
  });

  it('survives Strict Mode: the first open() reaches requestWindow with no ERR_DESTROYED (MAINTENANCE §2)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const requestWindow = (window as any).documentPictureInPicture.requestWindow as ReturnType<typeof vi.fn>;
    requestWindow.mockClear?.();
    const { result } = renderHook(() => usePip(), { wrapper: React.StrictMode });

    await act(async () => {
      await result.current.open().catch(() => {});
    });

    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('ERR_DESTROYED'));
    expect(requestWindow).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('still destroys the instance on a real unmount (one macrotask later)', async () => {
    const { result, unmount } = renderHook(() => usePip());
    const openBefore = result.current.open;
    unmount();
    await new Promise((r) => setTimeout(r, 0));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await openBefore().catch(() => {});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ERR_DESTROYED'));
    warn.mockRestore();
  });

  it('bridges React events once the content is in PiP: onClick runs for a click inside the window', async () => {
    const onClick = vi.fn();
    function Moved() {
      const { contentRef, open } = usePip({ id: 'bridge-wiring' });
      return (
        <div>
          <div ref={contentRef}><button onClick={onClick}>inside</button></div>
          <button onClick={() => void open()}>open</button>
        </div>
      );
    }
    render(<Moved />);
    await act(async () => {
      await getPip('bridge-wiring')!.open();
    });
    const pipWindow = getPip('bridge-wiring')!.getPipWindow()!;
    const inside = pipWindow.document.querySelector('button')!;
    expect(inside.textContent).toBe('inside');
    inside.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('unregisters its id only if the registry still holds its own instance (compare-and-delete)', async () => {
    const { result, unmount } = renderHook(() => usePip({ id: 'shared-id' }));
    const mine = getPip('shared-id');
    expect(mine).not.toBeNull();
    const newer = createPip();
    registerPip('shared-id', newer);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    unmount();
    await new Promise((r) => setTimeout(r, 0));
    expect(getPip('shared-id')).toBe(newer);
    warn.mockRestore();
    void result;
    newer.destroy();
  });

  it('registers contentEl when the owner renders the content element in a later render', async () => {
    // A deps list of `contentRef.current` is read during render, before the ref attaches, so it
    // still saw null here and skipped the sync.
    function Owner() {
      const { contentRef } = usePip({ id: 'late-ref' });
      const [show, setShow] = React.useState(false);
      React.useEffect(() => setShow(true), []);
      return show ? <div ref={contentRef} data-testid="late-content">c</div> : null;
    }
    render(<Owner />);
    const el = await screen.findByTestId('late-content');
    expect(getPip('late-ref')!.getDefaultElements().contentEl).toBe(el);
  });

  it('without Document PiP, a <video> added later inside the content refreshes isSupported (B2)', async () => {
    // The <video> appears in a commit of a child alone: the hook's component doesn't re-render.
    function Child() {
      const [video, setVideo] = React.useState(false);
      React.useEffect(() => {
        const t = setTimeout(() => setVideo(true), 0);
        return () => clearTimeout(t);
      }, []);
      return <div>{video ? <video /> : null}</div>;
    }
    function Owner() {
      const { contentRef, isSupported } = usePip<HTMLDivElement>();
      return (
        <div>
          <p data-testid="supported">{String(isSupported)}</p>
          <div ref={contentRef}><Child /></div>
        </div>
      );
    }
    const w = window as unknown as Record<string, unknown>;
    const savedPip = w.documentPictureInPicture;
    delete w.documentPictureInPicture;
    Object.defineProperty(document, 'pictureInPictureEnabled', { value: true, configurable: true });
    try {
      render(<Owner />);
      expect(screen.getByTestId('supported').textContent).toBe('false');
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
      await act(async () => {});
      expect(screen.getByTestId('supported').textContent).toBe('true');
    } finally {
      w.documentPictureInPicture = savedPip;
      delete (document as unknown as Record<string, unknown>).pictureInPictureEnabled;
    }
  });
});
