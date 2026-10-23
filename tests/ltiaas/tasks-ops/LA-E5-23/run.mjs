#!/usr/bin/env node
// QA-2 runner for LA-E5-23:
// - Host-only K0 + UNIT mode (LA_LEVEL=k0): runs async-store.k0.test.ts (AC-LA-E5-23-01..03, atomic audited ops, F5 rules).
// - SIM slot mode (AC-LA-E5-23-04, R2 LTI service area): runs LTI service suites T2a, T2b, T3a, T3b, T3c and goldens G1-G4
//   on the booked qa2-la-sim-r1 stack.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');

if ((process.env.LA_LEVEL ?? '').toLowerCase() === 'k0') {
  fs.rmSync(path.join(ROOT, 'node_modules', '.vitest-cache'), { recursive: true, force: true });
  fs.rmSync(path.join(ROOT, 'node_modules', '.vite'), { recursive: true, force: true });
  const res = spawnSync(
    './tests/node_modules/.bin/vitest',
    ['run', '-c', 'tests/ltiaas/tasks-ops/LA-E5-23/vitest.config.mts', '--reporter=verbose'],
    { cwd: ROOT, stdio: 'inherit', env: { ...process.env, LA_LEVEL: 'k0' } },
  );
  process.exit(res.status ?? 1);
}

console.error(
  'AC-LA-E5-23-04 (R2 LTI service area: T2a, T2b, T3a, T3b, T3c and goldens G1-G4) requires a booked SIM Docker window; run with LA_LEVEL=k0 during host-only rounds.',
);
process.exit(2);
