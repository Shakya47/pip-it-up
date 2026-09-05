# @pip-it-up/react

<p align="center">
  <img src="https://raw.githubusercontent.com/Shakya47/pip-it-up/main/docs/assets/pip-it-up-github-banner.gif" alt="pip-it-up-github-banner" width="100%" />
</p>

> **Status: Active Beta** — The API is in active development and subject to change before v1.0. See the [roadmap](#roadmap) for upcoming features.

React bindings for `pip-it-up` — a helper library for the **Document Picture-in-Picture API**.

## What is Document Picture-in-Picture?

The [Document Picture-in-Picture API](https://developer.mozilla.org/en-US/docs/Web/API/Document_Picture-in-Picture_API) is a new browser capability that allows you to open a floating window that can be populated with any arbitrary HTML content, rather than just a video element. 

`@pip-it-up/react` makes it trivial to use this API in React applications with familiar patterns like Portals, Hooks, and Controlled Components.

## Installation

```bash
npm install @pip-it-up/react @pip-it-up/core
```

> **Node version**: `engines` constrains the **build and tooling** environment (`>=20`). The published bundles target browsers: Document Picture-in-Picture requires Chromium 116+, and the classic Video PiP fallback covers roughly 95% of browsers including Safari and Firefox.

## Live Demo

Try out the components instantly in your browser:

[![Edit in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/p/sandbox/pip-it-up-test-xfng5n)

## Components

### `<PipWrapper>`

Wraps the content you want to move into the **Picture-in-Picture** window. 

#### Uncontrolled (Default)
```tsx
<PipWrapper>
  <div>Content to move</div>
  <PipTrigger>Toggle</PipTrigger>
</PipWrapper>
```

#### Controlled
```tsx
const [isOpen, setIsOpen] = useState(false);

<PipWrapper open={isOpen} onOpenChange={setIsOpen}>
  <div>Content to move</div>
</PipWrapper>
```

#### Props

Supports all `PipOptions` from `@pip-it-up/core`, including:

- **`id`** (string): A unique identifier for the PiP instance. Required if you want to control this wrapper from a remote `<PipTrigger pipId="...">`.
- **`width` / `height`** (number, optional): If provided, forces the PiP window to these dimensions. **If omitted, the library uses a `ResizeObserver` to automatically match the component's exact size on the page.**
- **`mode`** (deprecated, `"move" | "portal"`, default: `"move"`):
  - *Deprecated*: The React package always uses **React Portals** (`"portal"` mode) internally because React manages its own DOM structure. Direct vanilla DOM manipulation (like `move`/`clone`) would break React's reconciler. Both options behave identically in `PipWrapper`.
- **`fallback`** (`"new-tab" | "none"`, default: `"new-tab"`):
  - Determines behavior when the Document PiP API is not supported.
- **`fallbackUrl`** (string):
  - The URL to open in a new browser tab when using `fallback="new-tab"`. This is required if `'new-tab'` is used.
- **`copyStyles`** (`"sync" | "once" | false`, default: `"sync"`): 
  - `"sync"`: Real-time synchronization of CSS changes (MutationObserver).
  - `"once"`: One-time copy at window open.
- **`reserveSpace`** (boolean, default: `true`): Whether to show a placeholder in the original position to prevent layout jumps.
- **`placeholder`** (ReactNode): Custom component to show in the placeholder area.
- **`centerInPip`** (boolean, default: `false`): Automatically centers your content in the PiP window.
- **`open`** (boolean): Controlled state for the window.
- **`onOpenChange`** (callback): Fired when the window opens or closes.

### `<PipTrigger>`

A button that toggles the **Picture-in-Picture** window.

#### Nested (Colocated)
When placed directly inside a `<PipWrapper>`, it automatically controls its parent:
```tsx
<PipTrigger asChild>
  <button className="my-custom-btn">Open Picture-in-Picture</button>
</PipTrigger>
```

#### Decoupled (Remote)
If your trigger and wrapper live in completely different parts of your React tree, you can link them using an `id` (powered by the core registry API):
```tsx
// Anywhere in your app (e.g., in a global Navbar)
<PipTrigger pipId="main-player">Open Player</PipTrigger>

// Somewhere else completely
<PipWrapper id="main-player">
  <Player />
</PipWrapper>
```

<a id="route-persistent-pip"></a>

### `<PipProvider>` + `<PipAnchor>` (route-persistent PiP)

`<PipWrapper>` is scoped to the component that renders it, so a route change unmounts it and closes
any open PiP window. When you need a widget to **survive navigation**, mount it once at the
application root with `<PipProvider>` and give it a docking slot with `<PipAnchor>`.

Adopting this is a change to **one** page. Every other route stays exactly as it is — no anchor, no
placeholder, no imports.

```tsx
// app/layout.tsx  (or pages/_app.tsx, or above <Routes> for React Router)
"use client"

import { PipProvider } from '@pip-it-up/react';
import { LiveTracker } from './LiveTracker';

const registry = { tracker: <LiveTracker /> };   // define outside render, or useMemo it

export default function RootLayout({ children }) {
  return <PipProvider registry={registry}>{children}</PipProvider>;
}
```

```tsx
// app/dashboard/page.tsx — the ONE page that owns the widget
"use client"

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

Every other route (`/reports`, `/settings`, …) needs **no changes at all**.

#### The three placements

A hosted widget is mounted for as long as the provider is mounted, and is always in exactly one of
three places:

| Placement | When | Visible |
| :--- | :--- | :--- |
| `anchor` | a `<PipAnchor>` for its id is on the current route | yes, docked inline |
| `pip` | the PiP window is open | yes, in the floating window |
| `garage` | no anchor on this route and no window | **no** — but fully alive |

`garage` is the one that makes navigation a non-event: the widget keeps its React state, its
`<video>` playhead, its WebGL context and its open sockets while parked. Returning to a route that
has an anchor re-docks it **automatically** — there is no restore step to implement.

#### `<PipProvider>` props

- **`registry`** (`Record<string, ReactNode>`, required): the persistent subtrees, keyed by id. Each
  value is rendered exactly once. Define it outside render or wrap it in `useMemo` — correctness
  does not depend on it, but every provider render otherwise re-renders all hosted subtrees.
- **`options`** (`Record<string, PipOptions>`, optional): per-id core options. `id` and `mode` are
  forced and cannot be overridden.
- **`gcGraceMs`** (number, default `30000`): how long to wait before destroying a widget whose id
  was **removed from `registry`**. See "Tearing a widget down" below.
- **`dormantMedia`** (`"pause" | "keep"`, default `"pause"`): whether to pause `<video>` / `<audio>`
  while parked in the garage. The default avoids phantom audio from a route you have left.

#### `<PipAnchor>` props

- **`id`** (string, required): must be a key of the provider's `registry`.
- **`reserve`** (`"size" | "ratio" | "none"`, default `"size"`): what to hold while the content is
  away. `"size"` freezes the measured border box so nothing below the anchor jumps; `"ratio"`
  freezes `aspect-ratio` instead; `"none"` lets the layout collapse.
- **`axis`** (`"block" | "inline" | "both"`, default `"block"`).
- **`handoffMs`** (number, default `200`): duration of the size animation when the content returns.
  Skipped automatically under `prefers-reduced-motion`.
- **`placeholder`** (ReactNode): rendered inside the reserved box while the content is elsewhere.
  Positioned `absolute; inset: 0` so it contributes nothing to the anchor's intrinsic size.
- **`as`** (ElementType, default `"div"`), **`className`**, **`style`**.

> [!IMPORTANT]
> `<PipAnchor>` must generate a real layout box. It applies `position: relative; display: block` for
> you; do not override that with `display: contents`. Without a box there is nothing to measure, no
> containing block for the placeholder, and nowhere to write the size reservation.

#### Tearing a widget down

Nothing in the routes destroys a hosted widget — that is the point. If you *do* want it gone (to
bound memory, say), remove its id from `registry`. The provider then runs an eviction lease: after
`gcGraceMs` it re-checks that no anchor claimed the id and no window is open, then destroys the
instance and removes its container. Persist whatever state matters first; a later re-add builds a
fresh widget.

#### Multiple anchors for one id

More than one route may render an anchor for the same id — a call panel with a designated slot on
several pages, for instance. Navigating between them hands the widget from one anchor to the other
with no unmount. This is supported but is the advanced case; most widgets want a single owning page.

## Hooks

### `usePip()`
Returns the context state for managing the **Picture-in-Picture** lifecycle.
```tsx
const { isOpen, pipWindow, instance, isInsidePip } = usePip();
```
- **`isOpen`**: Boolean indicating if the PiP window is open.
- **`pipWindow`**: The native `Window` object of the PiP instance (null if closed).
- **`isInsidePip`**: Boolean that is `true` only when the component is being rendered inside the PiP window.
- **`instance`**: The underlying `@pip-it-up/core` instance.

> [!NOTE]
> `usePipContext()` is also available if you only need the raw context without the extra convenience properties of `usePip()`.

### `useIsPipSupported()`
Returns `true` if the browser natively supports any Picture-in-Picture API (either Document PiP or classic Video PiP).
```tsx
const isSupported = useIsPipSupported();
```

### `useVideoPip()`
Controls Picture-in-Picture mode explicitly for a single HTML `<video>` element. Unlike `usePip()` (which opens a Document PiP window), `useVideoPip()` uses the classic HTML5 Video Picture-in-Picture API (`video.requestPictureInPicture()`), which has a much higher browser compatibility (~95%), including Safari macOS/iOS and Firefox.

```tsx
import { useRef } from 'react';
import { useVideoPip } from '@pip-it-up/react';

function MyPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isActive, toggle } = useVideoPip(videoRef);

  return (
    <div>
      <video ref={videoRef} src="video.mp4" controls playsInline />
      <button onClick={toggle}>
        {isActive ? 'Close PiP' : 'Open Video PiP'}
      </button>
    </div>
  );
}
```

### Dormancy hooks (route-persistent widgets)

A widget hosted by `<PipProvider>` stays mounted while parked in the garage, so it would otherwise
keep polling and animating for a route nobody is looking at. These four hooks let it throttle
itself. They only work inside a `registry` subtree — calling them elsewhere throws `ERR_NO_HOST`.

Every hosted widget observes exactly one of four activity levels:

| Level | When | Suggested policy |
| :--- | :--- | :--- |
| `active` | docked or popped out, tab visible | full-rate work, 1s polling |
| `background` | docked or popped out, tab hidden | pause rAF, keep sockets, 15s polling |
| `dormant` | parked in the garage, tab visible | pause media and rAF, 60s polling |
| `frozen` | parked and tab hidden, or Page Lifecycle `freeze` | no timers at all |

#### `useDormancy()`
Returns the current activity snapshot. Referentially stable until something actually changes.
```tsx
const { level, placement, isOpen, visible, revealCount } = useDormancy();
```
- **`level`**: `"active" | "background" | "dormant" | "frozen"`.
- **`placement`**: `"anchor" | "pip" | "garage"` — where the widget currently lives.
- **`isOpen`**: a PiP window is open for this id.
- **`visible`**: the host document is visible.
- **`revealCount`**: increments on every transition out of the garage.

#### `useAdaptiveInterval(callback, periods?)`
An interval whose period follows the activity level. Pass `null` for a level to disable the timer
entirely there.
```tsx
useAdaptiveInterval(() => refetch(), { active: 1000, background: 15000, dormant: 60000, frozen: null });
```
Defaults are the table above. Periods are floored at 250ms — below that you want
`requestAnimationFrame`, not polling. The callback is held in a ref, so passing a fresh inline
closure each render does **not** restart the timer.

#### `useActiveEffect(effect, deps)`
Like `useEffect`, but runs **only** while `level === 'active'`, and cleans up on every exit from
active — including `active → background`. Use it for socket subscriptions and animation loops.
```tsx
useActiveEffect(() => {
  const socket = subscribe(topic);
  return () => socket.close();
}, [topic]);
```

#### `useRevealEffect(effect)`
Runs on mount if already rendered, and again on every transition out of the garage. Use it to
re-measure anything that needs real layout — charts, maps, canvases.
```tsx
useRevealEffect(() => { chart.resize(); });
```

<a id="native-video-pip"></a>

## Native Video PiP

There are two kinds of Picture-in-Picture, and picking the right one matters:

| | **Native Video PiP** | **Document PiP** |
| :--- | :--- | :--- |
| API | `video.requestPictureInPicture()` | `documentPictureInPicture.requestWindow()` |
| What floats | the video's frames, in an OS-drawn overlay | a real browser window containing your DOM |
| Moves DOM? | **No** — the `<video>` stays in your page | Yes — the node is relocated |
| Custom controls | No, the OS draws them | Yes, it is your HTML |
| Browser support | ~95% (Chrome, Edge, Safari incl. iOS, Firefox) | Chromium 116+ only |
| Use it for | a single `<video>` | anything else: audio players, canvases, editors, maps, dashboards |

If your content **is** a video, use native Video PiP. It is the YouTube-style overlay, it needs no
layout reservation, and it works in Safari and Firefox where Document PiP does not.

### `useVideoPip()`

```tsx
import { useRef } from 'react';
import { useVideoPip } from '@pip-it-up/react';

function Player() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isActive, toggle } = useVideoPip(videoRef);

  return (
    <>
      <video ref={videoRef} src="/clip.mp4" controls playsInline />
      <button onClick={() => void toggle()}>
        {isActive ? 'Exit PiP' : 'Pop out video'}
      </button>
    </>
  );
}
```

Returns:

- **`isActive`** (boolean): `true` while this video is the document's PiP element. Tracks
  `enterpictureinpicture` / `leavepictureinpicture` and the WebKit presentation-mode events, so it
  stays correct when the user closes the overlay from its own chrome.
- **`enter()` / `leave()` / `toggle()`**: all return promises and swallow their own errors with a
  `console.warn`, so a blocked request never becomes an unhandled rejection.

### Caveats

**1. It needs a real user gesture.** `requestPictureInPicture()` requires *transient* user
activation. Call it from a click handler. Called without one it rejects with:

```
NotAllowedError: Must be handling a user gesture if there isn't already an element in
Picture-in-Picture.
```

**2. Auto-PiP on tab switch cannot be done from page code.** This is the most common request, and
it is worth being precise about, because the failure is not fixable in userland:

- A `visibilitychange` handler *usually* has no transient activation — switching tabs is not a
  gesture on your page — so the call normally rejects. **The exception is timing:** transient
  activation survives roughly 5 seconds after any click or keystroke (measured in Chrome: live at
  4.8s, expired by 5.8s), so if the user clicks something and
  switches tabs immediately, the call succeeds. Measured: inside a click handler it succeeds; six
  seconds later with no interaction the same call throws `NotAllowedError`. This makes a
  hand-rolled `visibilitychange` approach work intermittently, which is worse than failing
  outright — do not ship it as a feature.
- **Sticky activation does not help.** Even with `navigator.userActivation.hasBeenActive === true`
  (the user clicked earlier in the session), the call still rejects. Only *transient* activation
  counts, and you cannot defer or bank it.
- The one exemption is in the error message: if something is **already** in PiP, swapping to
  another video is allowed without a gesture. That does not help for the first entry.
- The `autoPictureInPicture` attribute is a Safari mechanism; Chromium does not expose it on
  `HTMLVideoElement`.

**How Google Meet actually does it.** Auto-PiP is a capability the *browser* grants and the
*browser* triggers — but your page still has to register for it, or Chrome has nothing to call. The
mechanism is the Media Session action:

1. Your page registers `mediaSession.setActionHandler('enterpictureinpicture', handler)`.
2. Chrome decides whether your origin is eligible (see below).
3. If it is, Chrome **invokes your handler itself** when the tab becomes hidden. Because the call
   originates from the browser, the activation requirement is satisfied and PiP opens.

You never call it on `visibilitychange`; you register a handler and let Chrome drive. Chrome grants
eligibility to origins **actively using camera or microphone** (this is the Google Meet case), to
**installed PWAs**, and when the user enables it at
`chrome://settings/content/autoPictureInPicture`. Registering the handler is necessary but not
sufficient — a plain video site will register it and simply never be called on tab-hide, which is
the correct, graceful outcome.

The same registration also puts a PiP button in the browser's own media controls, so the handler is
worth adding either way:

```tsx
useEffect(() => {
  if (!('mediaSession' in navigator)) return;
  const ms = navigator.mediaSession as MediaSession & {
    setActionHandler: (a: string, h: (() => void) | null) => void;
  };
  try {
    ms.setActionHandler('enterpictureinpicture', () => void enter());
    return () => { try { ms.setActionHandler('enterpictureinpicture', null); } catch {} };
  } catch { /* action unsupported in this browser */ }
}, [enter]);
```

**3. One element at a time.** A document can have exactly one PiP element. Requesting PiP for a
second video moves the overlay rather than opening two.

**4. No audio PiP exists.** There is no native PiP for `<audio>`. To float an audio player — artwork,
scrubber, custom controls — use Document PiP via `<PipWrapper>`.

**5. iOS and Safari need `playsInline`.** Without it iOS takes the video fullscreen instead.
`enterVideoPip()` sets the attribute for you if it is missing, and falls back to
`webkitSetPresentationMode('picture-in-picture')` and then `webkitEnterFullscreen()` on older
WebKit.

**6. You cannot style the overlay.** It is drawn by the OS. If you need custom controls in the
floating window, that is Document PiP.

**7. Opt out per element** with the standard attribute, which the browser honours before any of
this: `<video disablePictureInPicture />`.

### Automatic fallback inside `<PipWrapper>`

You do not have to choose manually. When Document PiP is unavailable, `<PipWrapper>` inspects its
content and, if it finds exactly one `<video>` (either as the wrapper root or as its only video
descendant), it transparently falls back to native Video PiP — so a video player component works on
Safari, iOS and Firefox with no configuration.

It also handles the older WebKit presentation and fullscreen paths described in caveat 5. Pass
`disableVideoPip` to turn the fallback off and use the standard `fallback` behaviour
(`'new-tab'` or `'none'`) instead.

<a id="automatic-pip"></a>

## Automatic PiP (pop out on tab switch)

`useAutoPip` enters Picture-in-Picture the moment the tab is hidden — the behaviour YouTube and
Google Meet have when you switch away.

It owns *when* to attempt; you own *what* opens. Pass `enter` from [`useVideoPip()`](#usevideopip)
for a bare `<video>`, or `instance.open` from `usePipContext()` for a whole component.

### Always on

Omit `enabled` and it is simply always active. This is the whole thing:

```tsx
import { useRef } from 'react';
import { useVideoPip, useAutoPip } from '@pip-it-up/react';

function Player() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { enter } = useVideoPip(videoRef);

  useAutoPip(enter, { when: () => !videoRef.current?.paused });

  return <video ref={videoRef} src="/clip.mp4" controls />;
}
```

For a non-video component, open the Document PiP window instead. The hook must be called inside
the `<PipWrapper>` so that `usePipContext()` can reach the instance:

```tsx
function Editor() {
  const { instance, state } = usePipContext();
  useAutoPip(instance.open, { when: () => !state.isOpen });
  return <MyEditor />;
}

<PipWrapper>
  <Editor />
</PipWrapper>;
```

### Behind a user setting

Pass `enabled` to suspend it without unmounting. The listener is detached while it is `false`:

```tsx
const [autoPip, setAutoPip] = useState(false);
useAutoPip(enter, { enabled: autoPip });
```

### Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `enabled` | `boolean` | `true` | Suspend without unmounting. |
| `when` | `() => boolean` | always | Guard evaluated at attempt time. Skip if it returns `false`. |
| `onResult` | `(r: AutoPipResult) => void` | — | Reports every attempt, including expected rejections. |
| `mediaSession` | `boolean` | `false` | Also register the `enterpictureinpicture` Media Session action. See below. |
| `signal` | `AbortSignal` | — | Stop listening when aborted, instead of on unmount. |

`enter` may be a fresh inline arrow on every render; the hook reads it through a ref, so its
identity churn never detaches the listener.

### Why an attempt can be rejected

Both `video.requestPictureInPicture()` and `documentPictureInPicture.requestWindow()` require
**transient user activation**. Two properties of it decide whether automatic PiP works, and both
are easy to get wrong:

1. **Activation is time-based, and survives across tasks.** A gesture stays live for roughly five
   seconds. A `visibilitychange` listener runs long after the click or keystroke that armed it and
   still holds it — deferring the call does not lose the gesture. (Measured: a
   `requestPictureInPicture()` fired from a `setTimeout` 3 s after a click succeeds, with
   `navigator.userActivation.isActive === true`.)
2. **A successful call consumes it.** You get **one attempt per gesture**. The next one fails with
   `NotAllowedError` until the user interacts again.

So automatic PiP succeeds whenever the user touched the page shortly before leaving it — clicking
play and switching tabs, or typing and switching tabs — and fails on a page that has sat untouched
for longer than the activation window.

That is not a bug you can fix, and it is why `onResult` exists rather than a bare boolean:

```tsx
useAutoPip(enter, {
  onResult: (r) => {
    if (r.ok) return; // r.grantedBy is 'gesture' or 'browser'
    if (!r.hadActivation) return; // expected: nothing recent authorised it
    console.error('Real failure:', r.error); // the gesture was accepted; something else broke
  },
});
```

A rejection with `hadActivation: false` is the normal, benign outcome. One with
`hadActivation: true` means the gesture *was* accepted and the failure came from somewhere else —
that one is worth logging.

### Gesture-free auto-PiP, the way Meet gets it

Chrome can enter PiP with **no gesture at all**, but only on origins it considers eligible, and
only if the page has opted in by registering the `enterpictureinpicture` Media Session action.
`mediaSession: true` registers it for you:

```tsx
useAutoPip(enter, { mediaSession: true });
```

Registering it is the part you control. Eligibility is the part you do not — Chrome grants it when
the page is using the camera or microphone, when it is an installed PWA, or when the user has
allow-listed the site under `chrome://settings/content/autoPictureInPicture`. This is exactly why
Google Meet's auto-PiP feels unconditional: a Meet call holds the camera, so the origin is eligible
and the browser calls the handler itself. A video-only page is not eligible, so it falls back to
the activation window in the previous section.

The action also only exists while a media session does, i.e. while media is actually playing.
Registering it for a text editor is inert, not harmful. There is one Media Session per document, so
enable `mediaSession` from a single owner per page.

### Can any component be automatically popped out?

Yes — with one qualification per mechanism.

| | Native Video PiP | Document PiP |
| :--- | :--- | :--- |
| Works with | a single `<video>` only | any DOM subtree |
| Needs a gesture | yes | yes, identically |
| Gesture-free path | Media Session action, on eligible origins | none |

There is no element type that Document PiP refuses, so a text editor, a chat panel or a dashboard
automatically pops out just as a video does. What differs is how reliably the gesture is there when
the tab hides:

- **A video** is armed by the click on *play*, then goes quiet. If it plays for a minute before you
  switch tabs, the activation has long expired and the attempt is rejected.
- **An editor** is armed by every keystroke, each one restarting the ~5s window. That makes an
  editor a better fit than a video *while someone is actually typing* — but it is not a free pass.
  Measured in Chrome, activation from a keystroke is still live at 4.8s and gone by 5.8s, so a
  writer who types a paragraph, pauses to think, and then switches tabs is outside the window and
  gets nothing. Continuous typing keeps it armed; thinking does not.

### Two components, one activation

Auto-PiP does not compose the way ordinary hooks do, because the thing it spends is **global and
singular**. Mount `useAutoPip` in two components, enable both, and a single tab switch has one
transient activation to pay with — so exactly one of them pops out and the other is rejected with
`NotAllowedError`. Native video PiP and Document PiP do not sidestep each other here: both consume
the same activation, and only one PiP window exists at a time regardless.

Which one wins is decided by *registration order*, and the two trigger paths order themselves in
**opposite** directions:

| Path | Slot shape | Winner |
| :--- | :--- | :--- |
| `visibilitychange` (the gesture path) | every listener fires, in registration order | the **first** to register — i.e. whichever component mounts earliest |
| `enterpictureinpicture` (`mediaSession: true`) | one global handler per action name | the **last** to register — a later `setActionHandler` silently replaces an earlier one |

React runs effects depth-first in mount order, so "first to register" means the component earliest
in the tree. That makes the winner a function of your JSX order — reorder two sections and the
behaviour changes with no edit to either component. Don't rely on it.

**Make it explicit instead.** `when` is evaluated at trigger time, so it is the natural place to
arbitrate — give one owner priority and have the others stand down:

```tsx
// The editor claims the pop-out only when the video isn't the thing worth watching.
useAutoPip(instance.open, { when: () => !state.isOpen && videoRef.current?.paused !== false })
useAutoPip(enterVideo, { when: () => videoRef.current?.paused === false })
```

For more than two, hoist the decision to one owner: a single `useAutoPip` whose `enter` picks the
right target, rather than several hooks racing. And if you pass `mediaSession: true`, pass it from
**one** component only — a second registration takes the action over silently.

### Boundary

`useAutoPip` listens for `visibilitychange`, which covers switching tabs and minimising the window.
It does **not** fire when you switch to another application while the browser window stays
visible: the document is not hidden then, only unfocused. Listening for `blur` instead would catch
that, but it also fires on clicking the address bar or opening DevTools, which pops the window out
when nobody asked. `useAutoPip` does not do it for that reason.

## Tips & Gotchas

### CSS Inheritance
The Picture-in-Picture window is a separate document. While `@pip-it-up` automatically copies stylesheets and `body`/`html` classes, your content will **not** inherit styles from parent elements outside the `<PipWrapper>` (like a `#root` div or a theme provider). 
*   **Fix**: Add necessary alignment or theme classes (e.g., `text-center`, `dark`) directly to the content inside the `<PipWrapper>`.

### Seamless State Preservation (Video, Audio, Canvas, WebRTC)
Because `<PipWrapper>` uses a target-switching React Portal, stateful DOM content like `<video>` (keeps playing from the same position), `<audio>`, `<canvas>` (keeps its drawing buffer), and WebRTC `MediaStream` (remains active) will retain their state, refs, and DOM identity perfectly when entering or exiting Picture-in-Picture. You do not need to lift state, manually restore playheads, or re-initialize canvas drawings.

### Complex Editors, Maps & Custom Bindings

Some third-party editors (Monaco, TipTap/ProseMirror) and interactive DOM libraries (Leaflet,
Mapbox, Google Maps, D3) resolve `document` or `window` **once at initialisation** and cache it.
The DOM node itself survives the move to the PiP document untouched, but that cached reference does
not — so selection, hit-testing, dragging or focus can silently operate on the wrong document.

**Prefer the library's own invalidation hook.** Most of them have one, and it costs nothing:

```tsx
const { state } = usePipContext();

// TipTap / ProseMirror: `EditorView.root` is cached for selection reads.
useEffect(() => {
  editor?.view.updateRoot();
}, [editor, state.pipWindow]);
```

Keying on `state.pipWindow` is the right dependency: it changes exactly once per open and once per
close, which is precisely when a cached document reference goes stale.

**Whether a library needs this at all comes down to one thing: does it resolve the document live,
or cache it?** Monaco needs nothing — its internal `getWindow(node)` reads
`node.ownerDocument.defaultView` on every call, so the move is invisible to it, and
`automaticLayout: true` uses its own `ResizeObserver`, which keeps observing the element across
documents. ProseMirror caches `EditorView._root` on first use, so it needs the nudge above. Grep
your library for a stored `document`/`window` field to tell which kind you have.

**Remounting is the last resort, not the first.** Using `isInsidePip` as a React `key`
(`key={isInsidePip ? 'pip' : 'main'}`) does fix a stale reference, but by destroying and rebuilding
the component — which throws away exactly the state this library exists to preserve: undo history,
scroll position, selection, in-flight IME composition. Reach for it only when a library gives you
no way to invalidate its cache, and then lift any state you care about into a parent, a store or
the URL and pass it back down as controlled props.

### Cross-Origin Iframes (YouTube, Vimeo, Maps, etc.)
Cross-origin `<iframe>` embeds (YouTube, Vimeo, Google Maps, Spotify, etc.) will **not work** inside the PiP window. When PiP opens, React unmounts children and remounts them into a new document context. The iframe reloads in this new context with a different (or null) origin, causing the embedded service to reject the request (e.g., YouTube **Error 153**).

This is a **browser platform limitation** of the Document Picture-in-Picture API, not a bug in `pip-it-up`.

*   **Workaround**: For video content, use a native `<video>` element with a direct source URL instead of an iframe embed. Note that services like YouTube do not provide direct video file URLs — you'll need self-hosted or direct-URL video sources.

## Accessibility

`@pip-it-up/react` is built with accessibility (WAI-ARIA compliance) in mind:

- **State Announcements**: Automatically manages a visually hidden `aria-live="polite"` live region that announces to screen readers when content is portaled to the PiP window and when it is restored.
- **Trigger Attributes**: `<PipTrigger>` sets `aria-pressed` according to the active PiP window state and provides default `aria-label` tags (`Open Picture-in-Picture` / `Close Picture-in-Picture`), which can be overridden using custom button properties.
- **Focus Management**:
  - **On Open**: Focuses the new floating window and automatically redirects active keyboard focus to the first focusable element inside the portaled content (or fallback-focuses the root container).
  - **On Close**: Restores focus to the trigger button that launched the PiP window. If the trigger button is no longer present or focus gets lost to the document's body, it fallback-focuses the restored content container.
- **Keyboard Shortcut Discoverability**: If you implement custom global keyboard shortcuts to toggle the PiP window, you can document them for assistive technologies by passing the standard `aria-keyshortcuts` attribute (e.g. `<PipTrigger aria-keyshortcuts="Alt+P">`) directly to `<PipTrigger>`.

## Next.js / SSR
Because the **Document Picture-in-Picture API** is browser-only, ensure components interacting with it are rendered on the client (`"use client"`).

`<PipProvider>` and `<PipAnchor>` are SSR-safe. On the server the provider renders only its
`children` — no portals, no DOM access — and anchors render their box and placeholder. The hosted
subtrees attach on the client after hydration, so the server and client passes produce identical
markup and there is no mismatch. See [`docs/recipes/nextjs.md`](https://github.com/Shakya47/pip-it-up/blob/main/docs/recipes/nextjs.md) for a
full App Router walkthrough.

## Security

### 1. Same-Origin Requirement
The Document Picture-in-Picture API requires same-origin between the opener window and the PiP window. Cross-origin embedding is impossible by browser design (available in Chromium 116+ in secure contexts / HTTPS).

This frames every security consideration in this library: every cross-document operation performed by `@pip-it-up/react` and `@pip-it-up/core` is strictly same-origin by construction. Top-level browsing contexts are required; opening a PiP window from inside a nested `<iframe>` is prohibited by the browser and throws a `NotAllowedError`.

### 2. Core Security Model & Event Bridges
`@pip-it-up/react` is built directly on `@pip-it-up/core` and inherits its security model and event-bridging guarantees. See the [`@pip-it-up/core` Security Documentation](https://github.com/Shakya47/pip-it-up/blob/main/packages/core/README.md#security) for details on:
- **[Keyboard Event Bridge](https://github.com/Shakya47/pip-it-up/blob/main/packages/core/README.md#2-keyboard-event-bridge)**: `isTrusted` filter and `forwardKeyboardEvents: false` recommendation when hosting credential or payment inputs.
- **[Pointer Event Bridge](https://github.com/Shakya47/pip-it-up/blob/main/packages/core/README.md#3-pointer-event-bridge--coordinate-semantics)**: Viewport-relative coordinates, `forwardPointerEvents: false`, and guarding opener listeners with `pipItUpBridged`.
- **[Style Synchronization](https://github.com/Shakya47/pip-it-up/blob/main/packages/core/README.md#4-style-synchronization)**: Double-fetch behavior for external CSS, private CDN handling, and mandatory style sync.
- **[Fallback URL Validation](https://github.com/Shakya47/pip-it-up/blob/main/packages/core/README.md#5-fallback-url-validation)**: Runtime scheme validation (`http:`, `https:`), `noopener,noreferrer`, and application allowlist recommendations for `fallbackUrl`.
- **[Clone Mode Caveat](https://github.com/Shakya47/pip-it-up/blob/main/packages/core/README.md#6-clone-mode-caveat)**: `<PipWrapper>` and `<PipProvider>` exclusively use React Portals (`portal` mode) and do not support `clone` mode, eliminating inline handler execution risks in React.
- **[Registry Trust Model](https://github.com/Shakya47/pip-it-up/blob/main/packages/core/README.md#7-registry-trust-model)**: Same-page trust boundary for `PipWrapper id="..."` registrations, last-writer-wins collision warnings, and owner-only unregistration.

### 3. Route-Persistent PiP & The Attached Garage
When using route-persistent PiP, dormant components unmounted during route transitions park in a shared hidden DOM garage container (`[data-pip-garage]`) attached to `document.body`.

- **Inertness**: The garage is marked `inert` and `aria-hidden="true"`, which removes parked content from keyboard focus, pointer hit-testing, and assistive technology.
- **Not an Isolation Boundary**: The garage is **not an isolation boundary**. Parked scripts keep running (though background-throttled by the browser engine), and parked DOM is queryable by any same-page script via `document.querySelector`. `content-visibility: hidden` and `contain-intrinsic-size: 0 0` are rendering performance optimizations that skip layout and paint while explicitly preserving component state, not a security sandbox. Never host untrusted or unsanitized content in a registry subtree.

### 4. Reporting Vulnerabilities
If you discover a security vulnerability in `pip-it-up`, please report it privately through [GitHub Security Advisories](https://github.com/Shakya47/pip-it-up/security/advisories/new) per our [`SECURITY.md`](https://github.com/Shakya47/pip-it-up/blob/main/SECURITY.md).

For Content Security Policy (CSP) configurations and Trusted Types compatibility, see [`docs/csp-and-trusted-types.md`](https://github.com/Shakya47/pip-it-up/blob/main/docs/csp-and-trusted-types.md).



## Roadmap

These are actively being worked on:

- [x] **Seamless video/canvas/WebRTC PiP** — DOM node identity preserved across open/close (no more video restarts)
- [ ] **Vue and Svelte bindings** — `@pip-it-up/vue`, `@pip-it-up/svelte`
- [ ] **Angular bindings** — `@pip-it-up/angular` support
- [ ] **v1.0 stable release** — locked API, full browser matrix testing

Have a feature request? [Open an issue](https://github.com/Shakya47/pip-it-up/issues).

