# Contributing

Welcome to `pip-it-up`! 

## Local Development Setup

1. **Clone and Install**
   ```bash
   git clone https://github.com/your-username/pip-it-up.git
   cd pip-it-up
   pnpm install
   ```

2. **Run the Playground**
   ```bash
   pnpm dev
   ```
   This starts Vite for the examples and tsup in watch mode for the packages.

3. **Run Storybook**
   ```bash
   cd apps/storybook
   pnpm dev
   ```

## Testing

We use Vitest and Testing Library.
```bash
pnpm test
pnpm test --coverage
```

## Creating a Changeset

Before creating a Pull Request, if your changes affect the published packages, please create a changeset. This tells the release pipeline how to bump versions and what to put in the changelog.

```bash
pnpm changeset
```

Follow the interactive prompts to select the packages you changed, the type of bump (major/minor/patch), and write a summary of your changes.

## Release Process

When a PR with changesets is merged to `main`, the `Release` GitHub Action will automatically open a "Version Packages" PR.
When that PR is merged, the Action runs `pnpm changeset publish` and automatically publishes to npm using provenance.

## Workflow changes

Do not add `pull_request_target` triggers. Use `pull_request`. CI fails the build if `pull_request_target` appears in any workflow (see CI-507). If a workflow genuinely needs elevated permissions on PRs, open an issue first and add an explicit fork check: `if: github.event.pull_request.head.repo.full_name == github.repository`.

## Branch protection

Direct pushes to `main` are not allowed. All changes must go through a pull request and pass automated CI checks before merging.

### Branch Protection Rules (`main`)

1. **Require a pull request before merging**: Forces every change through review even if the maintainer's laptop is compromised.
2. **Require approvals (1)**: Enables the stale-approval dismissal rule below, which is the actual protection.
3. **Dismiss stale approvals when new commits are pushed**: **Critical** — blocks an attacker who gets a PR approved from appending a malicious commit afterwards.
4. **Require status checks to pass**: Select the `test` job; add `Analyze` once CI-503 has run once.
5. **Require branches to be up to date before merging**: Forces rebase; surfaces integration breaks pre-merge.
6. **Require conversation resolution**: Hygiene; no direct security effect.
7. **Restrict who can push**: Maintainer plus the changesets bot identity only.
8. **Do not allow bypassing the above settings**: **The key rule** — prevents an attacker with a hijacked session from disabling protection and pushing directly.

### Repository Actions Settings (`Settings → Actions → General`)

1. **Fork PR workflows from outside collaborators**: Require approval for all outside collaborators (any fork PR needs an explicit "Approve and run" click).
2. **Workflow permissions**: Read repository contents and packages (repo-level fallback: workflows that omit `permissions:` default to read-only).
3. **Allow Actions to create and approve pull requests**: Unchecked (prevents a compromised action approving its own PR).

## Commit signing

Contributors are encouraged to sign commits using GPG or SSH keys. For setup instructions, see GitHub's documentation on [Managing commit signature verification](https://docs.github.com/en/authentication/managing-commit-signature-verification).

- **Maintainer signatures**: The project maintainer signs all commits; a green "Verified" badge is visible on each commit in GitHub's commit log.
- **Why signing matters**: In Git, anyone with write access can easily spoof an author header (e.g., `--author="Shakya47 <fake@email>"`). Cryptographic signing ensures that authorship is provable rather than merely asserted.
- **Why "Require signed commits" is not enforced in branch protection**: We deliberately do not enable the "Require signed commits" branch protection rule. Requiring signatures would hard-block merges from new or casual open-source contributors who have not configured local signing keys. We encourage signing and verify commits by eye without turning signature requirements into a contributor-hostile barrier.

## Threat model

### In Scope
- XSS via library APIs
- Prototype pollution
- Supply-chain compromise (dependencies, GitHub Actions, npm publishing)
- Dependency CVEs
- Leaking DOM references or listeners across a window boundary

### Explicitly Out of Scope (Threat Model Boundaries)
The following behaviors are explicit trust boundaries and by design:
- Same-origin trust violations — the Document PiP API is same-origin by browser design; any script on the page already has full access.
- Denial of service by opening many PiP windows — the user can close the tab, and window creation is gated on user activation.
- CSS injection via consumer-supplied `pipBodyStyles` — documented trusted input ([`packages/core/src/types.ts`](./packages/core/src/types.ts)); sanitisation is the consumer's responsibility.
- Inline handlers executing in cloned content under `mode: 'clone'` — documented trust boundary ([`packages/core/src/dom-modes.ts`](./packages/core/src/dom-modes.ts)), equivalent to `innerHTML`.
- Keystroke visibility to opener listeners when `forwardKeyboardEvents` is enabled — documented with an opt-out (SEC-202).

## Security review checklist

Before submitting or approving a security-affecting pull request, verify each applicable requirement below.

Architectural invariants are detailed in [`MAINTENANCE_GUIDE.md`](./specs/MAINTENANCE_GUIDE.md). Automated checks are defined in [`PRE_PUSH_CHECKLIST.md`](./specs/PRE_PUSH_CHECKLIST.md) (notably section 6b, which enforces rules 6, 7, 10, and 11 via automated greps; rules 1–5, 8, and 9 require reviewer scrutiny and human judgement). For CI and workflow security policies, refer to the [Workflow changes](#workflow-changes) and [Branch protection](#branch-protection) sections above.

| # | Check | Reject unless |
| :--- | :--- | :--- |
| 1 | New `window.open` / `eval` / `new Function` / `innerHTML` / `insertAdjacentHTML`? | extensively justified in writing |
| 2 | New URL-accepting option? | validates the scheme **and** navigates to the parsed result, not the raw input (SEC-201) |
| 3 | New event-forwarding logic? | filters `isTrusted` (SEC-202, SEC-203) |
| 4 | Change to the registry? | preserves collision detection **and** owner-only unregistration (CORE-108) |
| 5 | New `addEventListener`? | bound to a signal **and** has an explicit disposer (DEF-401) |
| 6 | New cross-document DOM operation? | uses `appendChild`, never `adoptNode` ([`MAINTENANCE_GUIDE.md`](./specs/MAINTENANCE_GUIDE.md) §9) |
| 7 | New `moveBefore` call? | same-document guarded with an `appendChild` fallback ([`MAINTENANCE_GUIDE.md`](./specs/MAINTENANCE_GUIDE.md) §9) |
| 8 | New element parked outside the React tree? | lives in the attached garage, not a detached node ([`MAINTENANCE_GUIDE.md`](./specs/MAINTENANCE_GUIDE.md) §11) |
| 9 | New timer or animation? | cancelled on teardown **and** respects the dormancy level (REACT-307, REACT-308) |
| 10 | New numeric threshold? | lives in `constants.ts` with a written rationale (master spec §0) |
| 11 | New `flushSync`? | reject — forbidden by [`MAINTENANCE_GUIDE.md`](./specs/MAINTENANCE_GUIDE.md) §13 |



