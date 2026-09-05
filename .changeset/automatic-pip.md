---
"@pip-it-up/core": minor
"@pip-it-up/react": minor
---

Automatic Picture-in-Picture on tab switch.

**@pip-it-up/core**

- `createAutoPip(enter, options?)` — enters PiP when the document becomes hidden. Framework-agnostic,
  returns a disposer, and drives either native Video PiP or Document PiP since the caller supplies
  `enter`. Options: `when`, `onResult`, `mediaSession`, `signal`. Tree-shakes to 487 B gzipped.
- `registerEnterPipAction(enter)` — registers the `enterpictureinpicture` Media Session action, the
  page-side opt-in that lets Chrome trigger PiP itself with no user gesture on eligible origins.
- New types: `AutoPipOptions`, `AutoPipResult`.

**@pip-it-up/react**

- `useAutoPip(enter, options?)` — the same behaviour as a hook, always on unless `enabled: false`.
  `enter` is read through a ref, so passing a fresh inline arrow each render never detaches the
  listener.

`onResult` reports whether an attempt was paid for by a live user gesture (`grantedBy: 'gesture'`),
granted by the browser (`grantedBy: 'browser'`), or rejected — and for a rejection, whether an
activation was live (`hadActivation`), which separates the expected "nothing recent authorised it"
case from a real failure. Both READMEs document the transient-activation rules that govern this:
activation is time-based and survives across tasks, but a successful call consumes it, so there is
one attempt per gesture.

Both READMEs also document what happens when two components enable auto-PiP at once: a single tab
switch carries one transient activation, so exactly one wins and the other is rejected with
`NotAllowedError`. The two trigger paths order themselves in opposite directions — `visibilitychange`
fires every listener so the *first* registered wins, while `enterpictureinpicture` has one global
handler slot so the *last* registered wins — which makes the outcome depend on JSX order. The docs
show arbitrating explicitly through `when` instead.

Also documents the correct fix for editors that cache a document reference (TipTap/ProseMirror's
`EditorView.root`): call the library's own invalidation — `editor.view.updateRoot()` keyed on
`state.pipWindow` — rather than remounting the component via a `key`, which discards the undo
history this library exists to preserve.
