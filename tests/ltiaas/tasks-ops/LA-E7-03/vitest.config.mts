// Vitest config of the QA-2 suite LA-E7-03.
// - Default (runs in the e2e container via run.mjs or tests/acceptance/run-api.mjs): runs hosts-manifest.test.ts.
// - LA_LEVEL=k0 (host-only, no Docker): runs hosts-manifest.k0.test.ts (AC-LA-E7-03-04).
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const k0 = (process.env.LA_LEVEL ?? '').toLowerCase() === 'k0';

export default defineConfig({
  server: { fs: { strict: false } },
  test: k0
    ? {
        root: fileURLToPath(new URL('../../..', import.meta.url)),
        include: ['ltiaas/tasks-ops/LA-E7-03/hosts-manifest.k0.test.ts'],
        testNamePattern: process.env.QA_GREP ? new RegExp(process.env.QA_GREP) : undefined,
        pool: 'forks',
        fileParallelism: false,
        retry: 0,
        passWithNoTests: false,
        testTimeout: 120_000,
        hookTimeout: 60_000,
        reporters: process.env.LA_K0_JSON ? ['default', 'json'] : ['default'],
        outputFile: process.env.LA_K0_JSON ? { json: process.env.LA_K0_JSON } : undefined,
      }
    : {
        root: fileURLToPath(new URL('../../..', import.meta.url)),
        include: ['ltiaas/tasks-ops/LA-E7-03/hosts-manifest.test.ts'],
        testNamePattern: process.env.QA_GREP ? new RegExp(process.env.QA_GREP) : undefined,
        testTimeout: 120_000,
        hookTimeout: 60_000,
        fileParallelism: false,
        retry: 0,
        setupFiles: ['acceptance/setup/knob-guard.ts'],
        passWithNoTests: false,
        reporters: ['default', 'json'],
        outputFile: { json: 'acceptance/artifacts/vitest-results.json' },
      },
});
