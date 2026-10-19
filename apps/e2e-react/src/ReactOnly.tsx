/**
 * React-only pages (tests/react): controlled mode, <PipTrigger> variants, and the clone-mode guard.
 */
import { useState, type ComponentProps } from 'react';
import { PipTrigger, PipWrapper, usePip } from '@pip-it-up/react';
import { LogProvider, useLog } from './shared';

export const REACT_ONLY_ROUTES = ['react-controlled', 'react-trigger', 'react-clone-mode', 'react-usepip'] as const;
type Name = (typeof REACT_ONLY_ROUTES)[number];

/** `open` is driven by a checkbox; closing the PiP window from the OS must untick it. */
function Controlled() {
  const write = useLog();
  const [open, setOpen] = useState(false);
  return (
    <>
      <label>
        <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} /> Open (controlled)
      </label>
      <PipWrapper
        open={open}
        onOpenChange={(next) => {
          write(`open-change:${next}`);
          setOpen(next);
        }}
      >
        <section aria-label="Controlled content">
          <h2>Controlled content</h2>
        </section>
      </PipWrapper>
    </>
  );
}

/**
 * - "Trigger content": a wrapper with a colocated default trigger ("↗ Pop out"; hidden in PiP).
 * - A decoupled trigger (`pipId`) with custom labels, and an `asChild` link, both outside it.
 * - A trigger for an id nobody registered: rendered disabled.
 * - A trigger with `renderUnsupported`, for browsers without Document PiP.
 */
function Triggers() {
  return (
    <>
      <PipTrigger pipId="trig-a" openLabel="Open remotely" closeLabel="Close remotely" />
      <PipTrigger pipId="trig-a" asChild>
        <a href="#/react-trigger">Custom link trigger</a>
      </PipTrigger>
      <PipTrigger pipId="nobody-registered" openLabel="Orphan trigger" />
      <PipWrapper id="trig-a">
        <section aria-label="Trigger content">
          <h2>Trigger content</h2>
          <PipTrigger />
        </section>
      </PipWrapper>
      <PipWrapper id="trig-unsupported">
        <section aria-label="Unsupported content">
          <h2>Unsupported content</h2>
          <PipTrigger openLabel="Open unsupported demo" renderUnsupported={<span>PiP unavailable</span>} />
        </section>
      </PipWrapper>
    </>
  );
}

/** MAINTENANCE_GUIDE §3: `mode="clone"` on <PipWrapper> must warn and fall back to portal mode. */
function CloneMode() {
  // `mode` is not in PipWrapperProps; a JS caller can still pass it.
  const props = { mode: 'clone' } as unknown as ComponentProps<typeof PipWrapper>;
  return (
    <PipWrapper {...props}>
      <section aria-label="Clone mode content">
        <h2>Clone mode content</h2>
        <PipTrigger />
      </section>
    </PipWrapper>
  );
}

/**
 * `usePip()`: the lower-level hook (refs + open/close), core's move mode under React. The node is
 * moved, not portalled; usePip bridges events from PiP to React (reactEventBridge.ts), so its
 * handlers keep working there. Updates driven from the page ("+1 from page") reach it too.
 */
function UsePipDemo() {
  const write = useLog();
  const [count, setCount] = useState(0);
  const [text, setText] = useState('');
  const { contentRef, originRef, open, close, isOpen } = usePip<HTMLDivElement>({
    width: 360,
    height: 240,
    onOpen: () => write('open'),
    onClose: () => write('close'),
    onError: (err) => write(`error:${err.name}`),
  });
  return (
    <>
      <button type="button" onClick={() => void open().catch(() => {})}>
        Open with usePip
      </button>
      <button type="button" onClick={close}>
        Close with usePip
      </button>
      <button type="button" onClick={() => setCount((n) => n + 1)}>
        +1 from page
      </button>
      <p role="status">{isOpen ? 'usePip: open' : 'usePip: closed'}</p>
      <div ref={originRef}>
        <div ref={contentRef} role="region" aria-label="usePip content">
          <h2 onAnimationEnd={() => write('animation-end')}>usePip content</h2>
          <button type="button" onClick={() => setCount((n) => n + 1)}>
            Count: {count}
          </button>
          <label>
            Controlled <input value={text} onChange={(e) => setText(e.target.value.toUpperCase())} />
          </label>
          <a
            href="#usepip-navigated"
            onClick={(e) => {
              e.preventDefault();
              write('link-click');
            }}
          >
            Prevented link
          </a>
        </div>
      </div>
    </>
  );
}

export function ReactOnlyPage({ name }: { name: Name }) {
  return (
    <LogProvider>
      {name === 'react-controlled' && <Controlled />}
      {name === 'react-trigger' && <Triggers />}
      {name === 'react-clone-mode' && <CloneMode />}
      {name === 'react-usepip' && <UsePipDemo />}
    </LogProvider>
  );
}
