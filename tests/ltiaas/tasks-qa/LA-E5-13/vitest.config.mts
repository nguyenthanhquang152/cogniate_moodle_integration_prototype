// Vitest config for LA-E5-13 (Lead QA: two-tenant isolation checks for the new routes).
// LA_LEVEL selects the suite: 'k0' (default, host-only) or 'k1sim' (inside the e2e container on a SIM slot).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));

const defaultLevel = process.env.QA_TASK === 'LA-E5-13' ? 'k1sim' : 'k0';
const level = (process.env.LA_LEVEL ?? defaultLevel).toLowerCase();
const includeByLevel: Record<string, string[]> = {
  k0: ['*.k0.test.ts'],
  k1sim: ['*.k1sim.test.ts'],
  all: ['*.k0.test.ts', '*.k1sim.test.ts'],
};
const include = includeByLevel[level];
if (!include) {
  throw new Error(`Unsupported LA_LEVEL=${process.env.LA_LEVEL}; expected k0, k1sim, or all`);
}

export default defineConfig({
  test: {
    root: here,
    include,
    pool: 'forks',
    fileParallelism: false,
    retry: 0,
    testTimeout: 30 * 60_000,
    hookTimeout: 30 * 60_000,
    ...(level === 'k1sim'
      ? {
          reporters: ['default', 'json'],
          outputFile: {
            json: fileURLToPath(new URL('../../../acceptance/artifacts/vitest-results.json', import.meta.url)),
          },
        }
      : {}),
    ...(process.env.QA_GREP ? { testNamePattern: process.env.QA_GREP } : {}),
  },
});
