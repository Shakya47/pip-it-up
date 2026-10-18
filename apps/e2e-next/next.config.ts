import type { NextConfig } from 'next';

const config: NextConfig = {
  // The contract page and the contract module are TypeScript source in workspace packages.
  transpilePackages: ['@pip-it-up/e2e-react', '@pip-it-up/e2e-contract'],
  // One React for the app and @pip-it-up/react: the linked package would otherwise resolve its
  // own dev copy (React 18, packages/react/node_modules) and break hooks.
  turbopack: {
    resolveAlias: {
      react: './node_modules/react',
      'react-dom': './node_modules/react-dom',
    },
  },
};

export default config;
