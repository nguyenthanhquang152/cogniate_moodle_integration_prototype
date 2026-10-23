// Vitest config for the QA-3 task suite LA-E3-15. LA_LEVEL=k0 runs the no-Docker R0, K0 and UNIT-row checks in a
// prepared clone of the task SHA; LA_LEVEL=k1sim runs the K1-SIM acceptance tests (AC-LA-E3-15-03, -04) on a booked
// SIM slot. See README.md.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const k0 = process.env.LA_LEVEL === 'k0';

export default defineConfig({
  test: k0
    ? {
        root: fileURLToPath(new URL('.', import.meta.url)),
        include: ['*.k0.test.ts'],
        pool: 'forks',
        fileParallelism: false,
        retry: 0,
        testTimeout: 30 * 60_000,
        hookTimeout: 30 * 60_000,
      }
    : {
        root: fileURLToPath(new URL('.', import.meta.url)),
        include: ['*.k1sim.test.ts'],
        pool: 'forks',
        fileParallelism: false,
        retry: 0,
        testTimeout: 30 * 60_000,
        hookTimeout: 30 * 60_000,
        reporters: ['default', 'json'],
        outputFile: {
          json: fileURLToPath(new URL('../../../acceptance/artifacts/vitest-results.json', import.meta.url)),
        },
      },
});
