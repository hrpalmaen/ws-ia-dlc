import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Discover tests across all packages.
    include: ['packages/**/*.{test,spec}.ts'],
    environment: 'node',
    globals: true,
  },
});
