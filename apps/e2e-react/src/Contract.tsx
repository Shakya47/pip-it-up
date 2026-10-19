/**
 * The e2e DOM contract (see @pip-it-up/e2e-contract) implemented with <PipWrapper>.
 *
 * The toggle button sits OUTSIDE the wrapper, like vanilla's, and drives the instance through the
 * core registry (`getPip(id)`), which <PipWrapper id> publishes to. <PipTrigger> has its own specs
 * (tests/react), so contract results don't depend on it.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { getPip, type FallbackMode, type PipInstance } from '@pip-it-up/core';
import { PipWrapper, useAutoPip, usePipContext, useVideoPip } from '@pip-it-up/react';
import { ADDED_CSS, LOG, NAMES, rejectionLog, type ContractHook, type Route } from '@pip-it-up/e2e-contract';
import { LogProvider, StreamVideo, useLog } from './shared';

/**
 * The instance <PipWrapper id> registered, or throw: a silent `getPip(id)?.toggle()` no-op would
 * hide a broken registration. Called through `rejectionLog().run`, so it logs `reject:MissingInstance`.
 */
function requirePip(id: string): PipInstance {
  const pip = getPip(id);
  if (pip) return pip;
  const err = new Error(`e2e-react: no instance registered under "${id}"`);
  err.name = 'MissingInstance';
  throw err;
}

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <p>
      <span>{NAMES.count(count)}</span>{' '}
      <button type="button" onClick={() => setCount((n) => n + 1)}>
        {NAMES.increment}
      </button>
    </p>
  );
}

function CloseInside() {
  const { instance } = usePipContext();
  return (
    <button type="button" onClick={() => instance.close()}>
      {NAMES.closeInside}
    </button>
  );
}

function InsidePip() {
  const { isInsidePip } = usePipContext();
  return <p>{NAMES.insidePip(isInsidePip)}</p>;
}

function sizeStyle(route: Route): CSSProperties {
  const s: CSSProperties = {
    display: 'block',
    boxSizing: 'border-box',
    padding: 8,
    background: 'rgb(240, 240, 250)',
  };
  if (route.harness.contentWidth) s.width = route.harness.contentWidth;
  if (route.harness.contentHeight)
    Object.assign(s, { height: route.harness.contentHeight, overflow: 'hidden' });
  return s;
}

/** A contenteditable, like the playground's rich-text editor (caret and undo inside PiP). */
function RichNotes() {
  return (
    <div role="textbox" aria-label={NAMES.richNotes} aria-multiline="true" contentEditable suppressContentEditableWarning>
      {NAMES.richNotesText}
    </div>
  );
}

/** A canvas you draw on with the pointer, like the playground's scribble demo. */
function SketchCanvas() {
  const last = useRef<{ x: number; y: number } | null>(null);
  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  return (
    <canvas
      aria-label={NAMES.sketch}
      width={300}
      height={150}
      style={{ border: '1px solid #999', touchAction: 'none', display: 'block' }}
      onPointerDown={(e) => (last.current = at(e))}
      onPointerMove={(e) => {
        if (!last.current) return;
        const p = at(e);
        const ctx = e.currentTarget.getContext('2d')!;
        ctx.strokeStyle = 'rgb(20, 20, 200)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(last.current.x, last.current.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        last.current = p;
      }}
      onPointerUp={() => (last.current = null)}
    />
  );
}

/** `video-api`: useVideoPip (and useAutoPip with its `enter`) on a video outside the content. */
function VideoApi() {
  const write = useLog();
  const ref = useRef<HTMLVideoElement>(null);
  const { isActive, enter, leave } = useVideoPip(ref);
  const [auto, setAuto] = useState(false);
  useAutoPip(enter, {
    enabled: auto,
    when: () => !document.pictureInPictureElement,
    onResult: (res) => write(res.ok ? LOG.autoOk(res.grantedBy) : LOG.autoBlocked(res.error.name, res.hadActivation)),
  });
  return (
    <>
      <StreamVideo label={NAMES.standaloneVideo} autoPlay videoRef={ref} />
      <button type="button" onClick={() => void enter().catch((err: Error) => write(LOG.videoError(err.name)))}>
        {NAMES.enterVideo}
      </button>
      <button type="button" onClick={() => void leave().catch((err: Error) => write(LOG.videoError(err.name)))}>
        {NAMES.exitVideo}
      </button>
      <p>{NAMES.videoStatus(isActive)}</p>
      <label>
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> {NAMES.autoVideo}
      </label>
    </>
  );
}

function Instance({
  route,
  suffix,
  external,
  outside,
}: {
  route: Route;
  suffix: '' | ' B';
  external?: number;
  /** Page controls rendered between the status and the content (contract DOM order). */
  outside?: ReactNode;
}) {
  const write = useLog();
  const entry = (e: string) => write(suffix ? LOG.b(e) : e);
  // `write` is stable and `suffix` fixed per instance, so one tracker per mount is enough.
  const [failures] = useState(() => rejectionLog(entry));
  const name = (n: string) => (suffix ? NAMES.b(n) : n);
  const id = suffix ? 'contract-b' : 'contract-a';
  const [open, setOpen] = useState(false);

  // `mode` is dropped: <PipWrapper> always portals and takes no `mode` (see the contract header).
  const { fallback: fallbackChoice, mode: _mode, ...options } = route.options;
  const fallback: FallbackMode | undefined =
    fallbackChoice === 'custom'
      ? () => {
          entry(LOG.fallbackCustom);
          return () => entry(LOG.fallbackCleanup);
        }
      : fallbackChoice;
  const beforeOpen = route.harness.beforeOpen;
  useEffect(() => {
    if (suffix) return;
    // onError logs `error:<name>`; a rejection that bypassed onError logs `reject:<name>`.
    const hook: ContractHook = { toggle: () => failures.run(() => requirePip(id).toggle()) };
    (window as unknown as { __contract: ContractHook }).__contract = hook;
    liveRun = failures.run;
  }, [id, suffix, failures]);

  return (
    <>
      <button type="button" onClick={() => void failures.run(() => requirePip(id).toggle())}>
        {name(open ? NAMES.close : NAMES.open)}
      </button>
      <p role="status">{open ? NAMES.status.open : NAMES.status.closed}</p>
      {outside}
      {route.scenario === 'auto-pip' && !suffix && <AutoPipBox id={id} />}
      <PipWrapper
        {...options}
        id={id}
        fallback={fallback}
        onOpenChange={setOpen}
        onOpen={() => entry(LOG.open)}
        onPipWindowReady={() => entry(LOG.ready)}
        onClose={() => entry(LOG.close)}
        onError={failures.onError}
        onBeforeOpen={
          beforeOpen
            ? () => {
                entry(LOG.beforeOpen);
                return beforeOpen === 'allow';
              }
            : undefined
        }
      >
        <section aria-label={name(NAMES.content)} style={sizeStyle(route)}>
          <h2 className="contract-heading">{NAMES.heading}</h2>
          <Counter />
          <label>
            {NAMES.notes} <input type="text" aria-label={NAMES.notes} />
          </label>
          <div role="region" aria-label={NAMES.scrollBox} tabIndex={0} className="scroll-box">
            <div className="scroll-inner">Scroll me</div>
          </div>
          <CloseInside />
          <InsidePip />
          {(route.scenario === 'video' || route.scenario === 'multi-video') && (
            <StreamVideo label={NAMES.video} />
          )}
          {route.scenario === 'multi-video' && <StreamVideo label={NAMES.secondVideo} />}
          <RichNotes />
          {/* Lifted state rendered inside the portal: the shared-tree demo. */}
          {external !== undefined && <p>{NAMES.externalCount(external)}</p>}
          {route.scenario === 'canvas' && <SketchCanvas />}
        </section>
      </PipWrapper>
    </>
  );
}

function AutoPipBox({ id }: { id: string }) {
  const write = useLog();
  const [enabled, setEnabled] = useState(false);
  useAutoPip(() => requirePip(id).open(), {
    enabled,
    when: () => !getPip(id)?.isOpen(),
    onResult: (res) =>
      write(
        res.ok ? LOG.autoOk(res.grantedBy) : LOG.autoBlocked(res.error.name, res.hadActivation)
      ),
  });
  return (
    <label>
      <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />{' '}
      {NAMES.autoPip}
    </label>
  );
}

function StyleButtons() {
  return (
    <>
      <button
        type="button"
        onClick={() => {
          const dark = document.documentElement.classList.toggle('theme-dark');
          document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
        }}
      >
        {NAMES.themeToggle}
      </button>
      <button
        type="button"
        onClick={() => {
          const s = document.createElement('style');
          s.id = 'contract-added';
          s.textContent = ADDED_CSS;
          document.head.append(s);
        }}
      >
        {NAMES.addStyle}
      </button>
    </>
  );
}

/**
 * Opener-side listeners that record what the bridges delivered (same as vanilla's). Installed
 * once per page load at module scope: StrictMode double-invokes initialisers and effects, which
 * would log twice. They write through the live log writer, published by <Page> in an effect.
 */
let liveWrite: (e: string) => void = () => {};
/** The first instance's `rejectionLog().run`, published by <Instance> in an effect (Alt+P uses it). */
let liveRun: (fn: () => Promise<unknown> | undefined) => Promise<void> = rejectionLog((e) => liveWrite(e)).run;
// Guarded for the Next.js target, which imports this module (client-only, but bundled for SSR too).
if (typeof window !== 'undefined') installBridgeLog();
function installBridgeLog() {
  for (const type of ['keydown', 'keyup'] as const) {
    window.addEventListener(type, (e) => {
      if (e.isTrusted) return; // forwarded clones are untrusted by construction
      liveWrite(LOG.key(type, e.key));
      // The opener claims Ctrl/Cmd+K (like the playground's Cmd+S handler): cancelling the
      // forwarded clone must cancel the original key in the PiP window too.
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') e.preventDefault();
    });
  }
  // core README "Practical use cases": a global shortcut through the registry.
  window.addEventListener('keydown', (e) => {
    if (e.altKey && e.code === 'KeyP') void liveRun(() => getPip(NAMES.registryId)?.toggle());
  });
  // document.body, bubble phase: where the core pointer bridge dispatches (same as vanilla's).
  for (const type of ['pointerdown', 'pointerup', 'click']) {
    document.body.addEventListener(type, (e) => {
      if ((e as Event & { pipItUpBridged?: boolean }).pipItUpBridged) liveWrite(LOG.pointer(type));
    });
  }
}

function Page({ route }: { route: Route }) {
  const write = useLog();
  const [external, setExternal] = useState(0);
  useEffect(() => {
    liveWrite = write;
  }, [write]);
  // Contract DOM order: toggle, status, outside controls, scenario extras, content (see e2e-contract).
  const outside = (
    <>
      <button type="button" onClick={() => setExternal((n) => n + 1)}>
        {NAMES.incrementOutside}
      </button>
      {/* core README "Practical use cases": navigation cleanup through the registry. */}
      <button type="button" onClick={() => getPip(NAMES.registryId)?.close()}>
        {NAMES.closeViaRegistry}
      </button>
      {route.scenario === 'styles' && <StyleButtons />}
      {route.scenario === 'video-api' && <VideoApi />}
    </>
  );
  return (
    <>
      <Instance route={route} suffix="" external={external} outside={outside} />
      {route.scenario === 'two-instances' && <Instance route={route} suffix=" B" />}
      <p>{NAMES.below}</p>
    </>
  );
}

export function ContractPage({ route }: { route: Route }) {
  return (
    <LogProvider>
      <Page route={route} />
    </LogProvider>
  );
}
