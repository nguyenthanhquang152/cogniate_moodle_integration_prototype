// Vitest config for the QA-3 task suite LA-E7-10 (K0, no Docker). See README.md in this folder.
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
    // Each full `npm run ci:local` run takes minutes (npm ci twice, npm run check, audit, SBOM, secret scan).
    testTimeout: 30 * 60_000,
    hookTimeout: 30 * 60_000,
  },
});
