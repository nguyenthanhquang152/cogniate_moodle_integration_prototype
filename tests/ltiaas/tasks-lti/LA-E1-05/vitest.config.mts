// Vitest config for LA-E1-05 (QA-4, lane L).
// LA_LEVEL selects the suite: 'k0' (default, host-only) or 'k1sim' (inside the e2e container or with LA_GOLDEN_CAPTURE).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(process.env.QA_REPO_ROOT ?? process.env.LA_SCRATCH_CLONE ?? path.join(here, '../../../..'));

const defaultLevel = process.env.QA_TASK === 'LA-E1-05' ? 'k1sim' : 'k0';
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
  resolve: {
    alias: {
      '@cogniate/shared': path.join(repoRoot, 'packages/shared/src/index.ts'),
      '@cogniate/channel-kernel': path.join(repoRoot, 'packages/channel-kernel/src/index.ts'),
    },
  },
  test: {
    root: here,
    include,
    pool: 'forks',
    fileParallelism: false,
    retry: 0,
    testTimeout: 30 * 60_000,
    hookTimeout: 30 * 60_000,
    ...(process.env.QA_GREP ? { testNamePattern: process.env.QA_GREP } : {}),
  },
});
