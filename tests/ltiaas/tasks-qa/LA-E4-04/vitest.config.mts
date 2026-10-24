// Vitest config for LA-E4-04 (QA-3: Progress record emission — no outbound dispatch).
// Runs inside the e2e container on a SIM slot (LA_LEVEL=k1sim).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    root: here,
    include: ['*.k1sim.test.ts'],
    pool: 'forks',
    fileParallelism: false,
    retry: 0,
    testTimeout: 10 * 60_000,
    hookTimeout: 10 * 60_000,
    reporters: ['default', 'json'],
    outputFile: {
      json: fileURLToPath(new URL('../../../acceptance/artifacts/vitest-results.json', import.meta.url)),
    },
    ...(process.env.QA_GREP ? { testNamePattern: process.env.QA_GREP } : {}),
  },
});
