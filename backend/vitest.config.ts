import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Prevent watch mode from running indefinitely
    watch: false,
    // Set test timeout to prevent hanging tests
    testTimeout: 30000, // 30 seconds
    // Limit concurrent test execution to prevent memory issues
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4, // Limit to 4 threads max
        minThreads: 1,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.config.ts',
      ],
    },
  },
});
