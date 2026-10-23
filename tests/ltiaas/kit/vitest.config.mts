// Vitest configuration for the LTI 1.3 Channel Certification Kit (LA-E7-06, K1).
// LA_LEVEL selects the mode:
// - 'k0': host-only pass-rule, bilateral equality, TB-12 fixture source audit, and F1 kit-neutrality checks (kit.k0.test.ts)
// - 'k1sim' (default when QA_TASK=K1 or QA_TASK=LA-E7-06): runs the 6 per-port simulator suites + K-HYG in deterministic order.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { BaseSequencer, type TestSpecification } from 'vitest/node';

const here = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.LA_KIT_RUN_ID) {
  process.env.LA_KIT_RUN_ID = `kit-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const defaultLevel =
  process.env.QA_TASK === 'K1' || process.env.QA_TASK === 'LA-E7-06' ? 'k1sim' : 'k0';
const level = (process.env.LA_LEVEL ?? defaultLevel).toLowerCase();

const K1_SIM_SUITE_FILES = [
  'suites/k1-reg.k1sim.test.ts',
  'suites/k1-cap.k1sim.test.ts',
  'suites/k1-launch.k1sim.test.ts',
  'suites/k1-dl.k1sim.test.ts',
  'suites/k1-ags.k1sim.test.ts',
  'suites/k1-nrps.k1sim.test.ts',
  'suites/k-hyg.k1sim.test.ts',
] as const;

function getKitSuiteOrderIndex(filePath: string): number {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.endsWith('kit.k0.test.ts')) {
    return -1;
  }
  const idx = K1_SIM_SUITE_FILES.findIndex((rel) => normalized.endsWith(rel));
  return idx === -1 ? K1_SIM_SUITE_FILES.length : idx;
}

export class KitSuiteSequencer extends BaseSequencer {
  override async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    return [...files].sort((a, b) => {
      const idxA = getKitSuiteOrderIndex(a.moduleId);
      const idxB = getKitSuiteOrderIndex(b.moduleId);
      if (idxA !== idxB) {
        return idxA - idxB;
      }
      return a.moduleId.localeCompare(b.moduleId);
    });
  }
}

const includeByLevel: Record<string, string[]> = {
  k0: ['kit.k0.test.ts'],
  k1sim: [...K1_SIM_SUITE_FILES],
  all: ['kit.k0.test.ts', ...K1_SIM_SUITE_FILES],
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
      sequencer: KitSuiteSequencer,
    },
    retry: 0,
    testTimeout: 30 * 60_000,
    hookTimeout: 30 * 60_000,
    ...(process.env.QA_GREP ? { testNamePattern: process.env.QA_GREP } : {}),
  },
});
