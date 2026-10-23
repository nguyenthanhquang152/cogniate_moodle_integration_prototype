// Vitest config of the QA-2 suite LA-E5-22.
// - LA_LEVEL=k0 (host-only, no Docker): runs app-key-provider.k0.test.ts (AC-LA-E5-22-02..05 + BD-A2-91 UNIT/K0 checks).
// - Default (runs in the e2e container via run.mjs or tests/acceptance/run-api.mjs): runs u1.test.ts (AC-LA-E5-22-01 U1).
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const k0 = (process.env.LA_LEVEL ?? '').toLowerCase() === 'k0';

export default defineConfig({
  server: { fs: { strict: false } },
  test: k0
    ? {
        root: fileURLToPath(new URL('../../..', import.meta.url)),
        include: ['ltiaas/tasks-ops/LA-E5-22/app-key-provider.k0.test.ts'],
        testNamePattern: process.env.QA_GREP ? new RegExp(process.env.QA_GREP) : undefined,
        pool: 'forks',
        fileParallelism: false,
        retry: 0,
        passWithNoTests: false,
        testTimeout: 300_000,
        hookTimeout: 60_000,
        reporters: process.env.LA_K0_JSON ? ['default', 'json'] : ['default'],
        outputFile: process.env.LA_K0_JSON ? { json: process.env.LA_K0_JSON } : undefined,
      }
    : {
        root: fileURLToPath(new URL('../../..', import.meta.url)),
        include: ['ltiaas/tasks-ops/LA-E5-22/u1.test.ts'],
        testNamePattern: process.env.QA_GREP ? new RegExp(process.env.QA_GREP) : undefined,
        testTimeout: 300_000,
        hookTimeout: 60_000,
        fileParallelism: false,
        retry: 0,
        setupFiles: ['acceptance/setup/knob-guard.ts'],
        passWithNoTests: false,
        reporters: ['default', 'json'],
        outputFile: { json: 'acceptance/artifacts/vitest-results.json' },
      },
});
