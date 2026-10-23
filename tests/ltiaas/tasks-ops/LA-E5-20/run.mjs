#!/usr/bin/env node
// QA-2 host runner for LA-E5-20 (K1-SIM, SIM slot): Should jobs and the jobs endpoints.
// Reuses tests/host/core.mjs and tests/ltiaas/tasks-ops/LA-E5-01/report.mjs.
//
//   COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
//     node tests/ltiaas/tasks-ops/LA-E5-20/run.mjs --sha <integration sha> --replace-tests
//
// Steps:
// 1. Setup: npm ci, gen-env, compose name guard, stack:up, seed, H1 check.
// 2. In-container pass QA_TASK=LA-E5-20 (`npm run test:acceptance`): AC-LA-E5-20-01, AC-LA-E5-20-02.
// 3. One row per AC from the Vitest report; an expected id that did not run is a FAIL.
import path from 'node:path';
import { createRunner } from '../../../host/core.mjs';
import { recordRows } from '../LA-E5-01/report.mjs';

const TASK = 'LA-E5-20';
const EXPECT = [
  'AC-LA-E5-20-01',
  'AC-LA-E5-20-02',
];

const r = createRunner({ task: TASK, defaultProject: 'qa2-la-sim-r1' });

async function setup() {
  const ci = await r.npm('root-npm-ci', ['ci', '--no-audit', '--no-fund'], { timeoutMs: 900_000 });
  const gen = await r.npm('gen-env', ['run', 'gen-env']);
  r.loadStackFiles();
  await r.composeNameGuard();
  if (r.state.abort) return false;
  const up = await r.npm('stack-up', ['run', 'stack:up'], { timeoutMs: 900_000 });
  const seed = up.code === 0 ? await r.npm('seed', ['run', 'seed'], { timeoutMs: 900_000 }) : null;
  r.loadStackFiles();
  const ok = ci.code === 0 && gen.code === 0 && up.code === 0 && seed?.code === 0;
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
  recordRows(r, TASK, path.join(r.ART, `container-${TASK}`), EXPECT);
  r.timings.totalBeforeTeardownMs = Date.now() - started;
});
