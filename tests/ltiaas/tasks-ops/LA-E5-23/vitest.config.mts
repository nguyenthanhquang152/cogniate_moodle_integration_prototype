// Vitest config of the QA-2 suite LA-E5-23 (async store port in the LTI service).
// - LA_LEVEL=k0 (or default host run, no Docker): runs async-store.k0.test.ts
//   (AC-LA-E5-23-01, AC-LA-E5-23-02, AC-LA-E5-23-03, LA-ADR-06 D13 item 3 & D4 T0-T2 atomic audited operations, F5 rules).
// - AC-LA-E5-23-04 (R2 LTI service area: T2a, T2b, T3a, T3b, T3c and goldens G1-G4) runs via run.mjs on the SIM Docker slot.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { fs: { strict: false } },
  test: {
    root: fileURLToPath(new URL('../../..', import.meta.url)),
    include: ['ltiaas/tasks-ops/LA-E5-23/async-store.k0.test.ts'],
    testNamePattern: process.env.QA_GREP ? new RegExp(process.env.QA_GREP) : undefined,
    pool: 'forks',
    fileParallelism: false,
    retry: 0,
    passWithNoTests: false,
    testTimeout: 300_000,
    hookTimeout: 60_000,
    reporters: process.env.LA_K0_JSON ? ['default', 'json'] : ['default'],
    outputFile: process.env.LA_K0_JSON ? { json: process.env.LA_K0_JSON } : undefined,
  },
});
