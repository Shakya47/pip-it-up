# @pip-it-up/react

> **Status: beta.** The API may change before v1.0. See the [roadmap](https://github.com/Shakya47/pip-it-up/blob/main/README.md#roadmap).

React components and hooks that move part of your page into a floating
[Document Picture-in-Picture](https://developer.mozilla.org/en-US/docs/Web/API/Document_Picture-in-Picture_API)
window, with its state intact.

```bash
npm install @pip-it-up/react @pip-it-up/core
```

Which browsers work: [Browser support](https://github.com/Shakya47/pip-it-up/blob/main/README.md#browser-support).

[![Edit in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/p/sandbox/pip-it-up-test-xfng5n)

```tsx
"use client";
import { PipWrapper, PipTrigger } from '@pip-it-up/react';

export function Timer() {
  return (
    <PipWrapper width={320} height={180}>
      <div className="timer">00:42</div>
      <PipTrigger />
    </PipWrapper>
  );
}
```

`<PipTrigger />` renders a `↗ Pop out` button. Click it and the timer moves into a floating window.
Close the window and it comes back.

## `<PipWrapper>`

Wraps the content that moves into the PiP window. It renders through a React portal: the same DOM
node moves, so `<video>` playback, `<canvas>` pixels, WebRTC streams and React state all survive.

### Uncontrolled

```tsx
<PipWrapper>
  <div>Content to move</div>
  <PipTrigger>Toggle</PipTrigger>
</PipWrapper>
```

### Controlled

```tsx
const [isOpen, setIsOpen] = useState(false);

<PipWrapper open={isOpen} onOpenChange={setIsOpen}>
  <div>Content to move</div>
</PipWrapper>;
```

Opening needs a user gesture, so set `open` to `true` from a click handler. Setting it back to
`false` closes the window, or cancels an open that is still pending.

### Props

`<PipWrapper>` accepts every [core option](https://github.com/Shakya47/pip-it-up/blob/main/packages/core/README.md#options)
except `mode`, plus these:

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `open` | `boolean` | — | Controlled open state. |
| `defaultOpen` | `boolean` | `false` | Try to open once on mount (uncontrolled only). Usually blocked without a user gesture; the failure is logged. |
| `onOpenChange` | `(open: boolean) => void` | — | Called when the window opens or closes. |
| `as` | `ElementType` | `'div'` | Element for the content box (the part that moves). |
| `originAs` | `ElementType` | `'div'` | Element for the origin box (stays on the page). A custom component must forward its ref. |
| `placeholder` | `ReactNode` | "📺 In PiP" + Restore button | Shown in the page while the content is in PiP. |
| `placeholderClassName` | `string` | — | Class for the placeholder's wrapper. |
| `ref` | `Ref<HTMLElement>` | — | Receives the origin element. |

Core options that matter most in React:

| Option | Default | What it does here |
| :--- | :--- | :--- |
| `id` | — | Registers the instance so a remote `<PipTrigger pipId>` can control it. |
| `width` / `height` | measured | Window size. Omit to match the content's size on the page. |
| `copyStyles` | `'sync'` | `'sync'` keeps copying CSS changes; `'once'` copies at open only. |
| `reserveSpace` | `true` | Keep the content's size on the page while it is away, so nothing jumps. |
| `centerInPip` | `false` | Center the content in the window. |
| `fallback` / `fallbackUrl` | `'none'` | What to do when no PiP is available (see below). |
| `onError` | — | Called when opening fails. When set, the wrapper and its triggers don't log their own warning. |

`mode` is not a prop: `<PipWrapper>` always uses a portal. Passing `mode` from JavaScript logs a
warning and is ignored. For `move` / `clone` use `createPip()` from `@pip-it-up/core`, or
`usePip()` for `move`.

### When Document PiP is missing

`<PipWrapper>` tries these in order:

1. **Document PiP**, if the browser has it.
2. **Native video PiP**, if the content holds exactly one `<video>` (the root or its only video
   descendant). This makes a video player work on Safari, iOS and older Firefox with no setup. A
   `<video>` rendered later is picked up. `disableVideoPip` turns this off.
3. **`fallback`**: `'none'` does nothing; `'new-tab'` opens `fallbackUrl` (an `http:` / `https:`
   URL) with `noopener,noreferrer`; a function runs your own fallback.

If none apply, the instance is unsupported and `<PipTrigger>` renders `renderUnsupported`.
More: [fallbacks recipe](https://github.com/Shakya47/pip-it-up/blob/main/docs/recipes/fallbacks.md).

## `<PipTrigger>`

A button that toggles the window. Its label switches between `openLabel` and `closeLabel`.

### Nested

Inside a `<PipWrapper>` it controls that wrapper. Use `asChild` to render your own element instead
of a `<button>`:

```tsx
<PipTrigger asChild>
  <button className="my-btn">Open Picture-in-Picture</button>
</PipTrigger>
```

With `asChild`, put `onClick` on `<PipTrigger>`, not on the child: the child's own `onClick`
replaces the toggle.

### Remote

Give the wrapper an `id` and point a trigger anywhere in the app at it:

```tsx
// In a navbar
<PipTrigger pipId="main-player">Open player</PipTrigger>

// Somewhere else
<PipWrapper id="main-player">
  <Player />
</PipWrapper>
```

### Props

All `<button>` attributes are passed through. Your `onClick` runs before the toggle.

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `pipId` | `string` | — | Control the instance registered under this id instead of the nearest wrapper. |
| `asChild` | `boolean` | `false` | Render the single child element instead of a `<button>`. |
| `openLabel` | `string` | `'↗ Pop out'` | Label while closed. |
| `closeLabel` | `string` | `'⊠ Close'` | Label while open. |
| `renderOpen` | `ReactNode` | — | Replaces `openLabel`. |
| `renderClose` | `ReactNode` | — | Replaces `closeLabel`. |
| `renderUnsupported` | `ReactNode` | `null` | Rendered when the instance can't open anything. `null` renders nothing. |
| `hideInPip` | `boolean` | `true` | Hide the trigger while the window is open, when it sits inside a `<PipWrapper>` or a hosted widget. |

`children` win over every label prop.

### What it renders

| Situation | Renders |
| :--- | :--- |
| Server render and first client render | nothing |
| `pipId` with no instance registered yet | a disabled button |
| The instance can't open anything (no Document PiP, no single `<video>`, no usable `fallback`) | `renderUnsupported` |
| Otherwise | the button, with `aria-pressed` |

A click that fails logs a `[PipTrigger]` warning, unless the owner has `onError`. An open cancelled
by `close()` is not logged. A trigger pointing at an instance you created with vanilla
`createPip({ id, onError })` still warns: it can't see that `onError`.

<a id="route-persistent-pip"></a>

## Route-persistent PiP: `<PipProvider>` + `<PipAnchor>`

A `<PipWrapper>` unmounts with its route, which closes its window. To keep a widget alive across
navigation, mount it once at the root with `<PipProvider>` and give it a slot with `<PipAnchor>`.

Only the page that shows the widget changes. Other routes need nothing.

```tsx
// app/layout.tsx (or pages/_app.tsx, or above <Routes> in React Router)
"use client";
import type { ReactNode } from 'react';
import { PipProvider } from '@pip-it-up/react';
import { LiveTracker } from './LiveTracker';

const registry = { tracker: <LiveTracker /> }; // outside render, or useMemo

export default function RootLayout({ children }: { children: ReactNode }) {
  return <PipProvider registry={registry}>{children}</PipProvider>;
}
```

```tsx
// app/dashboard/page.tsx: the one page that shows the widget
"use client";
import { PipAnchor, PipTrigger } from '@pip-it-up/react';

export default function Dashboard() {
  return (
    <>
      <PipTrigger pipId="tracker">Pop out</PipTrigger>
      <PipAnchor id="tracker" placeholder={<div>📺 In PiP</div>} />
    </>
  );
}
```

### The three placements

A hosted widget stays mounted as long as the provider does. It is always in one place:

| Placement | When | Visible |
| :--- | :--- | :--- |
| `anchor` | a `<PipAnchor>` for its id is on the current route | yes, inline |
| `pip` | its PiP window is open | yes, in the window |
| `garage` | no anchor on this route and no window | **no**, but still alive |

In the `garage` the widget keeps its React state, `<video>` playhead, WebGL context and sockets.
Go back to a route with an anchor and it docks again on its own.

### `<PipProvider>` props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `registry` | `Record<string, ReactNode>` | required | The persistent widgets, keyed by id. Each renders once. Keep the object stable (outside render or `useMemo`), or every provider render re-renders all widgets. |
| `options` | `Record<string, PipOptions>` | — | Core options per id, without `id` / `mode`. Read once, when the widget is created. |
| `gcGraceMs` | `number` | `30000` | Delay before destroying a widget whose id left `registry`. |
| `dormantMedia` | `'pause' \| 'keep'` | `'pause'` | Pause `<video>` / `<audio>` while parked, so a route you left makes no sound. |

### `<PipAnchor>` props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | required | A key of the provider's `registry`. |
| `reserve` | `'size' \| 'ratio' \| 'none'` | `'size'` | While the widget is away: keep its size, keep its `aspect-ratio`, or collapse. |
| `axis` | `'block' \| 'inline' \| 'both'` | `'block'` | Which axis to keep. |
| `handoffMs` | `number` | `200` | Size animation when the widget returns. Skipped under `prefers-reduced-motion`. |
| `placeholder` | `ReactNode` | — | Shown while the widget is away, positioned `absolute; inset: 0`, so it adds nothing to the anchor's intrinsic size. |
| `as` | `ElementType` | `'div'` | Element for the anchor box. |
| `className`, `style` | | — | Passed to the box. |

> [!IMPORTANT]
> `<PipAnchor>` needs a real layout box. It sets `position: relative; display: block`. Don't
> override that with `display: contents` or `position: static` (dev builds warn).

A widget hosted by the provider can use `<PipTrigger>` (no `pipId` needed) and `usePipContext()`
inside itself.

### Removing a widget

Routes never destroy a hosted widget. To remove one, delete its id from `registry`:

- The widget unmounts at once and loses its React state, even if you add the id back within
  `gcGraceMs`. (A `registry` object rebuilt with the same key in the same render unmounts nothing.)
- After `gcGraceMs`, if no anchor claims the id and no window is open, the PiP instance and its
  container are destroyed. Adding the id later builds a fresh widget.
- Save any state you need before removing it.

### Several anchors for one id

Several routes may each render an anchor for the same id. Navigating between them moves the
widget with no unmount. If two are mounted at the same time, the newest wins and dev builds warn
`ERR_DUPLICATE_ANCHOR`.

## Hooks

### `usePip(options?)`

Owns a core instance and **moves** the element you point it at (no portal). Takes the same options
as `createPip()`. With `id`, the instance is also registered for `getPip(id)` and
`<PipTrigger pipId>`. The instance is destroyed on unmount and is Strict Mode safe.

```tsx
import { usePip } from '@pip-it-up/react';

function Timer() {
  const { contentRef, originRef, open, close, isOpen } = usePip({ width: 360, height: 240 });
  return (
    <div ref={originRef}>
      <div ref={contentRef}>
        00:42
        {isOpen && <button onClick={close}>Back to page</button>}
      </div>
      {!isOpen && (
        <button onClick={() => open().catch((err) => console.warn('PiP failed', err))}>
          Pop out
        </button>
      )}
    </div>
  );
}
```

| Returns | Description |
| :--- | :--- |
| `contentRef` | Attach to the element that moves. |
| `originRef` | Attach to the place it returns to. |
| `open()` / `toggle()` | Promises. Call from a user gesture and always `.catch`: they reject when opening fails, including `ERR_OPEN_ABORTED` when `close()` runs first. See [core errors](https://github.com/Shakya47/pip-it-up/blob/main/packages/core/README.md#errors). |
| `close()` | Synchronous. |
| `isOpen`, `isSupported`, `pipWindow` | Live state. `pipWindow` is `null` while closed. |

React handlers work inside the window: `usePip()` bridges events from the PiP document back to
React. Differences from the page:

- Bridged events carry `pipItUpBridged: true` on `e.nativeEvent`.
- The copy is dispatched in the main document, so page-level **capture** listeners on `window` /
  `document` see it too. A global capture `keydown` shortcut can fire twice; skip events with
  `pipItUpBridged` there.
- React handlers run after native listeners inside the content, and not at all if one stops
  propagation.
- `onSelect` misses selection changes made only with the keyboard.

`<PipWrapper>` uses a portal instead and has none of these differences.

### `usePipContext()`

Inside a `<PipWrapper>` or a hosted widget, returns `{ instance, state, isInsidePip }`:

- `instance`: the core instance (`open`, `close`, `toggle`, `isOpen()`, …).
- `state`: `{ isOpen, isSupported, pipWindow }`.
- `isInsidePip`: `true` while this instance is open (with Document PiP the content renders in the PiP window).

Throws outside a wrapper.

### `useIsPipSupported()`

```tsx
const supported = useIsPipSupported();
```

`true` when the **browser** has Document PiP or video PiP. It is `false` on the server and on the
first client render.

It does not say whether a given instance can open. For that, read `isSupported` from `usePip()` or
`usePipContext().state`: it is `true` only when `open()` will actually do something for that
content (for example, video PiP needs exactly one `<video>`).

<a id="native-video-pip"></a>

### `useVideoPip(videoRef)`

Floats a single `<video>` with the browser's native video PiP (`video.requestPictureInPicture()`).
The `<video>` stays in your page. It works in more browsers than Document PiP, including Safari and
iOS.

```tsx
import { useRef } from 'react';
import { useVideoPip } from '@pip-it-up/react';

function Player() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isActive, toggle } = useVideoPip(videoRef);

  return (
    <>
      <video ref={videoRef} src="/clip.mp4" controls playsInline />
      <button onClick={toggle}>{isActive ? 'Exit PiP' : 'Pop out video'}</button>
    </>
  );
}
```

| Returns | Description |
| :--- | :--- |
| `isActive` | `true` while this video is in PiP. Stays correct when the user closes the overlay itself. |
| `enter()` / `leave()` | Promises that **reject** when the browser refuses (for example `NotAllowedError` with no user gesture). `enter()` also rejects when the ref has no `<video>`. |
| `toggle()` | For event handlers. Never rejects; logs a `[useVideoPip]` warning instead. |

Use video PiP for a single `<video>`. For anything else (audio players, canvases, editors, custom
controls), use `<PipWrapper>`. Caveats (gestures, one element at a time, iOS `playsinline`, which
`enter()` adds for you, `disablePictureInPicture`): [Video PiP caveats](https://github.com/Shakya47/pip-it-up/blob/main/packages/core/README.md#video-pip-caveats).

### Dormancy hooks

A widget hosted by `<PipProvider>` keeps running while parked in the garage. These hooks let it
slow down. They only work inside a `registry` widget; elsewhere they throw `ERR_NO_HOST`.

Each widget is at one activity level:

| Level | When | Suggested policy | Default `useAdaptiveInterval` period |
| :--- | :--- | :--- | :--- |
| `active` | docked or in PiP, tab visible | full-rate work | 1 s |
| `background` | docked or in PiP, tab hidden | pause rAF, keep sockets | 15 s |
| `dormant` | in the garage, tab visible | pause media and rAF | 60 s |
| `frozen` | in the garage and tab hidden, or the page is frozen | no timers at all | no timer |

#### `useDormancy()`

```tsx
const { level, placement, isOpen, visible, revealCount } = useDormancy();
```

| Field | Description |
| :--- | :--- |
| `level` | `'active' \| 'background' \| 'dormant' \| 'frozen'` |
| `placement` | `'anchor' \| 'pip' \| 'garage'` |
| `isOpen` | A PiP window is open for this id. |
| `visible` | The document showing the widget is visible. |
| `revealCount` | Goes up each time the widget leaves the garage. |

The snapshot object stays the same until something changes. It also has `id`.

#### `useAdaptiveInterval(callback, periods?)`

An interval whose period follows the level. `null` turns the timer off for that level; levels you
leave out use the defaults above. Periods below 250 ms are raised to 250 ms; anything faster
should use `requestAnimationFrame`. A new inline callback
each render does not restart the timer.

```tsx
useAdaptiveInterval(() => refetch(), { active: 1000, background: 15000, dormant: 60000, frozen: null });
```

#### `useActiveEffect(effect, deps)`

Like `useEffect`, but runs only while `level === 'active'` and cleans up whenever it leaves
`active` (including `active → background`). Use it for sockets and animation loops.

```tsx
useActiveEffect(() => {
  const socket = subscribe(topic);
  return () => socket.close();
}, [topic]);
```

#### `useRevealEffect(effect)`

Runs on mount unless the widget is parked in the garage, and again each time it leaves the garage. Use it to
re-measure charts, maps and canvases.

```tsx
useRevealEffect(() => {
  chart.resize();
});
```

<a id="automatic-pip"></a>

## Automatic PiP (pop out on tab switch)

`useAutoPip(enter, options?)` tries to enter PiP when the tab is hidden, like YouTube and Google
Meet. It decides **when**; `enter` decides **what** opens.

A video:

```tsx
import { useRef } from 'react';
import { useAutoPip, useVideoPip } from '@pip-it-up/react';

function Player() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { enter } = useVideoPip(videoRef);

  useAutoPip(enter, { when: () => videoRef.current?.paused === false });

  return <video ref={videoRef} src="/clip.mp4" controls playsInline />;
}
```

A whole component: call the hook inside the `<PipWrapper>` so `usePipContext()` can reach it.

```tsx
function EditorBody() {
  const { instance } = usePipContext();
  useAutoPip(instance.open, { when: () => !instance.isOpen() });
  return <textarea />;
}

export function Editor() {
  return (
    <PipWrapper>
      <EditorBody />
    </PipWrapper>
  );
}
```

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `enabled` | `boolean` | `true` | `false` detaches the listener without unmounting (for a user setting). |
| `when` | `() => boolean` | always | Checked at attempt time. Return `false` to skip. |
| `onResult` | `(r: AutoPipResult) => void` | — | Reports every attempt, including expected rejections. |
| `mediaSession` | `boolean` | `false` | Also register the `enterpictureinpicture` Media Session action. Use from one component per page. |
| `signal` | `AbortSignal` | — | Aborting it stops auto-PiP, like unmounting. |

The hook stops on unmount. `enter`, `when` and `onResult` may be new inline functions each render.

### Why an attempt can be rejected

- Opening PiP needs a recent user gesture (about 5 seconds).
- One gesture pays for one attempt.
- So a page the user touched just before leaving pops out; a page left untouched does not.
- `onResult` tells the two apart: `hadActivation: false` is expected; `hadActivation: true` is a
  real failure.
- `mediaSession: true` lets eligible origins (camera/mic in use, installed PWA) open with no
  gesture at all.

Rules: [core Automatic PiP](https://github.com/Shakya47/pip-it-up/blob/main/packages/core/README.md#automatic-pip).
Deep dive (Google Meet, editors vs video, two components, tab switch vs app switch):
[auto-PiP guide](https://github.com/Shakya47/pip-it-up/blob/main/docs/guides/auto-pip.md).

## Gotchas

### CSS inheritance

The PiP window is a separate document. Stylesheets and `<html>` / `<body>` classes are copied, but
your content does not inherit styles from ancestors outside the wrapper (a `#root` div, a theme
provider). Put the theme or alignment classes (`dark`, `text-center`) on the content itself.

### Editors and maps that cache `document`

Some libraries store `document` or `window` once. After the move they point at the wrong document.

- **Monaco** needs nothing: it reads the document live. See the [Monaco recipe](https://github.com/Shakya47/pip-it-up/blob/main/docs/recipes/monaco.md).
- **TipTap / ProseMirror** caches its root. Call `updateRoot()` whenever the window changes:

```tsx
const { state } = usePipContext();

useEffect(() => {
  editor?.view.updateRoot();
}, [editor, state.pipWindow]);
```

`state.pipWindow` changes once per open and once per close, exactly when a cached reference goes
stale. See the [TipTap recipe](https://github.com/Shakya47/pip-it-up/blob/main/docs/recipes/tiptap.md).

Remounting with `key={isInsidePip ? 'pip' : 'main'}` also works, but it throws away undo history,
scroll, selection and IME input. Use it only when the library has no way to refresh its cache, and
first lift the state you need into a parent, a store or the URL.

### Iframes

Cross-origin embeds (YouTube, Vimeo, Maps) don't work in the window: moving an `<iframe>` reloads it,
and the service rejects the new origin. Use a `<video>` with a direct source instead. Details:
[core gotchas](https://github.com/Shakya47/pip-it-up/blob/main/packages/core/README.md#gotchas).

## Accessibility

- **Announcements**: `<PipWrapper>` has a hidden `aria-live="polite"` region that announces when
  content moves to the window and when it comes back.
- **Trigger**: `<PipTrigger>` sets `aria-pressed`. Its accessible name is its visible label, so pass
  `aria-label` (for example `"Open Picture-in-Picture"`) for a name without the glyphs.
- **Focus on open**: `<PipWrapper>` focuses the window, then the first focusable element in the
  content (or the content box).
- **Focus on close**: focus goes back to the element focused before opening, usually the trigger
  (`restoreFocus`, default `true`). If focus ends up on `<body>`, the content gets it.
- **Shortcuts**: document your own shortcut with `aria-keyshortcuts`, e.g.
  `<PipTrigger aria-keyshortcuts="Alt+P">`.

## Next.js / SSR

Document PiP is browser-only, so render components that use it on the client (`"use client"`).

`<PipProvider>` and `<PipAnchor>` are SSR-safe. On the server the provider renders only its
`children`, and anchors render their box and placeholder. Widgets attach after hydration, so there
is no mismatch. Walkthrough: [Next.js recipe](https://github.com/Shakya47/pip-it-up/blob/main/docs/recipes/nextjs.md).

## Security

This package inherits core's security model (same-origin only, keyboard and pointer bridges, style
copying, fallback URL checks, registry trust). Read [core Security](https://github.com/Shakya47/pip-it-up/blob/main/packages/core/README.md#security).
CSP and Trusted Types: [docs/csp-and-trusted-types.md](https://github.com/Shakya47/pip-it-up/blob/main/docs/csp-and-trusted-types.md).

React-specific point, the **garage**:

- Parked widgets live in a hidden `[data-pip-garage]` container on `document.body`, marked `inert`
  and `aria-hidden="true"` (no focus, no clicks, hidden from assistive tech).
- It is **not** an isolation boundary. Parked scripts keep running (browsers throttle background
  work) and any same-page script can query the DOM. `content-visibility: hidden` is a rendering
  optimisation, not a sandbox. Never host untrusted content in a `registry` widget.

Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/Shakya47/pip-it-up/security/advisories/new)
([SECURITY.md](https://github.com/Shakya47/pip-it-up/blob/main/SECURITY.md)).

## Errors

React errors and warnings carry a `code`. Messages start with `[pip-it-up] <code>:`.

| Code | When | Effect |
| :--- | :--- | :--- |
| `ERR_NO_PROVIDER` | `<PipAnchor>` rendered outside `<PipProvider>` | Throws |
| `ERR_NO_HOST` | A dormancy hook called outside a `registry` widget | Throws |
| `ERR_UNKNOWN_ID` | `<PipAnchor id>` is not a key of `registry` | Throws in dev, warns in production |
| `ERR_DUPLICATE_ANCHOR` | Two anchors for one id mounted at once | Warns in dev only; the newest wins |
| `ERR_SHUTTLE_MOVE_FAILED` | Moving the content into the garage, an anchor, the origin or the PiP window failed with both `moveBefore` and `appendChild` | Throws |

`open()` / `toggle()` rejections (`ERR_OPEN_ABORTED`, `ERR_WINDOW_CLOSED`, `ERR_INVALID_FALLBACK`,
browser errors like `NotAllowedError`) come from core: [core Errors](https://github.com/Shakya47/pip-it-up/blob/main/packages/core/README.md#errors).

## License

MIT
