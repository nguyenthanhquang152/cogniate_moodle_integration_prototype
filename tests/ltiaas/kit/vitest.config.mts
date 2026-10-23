// Vitest configuration for the LTI 1.3 Channel Certification Kit (LA-E7-06, K1).
// LA_LEVEL selects the mode via resolveKitLevel():
// - 'k0': host-only pass-rule, bilateral equality, TB-12 fixture source audit, and F1 kit-neutrality checks (kit.k0.test.ts)
// - 'k1sim' (or 'k1-sim', default when QA_TASK=K1 or QA_TASK=LA-E7-06): runs the 6 per-port simulator suites + K-HYG in deterministic order
// - 'all': runs both kit.k0.test.ts and the K1 simulator suites
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { BaseSequencer, type TestSpecification } from 'vitest/node';

const here = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.LA_KIT_RUN_ID) {
  process.env.LA_KIT_RUN_ID = `kit-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export type KitLevel = 'k0' | 'k1sim' | 'all';

export function resolveKitLevel(env: NodeJS.ProcessEnv = process.env): KitLevel {
  const raw = env.LA_LEVEL?.trim().toLowerCase();
  if (!raw) {
    if (
      env.QA_TASK === 'K1' ||
      env.QA_TASK === 'LA-E7-06' ||
      env.QA_KIT_RUN === '1'
    ) {
      return 'k1sim';
    }
    return 'k0';
  }
  if (raw === 'k0') {
    return 'k0';
  }
  if (raw === 'k1sim' || raw === 'k1-sim' || raw === 'k1') {
    return 'k1sim';
  }
  if (raw === 'all') {
    return 'all';
  }
  throw new Error(
    `Unsupported LA_LEVEL=${env.LA_LEVEL}; expected k0, k1sim (or k1-sim), or all`,
  );
}

const level = resolveKitLevel(process.env);

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

const includeByLevel: Record<KitLevel, string[]> = {
  k0: ['kit.k0.test.ts'],
  k1sim: [...K1_SIM_SUITE_FILES],
  all: ['kit.k0.test.ts', ...K1_SIM_SUITE_FILES],
};

const include = includeByLevel[level];

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
