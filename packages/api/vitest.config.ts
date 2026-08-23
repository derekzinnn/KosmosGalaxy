import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['tests/global-setup.ts'],
    setupFiles: ['tests/setup.ts'],
    /**
     * One worker, one database.
     *
     * These are integration tests against real PostgreSQL, and they truncate
     * tables between tests. Running files in parallel would have them
     * truncating each other's data mid-assertion. Per-worker schemas would buy
     * back the parallelism later; at this size it is not worth the machinery.
     */
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
