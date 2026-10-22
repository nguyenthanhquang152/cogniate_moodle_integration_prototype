// Vitest config for the QA-3 task suite LA-E1-03 (K0, no Docker). Runs with the root Vitest inside a prepared clone
// of the task SHA (README.md in this folder).
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: fileURLToPath(new URL('.', import.meta.url)),
    include: ['*.test.ts'],
    // Forks, so the test process can set umask 077 for the private run folder.
    pool: 'forks',
    fileParallelism: false,
    retry: 0,
    // npm run check runs three times (clean tree, type error, failing test).
    testTimeout: 30 * 60_000,
    hookTimeout: 30 * 60_000,
  },
});
