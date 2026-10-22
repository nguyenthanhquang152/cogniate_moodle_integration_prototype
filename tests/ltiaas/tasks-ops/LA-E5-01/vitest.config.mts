// Vitest config of the QA-2 suite LA-E5-01 (runs in the e2e container). QA_TASK=LA-E5-01 selects it through
// tests/acceptance/run-api.mjs (Lead decision on QA-2 request R2). Same rules as acceptance/vitest.config.mts:
// knob guard, one file at a time, no retries, JSON report in acceptance/artifacts (the host runner reads it).
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: fileURLToPath(new URL('../../..', import.meta.url)),
    include: ['ltiaas/tasks-ops/LA-E5-01/**/*.test.ts'],
    testNamePattern: process.env.QA_GREP ? new RegExp(process.env.QA_GREP) : undefined,
    // AC-05..-07 wait for one host action each (up to 180 s).
    testTimeout: 240_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    retry: 0,
    setupFiles: ['acceptance/setup/knob-guard.ts'],
    passWithNoTests: false,
    reporters: ['default', 'json'],
    outputFile: { json: 'acceptance/artifacts/vitest-results.json' },
  },
});
