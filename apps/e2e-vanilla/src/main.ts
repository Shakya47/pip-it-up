/**
 * The e2e DOM contract (see @pip-it-up/e2e-contract) implemented with `createPip()` directly.
 * This is the reference target: browser differences live in core, so every browser runs it.
 */
import {
  createPip,
  createAutoPip,
  enterVideoPip,
  exitVideoPip,
  getPip,
  isInVideoPip,
  registerPip,
  type FallbackMode,
  type PipInstance,
  type PipOptions,
} from '@pip-it-up/core';
import {
  ADDED_CSS,
  LOG,
  NAMES,
  applyHarness,
  parseRoute,
  rejectionLog,
  type ContractHook,
  type Route,
} from '@pip-it-up/e2e-contract';

type El = HTMLElement;
const h = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, string> = {}, ...children: (Node | string)[]) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v);
  }
  el.append(...children);
  return el;
};

const route = parseRoute(location.hash);
applyHarness(route);
const app = document.getElementById('app')!;
const log = h('ul', { role: 'log', 'aria-label': NAMES.log });

const write = (entry: string) => log.append(h('li', { text: entry }));

/** A canvas.captureStream() video: no codec needed, plays in every engine. */
function streamVideo(label: string) {
  const canvas = h('canvas', { width: '160', height: '90' }) as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  let frame = 0;
  setInterval(() => {
    ctx.fillStyle = `hsl(${(frame++ * 7) % 360}, 80%, 50%)`;
    ctx.fillRect(0, 0, 160, 90);
  }, 50);
  const video = h('video', { 'aria-label': label, width: '160', height: '90', playsinline: '' }) as HTMLVideoElement;
  video.muted = true;
  video.srcObject = canvas.captureStream(30);
  return video;
}

/** One contract instance: toggle, status, content region. `suffix` is '' or ' B'. */
function mount(r: Route, suffix: '' | ' B') {
  const name = (n: string) => (suffix ? NAMES.b(n) : n);
  const entry = (e: string) => write(suffix ? LOG.b(e) : e);

  const toggle = h('button', { type: 'button', text: name(NAMES.open) });
  const status = h('p', { role: 'status', text: NAMES.status.closed });

  let count = 0;
  const countText = h('span', { text: NAMES.count(0) });
  const increment = h('button', { type: 'button', text: NAMES.increment });
  increment.addEventListener('click', () => (countText.textContent = NAMES.count(++count)));

  const content = h(
    'section',
    { 'aria-label': name(NAMES.content), style: sizeStyle(r) },
    h('h2', { class: 'contract-heading', text: NAMES.heading }),
    h('p', {}, countText, ' ', increment),
    h('label', {}, `${NAMES.notes} `, h('input', { type: 'text', 'aria-label': NAMES.notes })),
    h('div', { role: 'region', 'aria-label': NAMES.scrollBox, tabindex: '0', class: 'scroll-box' }, h('div', { class: 'scroll-inner', text: 'Scroll me' })),
  );
  const closeInside = h('button', { type: 'button', text: NAMES.closeInside });
  content.append(closeInside);
  if (r.scenario === 'video' || r.scenario === 'multi-video') content.append(streamVideo(NAMES.video));
  if (r.scenario === 'multi-video') content.append(streamVideo(NAMES.secondVideo));
  // A contenteditable, like the playground's rich-text editor (caret and undo inside PiP).
  content.append(
    h('div', { role: 'textbox', 'aria-label': NAMES.richNotes, 'aria-multiline': 'true', contenteditable: 'true', text: NAMES.richNotesText }),
  );
  // Live updates from outside the content (the shared-tree demo): "+1 outside" sets this text.
  const external = h('p', { text: NAMES.externalCount(0) });
  if (!suffix) content.append(external);
  if (r.scenario === 'canvas') content.append(sketchCanvas());

  const origin = h('div', { 'data-origin': suffix.trim() || 'A' }, content);

  const failures = rejectionLog(entry);
  const options: PipOptions = {
    ...r.options,
    fallback: fallbackFor(r, entry),
    onOpen: () => {
      entry(LOG.open);
      status.textContent = NAMES.status.open;
      toggle.textContent = name(NAMES.close);
    },
    onPipWindowReady: () => entry(LOG.ready),
    onClose: () => {
      entry(LOG.close);
      status.textContent = NAMES.status.closed;
      toggle.textContent = name(NAMES.open);
    },
    onError: failures.onError,
  };
  if (r.harness.beforeOpen) {
    const allow = r.harness.beforeOpen === 'allow';
    options.onBeforeOpen = () => {
      entry(LOG.beforeOpen);
      return allow;
    };
  }
  const instance = createPip(options);
  instance.setDefaultElements({ contentEl: content, originEl: origin });
  // onError logs `error:<name>`; a rejection that bypassed onError logs `reject:<name>`.
  toggle.addEventListener('click', () => void failures.run(() => instance.toggle()));
  closeInside.addEventListener('click', () => instance.close());
  return { toggle, status, origin, instance, external, run: failures.run };
}

/** A canvas you draw on with the pointer, like the playground's scribble demo. */
function sketchCanvas() {
  const canvas = h('canvas', { 'aria-label': NAMES.sketch, width: '300', height: '150', style: 'border: 1px solid #999; touch-action: none; display: block' }) as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  let last: { x: number; y: number } | null = null;
  const at = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * canvas.width, y: ((e.clientY - r.top) / r.height) * canvas.height };
  };
  canvas.addEventListener('pointerdown', (e) => (last = at(e)));
  canvas.addEventListener('pointermove', (e) => {
    if (!last) return;
    const p = at(e);
    ctx.strokeStyle = 'rgb(20, 20, 200)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last = p;
  });
  canvas.addEventListener('pointerup', () => (last = null));
  return canvas;
}

function sizeStyle(r: Route) {
  const parts = ['display: block', 'box-sizing: border-box', 'padding: 8px', 'background: rgb(240, 240, 250)'];
  if (r.harness.contentWidth) parts.push(`width: ${r.harness.contentWidth}px`);
  if (r.harness.contentHeight) parts.push(`height: ${r.harness.contentHeight}px`, 'overflow: hidden');
  return parts.join('; ');
}

function fallbackFor(r: Route, entry: (e: string) => void): FallbackMode | undefined {
  if (r.options.fallback !== 'custom') return r.options.fallback;
  return () => {
    entry(LOG.fallbackCustom);
    return () => entry(LOG.fallbackCleanup);
  };
}

/** Opener-side listeners that record what the bridges delivered. */
function watchBridges() {
  for (const type of ['keydown', 'keyup'] as const) {
    window.addEventListener(type, (e) => {
      if (e.isTrusted) return; // forwarded clones are untrusted by construction
      write(LOG.key(type, e.key));
      // The opener claims Ctrl/Cmd+K (like the playground's Cmd+S handler): cancelling the
      // forwarded clone must cancel the original key in the PiP window too.
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') e.preventDefault();
    });
  }
  // document.body, bubble phase: where the core pointer bridge dispatches (same on every target).
  for (const type of ['pointerdown', 'pointerup', 'click']) {
    document.body.addEventListener(type, (e) => {
      if ((e as Event & { pipItUpBridged?: boolean }).pipItUpBridged) write(LOG.pointer(type));
    });
  }
}

function scenarioExtras(r: Route, a: PipInstance): El[] {
  const extras: El[] = [];
  if (r.scenario === 'styles') {
    const theme = h('button', { type: 'button', text: NAMES.themeToggle });
    theme.addEventListener('click', () => {
      const dark = document.documentElement.classList.toggle('theme-dark');
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    });
    const add = h('button', { type: 'button', text: NAMES.addStyle });
    add.addEventListener('click', () => {
      const s = h('style', { id: 'contract-added' });
      s.textContent = ADDED_CSS;
      document.head.append(s);
    });
    extras.push(theme, add);
  }
  if (r.scenario === 'video-api') extras.push(...videoApi());
  if (r.scenario === 'auto-pip') {
    const box = h('input', { type: 'checkbox' }) as HTMLInputElement;
    let stop: (() => void) | null = null;
    box.addEventListener('change', () => {
      stop?.();
      stop = box.checked
        ? createAutoPip(() => a.open(), {
            when: () => !a.isOpen(),
            onResult: (res) => write(res.ok ? LOG.autoOk(res.grantedBy) : LOG.autoBlocked(res.error.name, res.hadActivation)),
          })
        : null;
    });
    extras.push(h('label', {}, box, ` ${NAMES.autoPip}`));
  }
  return extras;
}

/** `video-api`: core's direct video PiP functions on a video outside the content. */
function videoApi(): El[] {
  const video = streamVideo(NAMES.standaloneVideo);
  video.autoplay = true;
  const status = h('p', { text: NAMES.videoStatus(false) });
  // This element's own state (like useVideoPip's isActive), not the document-wide isInVideoPip().
  const inPip = () =>
    document.pictureInPictureElement === video ||
    (video as HTMLVideoElement & { webkitPresentationMode?: string }).webkitPresentationMode === 'picture-in-picture';
  const show = (on: boolean) => (status.textContent = NAMES.videoStatus(on));
  video.addEventListener('enterpictureinpicture', () => show(true));
  video.addEventListener('leavepictureinpicture', () => show(false));
  video.addEventListener('webkitpresentationmodechanged', () => show(inPip()));
  video.addEventListener('webkitbeginfullscreen', () => show(true));
  video.addEventListener('webkitendfullscreen', () => show(false));
  const enter = h('button', { type: 'button', text: NAMES.enterVideo });
  enter.addEventListener('click', () => void enterVideoPip(video).catch((err: Error) => write(LOG.videoError(err.name))));
  const exit = h('button', { type: 'button', text: NAMES.exitVideo });
  exit.addEventListener('click', () => void exitVideoPip(video).catch((err: Error) => write(LOG.videoError(err.name))));
  const box = h('input', { type: 'checkbox' }) as HTMLInputElement;
  let stop: (() => void) | null = null;
  box.addEventListener('change', () => {
    stop?.();
    stop = box.checked
      ? createAutoPip(() => enterVideoPip(video), {
          when: () => !isInVideoPip(),
          onResult: (res) => write(res.ok ? LOG.autoOk(res.grantedBy) : LOG.autoBlocked(res.error.name, res.hadActivation)),
        })
      : null;
  });
  return [video, enter, exit, status, h('label', {}, box, ` ${NAMES.autoVideo}`)];
}

/** Outside the content: the shared-state counter, and core registry use cases. */
function outsideControls(external: HTMLElement, run: (fn: () => Promise<unknown> | undefined) => Promise<void>): El[] {
  let n = 0;
  const plus = h('button', { type: 'button', text: NAMES.incrementOutside });
  plus.addEventListener('click', () => (external.textContent = NAMES.externalCount(++n)));
  // core README "Practical use cases": navigation cleanup and a global shortcut, via getPip().
  const closeViaRegistry = h('button', { type: 'button', text: NAMES.closeViaRegistry });
  closeViaRegistry.addEventListener('click', () => getPip(NAMES.registryId)?.close());
  window.addEventListener('keydown', (e) => {
    if (e.altKey && e.code === 'KeyP') void run(() => getPip(NAMES.registryId)?.toggle());
  });
  return [plus, closeViaRegistry];
}

const a = mount(route, '');
registerPip(NAMES.registryId, a.instance);
app.append(a.toggle, a.status, ...outsideControls(a.external, a.run), ...scenarioExtras(route, a.instance), a.origin);
if (route.scenario === 'two-instances') {
  const b = mount(route, ' B');
  app.append(b.toggle, b.status, b.origin);
}
app.append(h('p', { text: NAMES.below }), log);
watchBridges();
const hook: ContractHook = { toggle: () => a.run(() => a.instance.toggle()), destroy: () => a.instance.destroy() };
(window as unknown as { __contract: ContractHook }).__contract = hook;
