// Vitest config for the QA-3 task suite LA-E1-02. LA_LEVEL=k0 runs the K0 registry and workspace checks in a
// prepared clone of the task SHA; LA_LEVEL=k1sim runs the golden compare binding (no Docker itself; it reads a
// capture made on the SIM slot). See README.md in this folder.
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
