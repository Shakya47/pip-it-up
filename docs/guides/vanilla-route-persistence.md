# Vanilla route persistence

Goal: a widget whose PiP window stays open while the user navigates, in plain JS or any framework without a React-style reconciler.

In React this is built in: `<PipProvider>`, `<PipAnchor>` and the dormancy hooks in [`@pip-it-up/react`](https://github.com/Shakya47/pip-it-up/blob/main/packages/react/README.md). `@pip-it-up/core` has no packaged equivalent, but it has every primitive you need.

## Why React needs a binding and vanilla does not

React destroys a portal whose container changes, so the React binding renders into a container it never replaces and moves that container with native DOM calls. Vanilla JS has no reconciler and no unmounting: a node you hold a reference to stays alive, and you move it yourself.

## What core gives you

| You need | Core gives you |
| :--- | :--- |
| Swap the restore target when the UI changes | `registerElements` and its compare-and-clear `release()` |
| Survive an origin being replaced mid-session | The restore target is read at close time, not open time |
| Move content while the PiP document is still alive | `registerTeardown` |
| Know whether a node is still safe to touch | `isUsable(el)` |
| Tie listeners to the instance's lifetime | `instance.signal` |
| Share one instance across modules | `registerPip` / `getPip`, owner-only `unregisterPip(id, instance)` |

Reference: [Element slots and teardown](https://github.com/Shakya47/pip-it-up/blob/main/packages/core/README.md#element-slots-and-teardown) and [Registry](https://github.com/Shakya47/pip-it-up/blob/main/packages/core/README.md#registry).

## Complete example

Your router calls `onRouteChange(slot)` after each navigation, with the element the widget should sit in on the new page, or `null` if that page has no place for it.

```ts
import { createPip, isUsable, registerPip } from '@pip-it-up/core';

const contentEl = document.getElementById('tracker')!;
const button = document.getElementById('tracker-pip')!;

const pip = createPip({ id: 'tracker', mode: 'move' });
registerPip('tracker', pip);

// A hidden container you own. Parked content stays CONNECTED to the document:
// detaching a <video> instead would run the HTML media removal steps and pause it.
const parked = document.createElement('div');
parked.setAttribute('inert', '');
parked.style.cssText =
  'position:fixed;top:0;left:0;width:0;height:0;overflow:hidden;' +
  'content-visibility:hidden;contain-intrinsic-size:0 0';
document.body.appendChild(parked);

// Where the widget belongs in the page right now.
let slot: HTMLElement | null = null;
const home = (): HTMLElement => (isUsable(slot) ? slot : parked);

// contentEl for the whole session; originEl = where close() puts it back.
const registration = pip.registerElements({ contentEl, originEl: home() });
home().appendChild(contentEl);

export function onRouteChange(nextSlot: HTMLElement | null): void {
  slot = nextSlot;
  // Read at close time, so re-pointing it mid-session is enough.
  registration.update({ originEl: home() });
  // While the window is open the content lives in the PiP document. Moving it now
  // would pull it out of the window, so only move it when it is in this page.
  if (contentEl.ownerDocument === document) home().appendChild(contentEl);
}

// Put the content home while the PiP document is still alive.
pip.registerTeardown(() => {
  home().appendChild(contentEl);
});

button.addEventListener('click', () => {
  pip.toggle().catch((err) => console.warn('PiP failed:', err));
});
```

Notes:

- `update()` re-points the origin in place. Releasing and re-registering also works, but briefly vacates `contentEl` too.
- If the widget can open while parked, pass `width` and `height`: parked content has no size to measure, so the window falls back to 900 × 600.
- When the whole feature goes away: `registration.release()`, `unregisterPip('tracker', pip)`, `pip.destroy()`.

## What you still have to write

- The parking container and your move policy. `Element.moveBefore()` preserves state on same-document moves but throws across documents, so fall back to `appendChild` when moving into or out of the PiP window.
- An anchor or registry abstraction, if several pages can host the widget.
- Layout-shift protection: reserving the widget's size in the new slot (`ResizeObserver`, a size handoff animation).
- Dormancy: pausing or throttling the widget while it is parked. React's binding has a four-level model for this.

Framework bindings for Vue, Svelte and Solid are on the [roadmap](https://github.com/Shakya47/pip-it-up/blob/main/README.md#roadmap).
