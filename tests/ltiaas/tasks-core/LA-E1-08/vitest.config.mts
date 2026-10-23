// Vitest config for the QA-3 task suite LA-E1-08. LA_LEVEL=k0 runs the K0 extension ports, F5 channel-sql-tables rule,
// and removed core files + F1 ratchet tests in a prepared clone of the task SHA; LA_LEVEL=k1sim (or default in e2e
// container) runs capability-guards.k1sim.test.ts (AC-LA-E1-08-02), or golden.k1sim.test.ts when LA_GOLDEN_CAPTURE is set.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const level = process.env.LA_LEVEL ?? '';
const k0 = level === 'k0';
const hasGolden = Boolean(process.env.LA_GOLDEN_CAPTURE);

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
        include: hasGolden ? ['golden.k1sim.test.ts'] : ['capability-guards.k1sim.test.ts'],
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
