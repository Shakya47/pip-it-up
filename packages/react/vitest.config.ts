import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 75,
        lines: 85,
      },
      exclude: ['tests/**']
    },
  },
});
