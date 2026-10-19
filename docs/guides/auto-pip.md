# Automatic PiP in React: a deep dive

This guide goes deeper than the [`useAutoPip` section of the React README](https://github.com/Shakya47/pip-it-up/blob/main/packages/react/README.md#automatic-pip-pop-out-on-tab-switch).
The rules the browser applies live in core: [Automatic PiP](https://github.com/Shakya47/pip-it-up/blob/main/packages/core/README.md#automatic-pip) and [Why an attempt can be rejected](https://github.com/Shakya47/pip-it-up/blob/main/packages/core/README.md#why-an-attempt-can-be-rejected).

## The one rule behind everything

Both `video.requestPictureInPicture()` and `documentPictureInPicture.requestWindow()` need
**transient user activation**.

| Property | What it means for you |
| :--- | :--- |
| It lasts about 5 seconds | A click or keystroke shortly before the tab is hidden still counts. |
| It survives across tasks | A `visibilitychange` listener that runs later still holds it. A `requestPictureInPicture()` fired from a `setTimeout` 3 s after a click succeeds. |
| A successful call consumes it | One attempt per gesture. The next one fails with `NotAllowedError` until the user interacts again. |
| Sticky activation does not count | `navigator.userActivation.hasBeenActive === true` does not help. You cannot bank a gesture. |

So automatic PiP works when the user touched the page just before leaving it, and fails on a page
left untouched for longer than the activation window. That is expected, not a bug.

## Reading `onResult`

```tsx
useAutoPip(enter, {
  onResult: (r) => {
    if (r.ok) return; // r.grantedBy is 'gesture' or 'browser'
    if (!r.hadActivation) return; // expected: nothing recent authorised it
    console.error('Real failure:', r.error); // the gesture was accepted; something else broke
  },
});
```

- `hadActivation: false` is the normal, harmless outcome.
- `hadActivation: true` means the gesture was accepted and something else failed. Log that one.

## Don't hand-roll `visibilitychange`

A plain `visibilitychange` handler that calls `requestPictureInPicture()` works only when the user
happened to interact in the last few seconds. It works sometimes, which is worse than never working.
Don't ship it as a feature. `useAutoPip` runs the same attempt but reports each outcome through
`onResult`.

One exception is in the browser's own error message: if something is **already** in PiP, switching
to another video needs no gesture. That does not help with the first entry.

The `autoPictureInPicture` attribute is a Safari mechanism. Chromium does not expose it on
`HTMLVideoElement`.

## Gesture-free auto-PiP: how Google Meet does it

The browser can enter PiP with **no gesture at all**, but only when it decides to. Your page has
to register for it first:

1. Your page registers the Media Session action `enterpictureinpicture`.
2. Chrome decides whether your origin is eligible.
3. If it is, Chrome **calls your handler itself** when the tab is hidden. The call comes from the
   browser, so no activation is needed.

`mediaSession: true` does step 1 for you:

```tsx
useAutoPip(enter, { mediaSession: true });
```

Step 2 is not up to you. Chrome treats an origin as eligible when:

- the page is using the camera or microphone (the Google Meet case),
- the site is an installed PWA, or
- the user allowed it at `chrome://settings/content/autoPictureInPicture`.

That is why Meet's auto-PiP looks unconditional: a call holds the camera. A video-only page is not
eligible, so it relies on the activation window instead. It registers the handler and the browser
simply never calls it on tab-hide, which is fine.

More facts about the action:

- It only exists while a media session does, i.e. while media is playing. Registering it for a
  text editor does nothing, and does no harm.
- The same registration adds a PiP button to the browser's own media controls.
- There is one Media Session per document. Enable `mediaSession` from **one** component per page.

## Can any component pop out automatically?

Yes. Each mechanism has one limit.

| | Native Video PiP | Document PiP |
| :--- | :--- | :--- |
| Works with | a single `<video>` only | any DOM subtree |
| Needs a gesture | yes | yes, the same way |
| Gesture-free path | Media Session action, on eligible origins | none |

Document PiP accepts any element, so a text editor, a chat panel or a dashboard pops out just like
a video. What differs is whether a gesture is still live when the tab is hidden:

- **A video** gets its gesture from the click on *play*, then gets no more input. After a minute
  of playback the activation has expired, so a tab switch is rejected.
- **An editor** gets a fresh gesture with every keystroke, and each one restarts the ~5 s window.
  That works while someone is typing. A writer who pauses to think and then switches tabs is
  outside the window and gets nothing.

## Two components, one activation

The activation is **global and single**. Mount `useAutoPip` in two components, and one tab switch
has only one activation to spend:

- exactly one of them pops out;
- the other is rejected with `NotAllowedError`.

Native video PiP and Document PiP both spend the same activation, and only one PiP window exists at
a time anyway.

Which one wins depends on *registration order*, and the two paths go in **opposite** directions:

| Path | How handlers are stored | Winner |
| :--- | :--- | :--- |
| `visibilitychange` (the gesture path) | every listener fires, in registration order | the **first** to register (the component that mounted first) |
| `enterpictureinpicture` (`mediaSession: true`) | one global handler per action | the **last** to register (a later `setActionHandler` silently replaces the earlier one) |

React runs effects in mount order, so "first to register" is the component earliest in the tree.
Reordering two sections in your JSX changes the winner with no edit to either component. Don't rely
on it.

**Pick the winner yourself.** `when` runs at trigger time, so use it to let one owner stand down:

```tsx
import { useRef } from 'react';
import { PipWrapper, useAutoPip, usePipContext, useVideoPip } from '@pip-it-up/react';

function EditorAutoPip({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const { instance } = usePipContext();
  // The editor pops out only when the video is not playing.
  useAutoPip(instance.open, {
    when: () => !instance.isOpen() && videoRef.current?.paused !== false,
  });
  return <textarea />;
}

function Page() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { enter } = useVideoPip(videoRef);
  // The video pops out only while it plays.
  useAutoPip(enter, { when: () => videoRef.current?.paused === false });

  return (
    <>
      <video ref={videoRef} src="/clip.mp4" controls playsInline />
      <PipWrapper>
        <EditorAutoPip videoRef={videoRef} />
      </PipWrapper>
    </>
  );
}
```

With more than two candidates, use **one** `useAutoPip` whose `enter` picks the right target,
instead of several hooks racing. Pass `mediaSession: true` from one component only.

## What counts as "leaving"

`useAutoPip` listens for `visibilitychange`. That covers:

- switching tabs;
- minimising the window.

It does **not** fire when you switch to another app while the browser window stays visible. The
document is only unfocused then, not hidden. Listening for `blur` would catch that, but `blur` also
fires when you click the address bar or open DevTools, which would pop the window out when nobody
asked. So `useAutoPip` does not listen for `blur`.
