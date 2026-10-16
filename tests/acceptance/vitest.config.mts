// Vitest config for QA API acceptance tests. QA_TASK (for example "T1") limits the run to one task folder.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const task = process.env.QA_TASK;

export default defineConfig({
  test: {
    root: fileURLToPath(new URL('..', import.meta.url)),
    include: [task ? `acceptance/${task}/**/*.test.ts` : 'acceptance/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    reporters: ['default', 'json'],
    outputFile: { json: 'acceptance/artifacts/vitest-results.json' },
  },
});
