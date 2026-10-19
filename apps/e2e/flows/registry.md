# Registry

What: reaching an instance from anywhere through its id (`registerPip` / `getPip` in core, `id` on `<PipWrapper>` / `usePip`): the playground's decoupled trigger, global shortcut and navigation-cleanup examples.
Code: packages/core/src/registry.ts, packages/react/src/PipWrapper.tsx, packages/react/src/usePip.ts
Spec: apps/e2e/tests/contract/usecases.spec.ts
Last run: never

## Registry

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| RG1 | Focus the page, press Alt+P (a page-level handler calling `getPip('contract-a')?.toggle()`) | The window opens with the content; status "open" | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| RG2 | Open, click inside PiP, press Alt+P there | The key is bridged to the page, whose handler closes the window; status "closed" | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |
| RG3 | Open, click "Close via registry" (`getPip(id)?.close()`, the README's navigation cleanup) | The window closes; lifecycle open, ready, close | all | docpip | pass 2026-09-29 · next-chrome next-firefox react-chrome react-firefox vanilla-chrome vanilla-firefox |

## Notes

- The decoupled `<PipTrigger pipId>` is react.md RX5; the orphan id is RX7.
- The handler matches `e.code === 'KeyP'`: on macOS, Alt+P types "π", so `e.key` isn't "p".
- RG2 closes the window from its own keypress. Playwright's `keyboard.press` can then report "Target page … closed"; `pressClosingPip` tolerates only that error.
- Alt+P and "Close via registry" deliberately use `getPip(id)?.…` (the README's documented pattern). A missing registration can't pass silently: RG1 gets no window, RG2 and RG3 leave it open.

## Corrections

<!-- Dated lines from the user's corrections. They override what the code suggests. -->
