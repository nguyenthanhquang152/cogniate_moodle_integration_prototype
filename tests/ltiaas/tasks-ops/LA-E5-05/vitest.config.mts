// Vitest config of the QA-2 suite LA-E5-05 (runs in the e2e container). QA_TASK=LA-E5-05 selects it through
// tests/acceptance/run-api.mjs. Same rules as acceptance/vitest.config.mts: knob guard, one file at a time, no
// retries, JSON report in acceptance/artifacts (the host runner reads it).
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { fs: { strict: false } },
  test: {
    root: fileURLToPath(new URL('../../..', import.meta.url)),
    include: ['ltiaas/tasks-ops/LA-E5-05/**/*.test.ts'],
    testNamePattern: process.env.QA_GREP ? new RegExp(process.env.QA_GREP) : undefined,
    testTimeout: 180_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    retry: 0,
    setupFiles: ['acceptance/setup/knob-guard.ts'],
    passWithNoTests: false,
    reporters: ['default', 'json'],
    outputFile: { json: 'acceptance/artifacts/vitest-results.json' },
  },
});
