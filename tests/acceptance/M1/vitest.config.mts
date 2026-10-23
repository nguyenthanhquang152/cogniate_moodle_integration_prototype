import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BaseSequencer, type TestSpecification } from 'vitest/node';
import { defineConfig } from 'vitest/config';

class ContractOrder extends BaseSequencer {
  async sort(files: TestSpecification[]) {
    // Common bootstrap must run before any provider creates its platform.
    // Final log/secret scans run after every provider and race.
    return [...files].sort((a, b) => {
      const order = (file: string) => path.basename(file);
      return order(a.moduleId).localeCompare(order(b.moduleId)) || a.moduleId.localeCompare(b.moduleId);
    });
  }
}
const root = fileURLToPath(new URL('../..', import.meta.url));
const provider = process.env.QA_M1_PROVIDER ?? 'all';
if (!['all', 'blackboard', 'canvas'].includes(provider)) throw new Error('Unknown QA_M1_PROVIDER');
const owners = provider === 'all' ? ['common', 'blackboard', 'canvas'] : ['common', provider];
const stage = process.env.QA_M1_MIGRATION_STAGE;
const providerPattern = provider === 'all' ? '' : `(?=.*\\{case:M1-\\d{2}\\.(?:common|${provider})\\.)`;
export default defineConfig({
  test: {
    root,
    include: stage ? ['acceptance/M1/common/migration.probe.ts']
      : owners.map((owner) => `acceptance/M1/${owner}/**/*.test.ts`),
    testNamePattern: providerPattern || process.env.QA_GREP ? new RegExp(providerPattern + (process.env.QA_GREP ?? '.*')) : undefined,
    testTimeout: 240_000, hookTimeout: 60_000, fileParallelism: false,
    sequence: { sequencer: ContractOrder },
    passWithNoTests: false, reporters: ['default', 'json'],
    outputFile: { json: 'acceptance/artifacts/m1-vitest-results.json' },
  },
});
