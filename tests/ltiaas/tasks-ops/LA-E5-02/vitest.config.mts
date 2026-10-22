// Vitest config of the QA-2 suite LA-E5-02.
// - Default (QA_TASK=LA-E5-02 through tests/acceptance/run-api.mjs in the e2e container): runs the K1-SIM suite
//   audit.test.ts with the acceptance knob guard and JSON output in acceptance/artifacts/vitest-results.json.
// - LA_LEVEL=k0 (host-only, no Docker): runs the K0 fitness test audit.k0.test.ts (AC-LA-E5-02-10).
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const k0 = process.env.LA_LEVEL === 'k0';

export default defineConfig({
  test: k0
    ? {
        root: fileURLToPath(new URL('../../..', import.meta.url)),
        include: ['ltiaas/tasks-ops/LA-E5-02/audit.k0.test.ts'],
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
        include: ['ltiaas/tasks-ops/LA-E5-02/audit.test.ts'],
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
