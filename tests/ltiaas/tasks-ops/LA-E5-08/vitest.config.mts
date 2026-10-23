// Vitest config of the QA-2 suite LA-E5-08 (runs in the e2e container). QA_TASK=LA-E5-08 selects it through
// tests/acceptance/run-api.mjs (Lead decision on QA-2 request R2). Same rules as acceptance/vitest.config.mts:
// knob guard, one file at a time, no retries, JSON report in acceptance/artifacts (the host runner reads it).
// QA_LA_PHASE (old or new) selects the U1 phase (run.mjs sets it).
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { fs: { strict: false } },
  test: {
    root: fileURLToPath(new URL('../../..', import.meta.url)),
    include: ['ltiaas/tasks-ops/LA-E5-08/**/*.test.ts'],
    testNamePattern: process.env.QA_GREP ? new RegExp(process.env.QA_GREP) : undefined,
    // The M1 flows (grant, publication, launch, score sync) take up to a few minutes per test.
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
