/**
 * The e2e DOM contract. Every target (vanilla, react, later vue, svelte, angular) renders the same
 * page for the same route, found by role and accessible name, so one spec runs against all of them.
 *
 * Route: `/#/<scenario>?<query>`. The query maps 1:1 to `PipOptions` (see `parseRoute`), plus a few
 * harness-only keys (`contentWidth`, `contentHeight`, `beforeOpen`). Targets read the route once at
 * load; specs navigate with `page.goto(routeFor(...))`, so every test starts on a fresh page.
 *
 * The page, in this DOM order on every target (playground use cases: shared tree / live updates,
 * global shortcut, navigation cleanup, rich-text editing):
 *
 *   button  "Open PiP" / "Close PiP"          toggles the instance (stays in the opener)
 *   status  "PiP: closed" / "PiP: open"       role="status"
 *   button  "+1 outside"                      outside the content; the content shows "External count: N"
 *   button  "Close via registry"              getPip('contract-a')?.close() (core registry use case)
 *   (scenario extras outside the content, in this order: `styles`, `video-api`, `auto-pip`; below)
 *   region  "PiP content"                     the element that moves into PiP (contentEl)
 *     heading "Contract content"
 *     text    "Count: N" + button "+1"        state that must survive the move
 *     textbox "Notes"
 *     region  "Scroll box"                    a scrollable box (tabindex=0), 2000px of content
 *     button  "Close from inside"             the library's own close path (instance.close())
 *     text    "Inside PiP: yes|no"            React targets only (isInsidePip)
 *     video   "Test video" (+ "Second video") scenarios video / multi-video; canvas.captureStream()
 *     textbox "Rich text"                     a contenteditable with "alpha omega"
 *     text    "External count: N"             first instance only
 *     canvas  "Sketch"                        scenario canvas
 *   (`two-instances`: "Open PiP B", its status, region "PiP content B")
 *   text    "Content below"                   for layout-shift checks
 *   log     "Events"                          one <li> per lifecycle event, in order (see LOG)
 *
 * Also on every page:
 *   Alt+P   anywhere in the opener             getPip('contract-a')?.toggle() (global shortcut use case)
 *   Ctrl/Cmd+K forwarded from PiP              the opener calls preventDefault() (keyboard bridge)
 *   bridge log listeners                       `key:` on window (bubble), `pointer:` on document.body
 *                                              (bubble), where the core bridges dispatch
 *
 * Scenario extras: `styles` adds buttons "Toggle theme" and "Add style" (outside the content);
 * `auto-pip` adds checkbox "Auto-PiP on tab switch"; `two-instances` adds a second set suffixed
 * " B" ("Open PiP B", region "PiP content B"), whose log entries are prefixed "B:"; `canvas` adds a
 * 300×150 canvas "Sketch" inside the content (draw with the pointer); `video-api` adds, OUTSIDE the
 * content, a playing video "Standalone video" with buttons "Enter video PiP" / "Exit video PiP",
 * a status "Video PiP: on|off" (from the element's own events: this video's PiP state, not the
 * document's), and checkbox "Auto video PiP on tab switch" (createAutoPip / useAutoPip with the
 * video's enter function).
 *
 * Route options a target can't honour: React targets ignore `mode` (<PipWrapper> always portals;
 * it accepts no `mode` prop), so `mode=move|clone` routes are vanilla-only.
 *
 * Targets call `applyHarness(route)` once at load (client side) and log through `rejectionLog`.
 */
import type { PipOptions } from '@pip-it-up/core';

export const SCENARIOS = [
  'basic',
  'video',
  'multi-video',
  'styles',
  'auto-pip',
  'two-instances',
  'canvas',
  'video-api',
] as const;
export type Scenario = (typeof SCENARIOS)[number];

export const NAMES = {
  open: 'Open PiP',
  close: 'Close PiP',
  status: { open: 'PiP: open', closed: 'PiP: closed' },
  content: 'PiP content',
  heading: 'Contract content',
  increment: '+1',
  count: (n: number) => `Count: ${n}`,
  notes: 'Notes',
  scrollBox: 'Scroll box',
  closeInside: 'Close from inside',
  insidePip: (yes: boolean) => `Inside PiP: ${yes ? 'yes' : 'no'}`,
  video: 'Test video',
  secondVideo: 'Second video',
  below: 'Content below',
  log: 'Events',
  themeToggle: 'Toggle theme',
  addStyle: 'Add style',
  autoPip: 'Auto-PiP on tab switch',
  incrementOutside: '+1 outside',
  externalCount: (n: number) => `External count: ${n}`,
  closeViaRegistry: 'Close via registry',
  richNotes: 'Rich text',
  richNotesText: 'alpha omega',
  sketch: 'Sketch',
  standaloneVideo: 'Standalone video',
  enterVideo: 'Enter video PiP',
  exitVideo: 'Exit video PiP',
  videoStatus: (on: boolean) => `Video PiP: ${on ? 'on' : 'off'}`,
  autoVideo: 'Auto video PiP on tab switch',
  /** The id the first instance is registered under (core registry). */
  registryId: 'contract-a',
  /** Suffix for the second instance in `two-instances`. */
  b: (name: string) => `${name} B`,
} as const;

/**
 * Log entries (`<li>` text in the "Events" log). Targets write exactly these strings.
 * - `before-open`            onBeforeOpen ran (only when the route sets `beforeOpen`)
 * - `open` / `ready` / `close` onOpen / onPipWindowReady / onClose
 * - `error:<name>`           onError, with the error's `name` (e.g. `error:NotAllowedError`)
 * - `fallback:custom`        the custom fallback function ran; `fallback-cleanup` its cleanup ran
 * - `key:<type>:<key>`       the opener's window got a FORWARDED key event (isTrusted false)
 * - `pointer:<type>`         the opener's body got a bridged pointer/mouse event (pipItUpBridged)
 * - `auto:ok:<grantedBy>` / `auto:blocked:<error name>:<hadActivation>`  createAutoPip onResult
 * - `video-error:<name>`     `video-api`: entering or exiting video PiP rejected
 * - `reject:<name>`          open() / toggle() rejected WITHOUT onError having reported it (a
 *                            failure that bypassed onError; see `rejectionLog`). Never written
 *                            when onError ran for that call, so `error:` logs are unchanged.
 */
export const LOG = {
  beforeOpen: 'before-open',
  open: 'open',
  ready: 'ready',
  close: 'close',
  error: (name: string) => `error:${name}`,
  fallbackCustom: 'fallback:custom',
  fallbackCleanup: 'fallback-cleanup',
  key: (type: string, key: string) => `key:${type}:${key}`,
  pointer: (type: string) => `pointer:${type}`,
  autoOk: (grantedBy: string) => `auto:ok:${grantedBy}`,
  autoBlocked: (name: string, hadActivation: boolean) => `auto:blocked:${name}:${hadActivation}`,
  /** `video-api`: enterVideoPip / exitVideoPip (or useVideoPip's enter / leave) rejected. */
  videoError: (name: string) => `video-error:${name}`,
  /** open() / toggle() rejected and onError did not run for that call. */
  reject: (name: string) => `reject:${name}`,
  /** Prefix for the second instance's entries in `two-instances`. */
  b: (entry: string) => `B:${entry}`,
} as const;

/** The CSS every target ships (a `<style id="contract-styles">` in its `<head>`), so styles tests are comparable. */
export const CONTRACT_CSS = `
.contract-heading { color: rgb(0, 102, 51); font-size: 22px; }
html.theme-dark .contract-heading { color: rgb(200, 30, 30); }
.scroll-box { height: 120px; overflow: auto; border: 1px solid #999; }
.scroll-box > .scroll-inner { height: 2000px; }
`;
/** The rule the "Add style" button appends (as a new `<style id="contract-added">`). */
export const ADDED_CSS = '.contract-heading { text-decoration: underline; }';

export type FallbackChoice = 'none' | 'new-tab' | 'custom';

/** The `PipOptions` a route asks for. `fallback: 'custom'` is turned into a function by the target. */
export type RouteOptions = Omit<PipOptions, 'fallback' | 'onBeforeOpen' | 'onOpen' | 'onPipWindowReady' | 'onClose' | 'onError'> & {
  fallback?: FallbackChoice;
};

export type HarnessOptions = {
  /** Fixed content-region size in px, for auto-size and clamp checks. */
  contentWidth?: number;
  contentHeight?: number;
  /** Install `onBeforeOpen` returning this value (logs `before-open`). */
  beforeOpen?: 'allow' | 'deny';
};

/**
 * `window.__contract`: a hook for tests that must act WITHOUT a click (activation-expiry,
 * destroy). Never use it for ordinary interaction: click the buttons.
 */
export type ContractHook = {
  /** Toggle the first instance, as the "Open PiP" button does, but with no user gesture. */
  toggle: () => Promise<void> | void;
  /** `instance.destroy()`. Vanilla only; bindings manage their own lifetime. */
  destroy?: () => void;
};

export type Route = { scenario: Scenario; options: RouteOptions; harness: HarnessOptions };

const BOOLEAN_KEYS = [
  'fixedSize',
  'forceFallback',
  'disableVideoPip',
  'reserveSpace',
  'centerInPip',
  'forwardKeyboardEvents',
  'forwardPointerEvents',
  'restoreScroll',
  'restoreFocus',
  'disallowReturnToOpener',
  'preferInitialWindowPlacement',
] as const;
const NUMBER_KEYS = ['width', 'height'] as const;

/** Parse `location.hash` (`#/<scenario>?<query>`). Unknown scenarios fall back to `basic`. */
export function parseRoute(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const scenario = (SCENARIOS as readonly string[]).includes(path) ? (path as Scenario) : 'basic';
  const q = new URLSearchParams(query);
  const options: RouteOptions = {};
  const o = options as Record<string, unknown>;
  for (const key of BOOLEAN_KEYS) if (q.has(key)) o[key] = q.get(key) !== 'false';
  for (const key of NUMBER_KEYS) if (q.has(key)) o[key] = Number(q.get(key));
  const mode = q.get('mode');
  if (mode === 'move' || mode === 'clone' || mode === 'portal') options.mode = mode;
  const copyStyles = q.get('copyStyles');
  if (copyStyles === 'once' || copyStyles === 'sync') options.copyStyles = copyStyles;
  const fallback = q.get('fallback');
  if (fallback === 'none' || fallback === 'new-tab' || fallback === 'custom') options.fallback = fallback;
  if (q.has('fallbackUrl')) options.fallbackUrl = q.get('fallbackUrl')!;
  if (q.get('pipBodyStyles') === 'false') options.pipBodyStyles = false;

  const harness: HarnessOptions = {};
  if (q.has('contentWidth')) harness.contentWidth = Number(q.get('contentWidth'));
  if (q.has('contentHeight')) harness.contentHeight = Number(q.get('contentHeight'));
  const beforeOpen = q.get('beforeOpen');
  if (beforeOpen === 'allow' || beforeOpen === 'deny') harness.beforeOpen = beforeOpen;
  return { scenario, options, harness };
}

/** Build a route for `page.goto`: `routeFor('basic', { mode: 'clone' })` → `/#/basic?mode=clone`. */
export function routeFor(scenario: Scenario, params: Record<string, string | number | boolean> = {}): string {
  const q = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  return `/#/${scenario}${q ? `?${q}` : ''}`;
}

/**
 * Apply the harness options that must take effect before the target renders. Every target calls it
 * once at load, client side: the contract stylesheet (skipped when the page already ships
 * `#contract-styles`, e.g. Next's layout). Idempotent; no-op on the server. (A hostile `<base href>`
 * for SEC-201 is inserted by the test after the page has rendered: at load it would also redirect
 * Next's router and chunk requests.)
 */
export function applyHarness(route: Route): void {
  if (typeof document === 'undefined') return;
  if (!document.getElementById('contract-styles')) {
    const style = document.createElement('style');
    style.id = 'contract-styles';
    style.textContent = CONTRACT_CSS;
    document.head.append(style);
  }
}

const errorName = (err: unknown) => (err instanceof Error ? err.name : String(err));

/**
 * One instance's failure logging. `onError` logs `error:<name>`; `run(fn)` calls open() / toggle()
 * (synchronously, so the click's user activation is kept) and, if it throws or rejects WITHOUT
 * onError having run meanwhile, logs `reject:<name>`. `run` never rejects (safe in click handlers).
 * `entry` is the instance's log writer (already `B:`-prefixed for the second instance).
 */
export function rejectionLog(entry: (e: string) => void) {
  let reported = 0;
  return {
    onError: (err: Error) => {
      reported++;
      entry(LOG.error(err.name));
    },
    run: (fn: () => Promise<unknown> | void | undefined): Promise<void> => {
      const seen = reported;
      let p: Promise<unknown> | void | undefined;
      try {
        p = fn();
      } catch (err) {
        p = Promise.reject(err);
      }
      return Promise.resolve(p).then(
        () => {},
        (err: unknown) => {
          if (reported === seen) entry(LOG.reject(errorName(err)));
        },
      );
    },
  };
}
