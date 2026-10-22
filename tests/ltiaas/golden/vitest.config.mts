// Vitest config of the golden capture (LA-E0-03). Run in the e2e container by tests/ltiaas/golden/run-golden.mjs:
//   cd tests && node node_modules/vitest/vitest.mjs run --config ltiaas/golden/vitest.config.mts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: fileURLToPath(new URL('../..', import.meta.url)),
    include: ['ltiaas/golden/capture.golden.ts'],
    testTimeout: 900_000, hookTimeout: 60_000, fileParallelism: false, passWithNoTests: false, retry: 0,
    reporters: ['default', 'json'], outputFile: { json: 'acceptance/artifacts/golden-vitest-results.json' },
  },
});
