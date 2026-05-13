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
