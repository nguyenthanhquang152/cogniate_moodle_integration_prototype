// Vitest config for the QA-3 task suite LA-E2-03. LA_LEVEL=k0 runs the no-Docker K0 and UNIT-row checks in a prepared
// clone of the task SHA; LA_LEVEL=k1sim runs the K1-SIM acceptance tests (AC-LA-E2-03-03, -04, -05, -07) on a booked
// SIM slot. See README.md.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const level = process.env.LA_LEVEL ?? '';
const include = level === 'k0' ? ['*.k0.test.ts'] : level === 'k1sim' ? ['*.k1sim.test.ts'] : ['*.test.ts'];

export default defineConfig({
  test: {
    root: fileURLToPath(new URL('.', import.meta.url)),
    include,
    // Forks, so the test process can set umask 077 for the private run folder.
    pool: 'forks',
    fileParallelism: false,
    retry: 0,
    testTimeout: 30 * 60_000,
    hookTimeout: 30 * 60_000,
  },
});
