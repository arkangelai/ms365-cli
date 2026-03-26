import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Default: fast timeouts for unit tests
    testTimeout: 5000,
    hookTimeout: 5000,
  },
});
