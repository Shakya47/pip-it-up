# Packaging

What: MANUAL_SMOKE part C. The packed tarballs of @pip-it-up/core and @pip-it-up/react are installable: no `workspace:` protocol ships, and the entry points exist.
Code: packages/core/package.json, packages/react/package.json, .github/workflows/release.yml (changeset publish)
Spec: apps/e2e/tests/packaging.spec.ts (project `packaging`, no browser); PK5: apps/e2e/tests/tarball.spec.ts (project `tarball`, only with `E2E_TARBALL=1`)
Last run: 2026-09-27 · matrix (chrome, firefox, webkit; msedge is CI-only)

## Tarballs

| ID | Scenario | Expect | Targets | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| PK1 | `pnpm pack` @pip-it-up/core | The packed package.json contains no `workspace:` | none | any | pass 2026-09-29 · packaging |
| PK2 | Same tarball | `main`, `module` and `types` point at files inside it | none | any | pass 2026-09-29 · packaging |
| PK3 | `pnpm pack` @pip-it-up/react | No `workspace:` (its `@pip-it-up/core` dependency is rewritten to a version) | none | any | pass 2026-09-29 · packaging |
| PK4 | Same tarball | `main`, `module` and `types` point at files inside it | none | any | pass 2026-09-29 · packaging |
| PK5 | `npm install` the packed tarballs (+ react, react-dom, vite) into a temp app outside the workspace, `vite build`, serve it, pop out a PipWrapper | A real PiP window opens, state kept, no errors: the published shape works for a consumer | none | docpip | pass 2026-09-28 · tarball |

## Notes

- `pnpm pack`, never `npm pack`: pnpm rewrites `workspace:*` like `changeset publish` does; `npm pack` leaves it and would always fail (MANUAL_SMOKE C).
- Needs built packages: root `pnpm e2e` builds them first (turbo, cached), and so does a local run of the config (`E2E_SKIP_BUILD=1` opts out). Tarballs go to a temp folder and are deleted.

## Corrections

<!-- Dated lines from the user's corrections. They override what the code suggests. -->
