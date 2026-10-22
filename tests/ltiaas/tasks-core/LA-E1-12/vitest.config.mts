// Vitest config for the QA-3 task suite LA-E1-12. LA_LEVEL=k0 runs all five K0 acceptance checks (AC-01..AC-05) for
// the F1 ratchet at zero, fitness-scope.json final exception list, F4 canary channel K0 run, F3/F5 clean tree check,
// and F2 report mode against the E1-done SHA. See README.md in this folder.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const level = process.env.LA_LEVEL ?? '';
const include = level === 'k0' ? ['*.k0.test.ts'] : ['*.test.ts'];

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
