// Vitest config for QA API acceptance tests. QA_TASK (for example "T1") limits the run to one task folder.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// QA_TASK: one task folder or a comma list (T2a,T2b). QA_GREP: a title pattern. H14 forwards both into e2e.
const tasks = (process.env.QA_TASK ?? '').split(',').map((t) => t.trim()).filter(Boolean);
const grep = process.env.QA_GREP;

export default defineConfig({
  test: {
    root: fileURLToPath(new URL('..', import.meta.url)),
    include: tasks.length ? tasks.map((t) => `acceptance/${t}/**/*.test.ts`) : ['acceptance/**/*.test.ts'],
    testNamePattern: grep ? new RegExp(grep) : undefined,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    setupFiles: ['acceptance/setup/knob-guard.ts'],
    reporters: ['default', 'json'],
    outputFile: { json: 'acceptance/artifacts/vitest-results.json' },
  },
});
