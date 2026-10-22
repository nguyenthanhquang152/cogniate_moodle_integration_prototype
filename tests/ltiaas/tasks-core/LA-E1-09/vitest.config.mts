// Vitest config for the QA-3 task suite LA-E1-09. LA_LEVEL=k0 runs the K0 F1 zero-hit check on tool pages, content
// host, portal, api-errors, reject-info, tracking and player files, plus the embedded-session-help rename check;
// LA_LEVEL=k1sim runs the G4 golden compare (no Docker itself; it reads a capture made on the SIM slot). See README.md.
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
