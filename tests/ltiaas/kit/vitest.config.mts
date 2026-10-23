// Vitest configuration for the LTI 1.3 Channel Certification Kit (LA-E7-06, K1).
// LA_LEVEL selects the mode:
// - 'k0': host-only pass-rule, bilateral equality, TB-12 fixture source audit, and F1 kit-neutrality checks (kit.k0.test.ts)
// - 'k1sim' (default when QA_TASK=K1 or QA_TASK=LA-E7-06): runs the 6 per-port simulator suites + K-HYG in order.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(
  process.env.LA_TARGET_ROOT ??
    process.env.QA_REPO_ROOT ??
    process.env.LA_SCRATCH_CLONE ??
    path.join(here, '../../..'),
);

const defaultLevel =
  process.env.QA_TASK === 'K1' || process.env.QA_TASK === 'LA-E7-06' ? 'k1sim' : 'k0';
const level = (process.env.LA_LEVEL ?? defaultLevel).toLowerCase();

const K1_SIM_SUITES = [
  'suites/k1-launch.k1sim.test.ts',
  'suites/k1-dl.k1sim.test.ts',
  'suites/k1-ags.k1sim.test.ts',
  'suites/k1-nrps.k1sim.test.ts',
  'suites/k1-reg.k1sim.test.ts',
  'suites/k1-cap.k1sim.test.ts',
  'suites/k-hyg.k1sim.test.ts',
];

const includeByLevel: Record<string, string[]> = {
  k0: ['kit.k0.test.ts'],
  k1sim: K1_SIM_SUITES,
  all: ['kit.k0.test.ts', ...K1_SIM_SUITES],
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
    sequence: {
      sequencer: undefined,
    },
    retry: 0,
    testTimeout: 30 * 60_000,
    hookTimeout: 30 * 60_000,
    ...(process.env.QA_GREP ? { testNamePattern: process.env.QA_GREP } : {}),
  },
});
