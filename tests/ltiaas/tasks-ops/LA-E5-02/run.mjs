#!/usr/bin/env node
// QA-2 host runner for LA-E5-02 (K0 + K1-SIM, SIM slot). Node built-ins only.
// Reuses tests/host/core.mjs and tests/ltiaas/tasks-ops/LA-E5-01/report.mjs.
//
//   COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
//     node tests/ltiaas/tasks-ops/LA-E5-02/run.mjs --sha <integration sha> --replace-tests
//
// Steps:
// 1. Setup: npm ci, then K0 fitness check (AC-LA-E5-02-10: F5 rule against DELETE FROM audit_event outside the
//    audit-retention job), then gen-env, compose name guard, stack:up, seed, H1 check.
// 2. In-container pass QA_TASK=LA-E5-02 (`npm run test:acceptance`): AC-LA-E5-02-01..06 and AC-LA-E5-02-09.
// 3. One row per AC from the K0 and K1-SIM Vitest reports; an expected id that did not run is a FAIL.
import fs from 'node:fs';
import path from 'node:path';
import { createRunner } from '../../../host/core.mjs';
import { recordRows } from '../LA-E5-01/report.mjs';

const TASK = 'LA-E5-02';
const EXPECT_K0 = ['AC-LA-E5-02-10'];
const EXPECT_SIM = [
  'AC-LA-E5-02-01',
  'AC-LA-E5-02-02',
  'AC-LA-E5-02-03',
  'AC-LA-E5-02-04',
  'AC-LA-E5-02-05',
  'AC-LA-E5-02-06',
  'AC-LA-E5-02-09',
];

const r = createRunner({ task: TASK, defaultProject: 'qa2-la-sim-r1' });

async function runK0() {
  const dir = path.join(r.ART, `k0-${TASK}`);
  fs.mkdirSync(dir, { recursive: true });
  const jsonFile = path.join(dir, 'vitest-results.json');
  const res = await r.npm(
    'k0-f5-audit',
    ['exec', '--', 'vitest', 'run', '--config', 'tests/ltiaas/tasks-ops/LA-E5-02/vitest.config.mts'],
    {
      env: { ...r.STACK_ENV, LA_LEVEL: 'k0', LA_RUN_DIR: dir, LA_K0_JSON: jsonFile },
      timeoutMs: 180_000,
    },
  );
  recordRows(r, `${TASK}-k0`, dir, EXPECT_K0);
  return res.code === 0;
}

async function setup() {
  const ci = await r.npm('root-npm-ci', ['ci', '--no-audit', '--no-fund'], { timeoutMs: 900_000 });
  if (ci.code !== 0) {
    r.record('SETUP', 'npm ci', 'FAIL', [`npm ci ${ci.code}`], [ci.log]);
    return false;
  }
  await runK0();
  const gen = await r.npm('gen-env', ['run', 'gen-env']);
  r.loadStackFiles();
  await r.composeNameGuard();
  if (r.state.abort) return false;
  const up = await r.npm('stack-up', ['run', 'stack:up'], { timeoutMs: 900_000 });
  const seed = up.code === 0 ? await r.npm('seed', ['run', 'seed'], { timeoutMs: 900_000 }) : null;
  r.loadStackFiles();
  const ok = gen.code === 0 && up.code === 0 && seed?.code === 0;
  r.record(
    'SETUP',
    'npm ci, gen-env, stack:up, seed',
    r.pass(ok),
    [`npm ci ${ci.code}, gen-env ${gen.code}, stack:up ${up.code}, seed ${seed?.code ?? 'not run'}`],
    [ci.log, gen.log, up.log, seed?.log].filter(Boolean),
  );
  await r.checkProject();
  if (!r.state.abort && (!r.state.urls?.lti || !r.state.ca)) r.state.abort = 'no PUBLIC_*_URL in .env or no root.crt';
  return !r.state.abort && ok;
}

await r.main(async () => {
  const started = Date.now();
  if (!(await setup())) return;
  const passStart = Date.now();
  await r.containerSuite(TASK, { env: { QA_TASK: TASK } });
  r.timings.inContainerPassMs = Date.now() - passStart;
  recordRows(r, TASK, path.join(r.ART, `container-${TASK}`), EXPECT_SIM);
  r.timings.totalBeforeTeardownMs = Date.now() - started;
});
