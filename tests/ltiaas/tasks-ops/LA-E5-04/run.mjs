#!/usr/bin/env node
// QA-2 host runner for LA-E5-04 (K1-SIM, SIM slot). Node built-ins only.
// Reuses tests/host/core.mjs, tests/host/host-control.mjs and tests/ltiaas/tasks-ops/LA-E5-01/report.mjs.
//
//   COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
//     node tests/ltiaas/tasks-ops/LA-E5-04/run.mjs --sha <integration sha> --replace-tests
//
// Steps:
// 1. Setup: npm ci, gen-env, compose name guard, stack:up, seed, H1 check.
// 2. In-container pass QA_TASK=LA-E5-04 (`npm run test:acceptance`). During the pass the runner answers one host
//    action for this QA project only: `qa2-lti-bootstrap` = QA form (d) (`npm run lti:bootstrap -w services/lti-service
//    -- --account <id> --name <n> [--rotate-api-key]`). Any printed `ltis_` key is registered in `r.redact` before logs
//    or control files are written, and `infra/.secrets/lti-api-key.<id>` gets the mode of `seed.json` so the e2e
//    container can read it through its read-only mount.
// 3. One row per AC from the Vitest report; an expected id that did not run is a FAIL.
import fs from 'node:fs';
import path from 'node:path';
import { createRunner } from '../../../host/core.mjs';
import { createHostControl } from '../../../host/host-control.mjs';
import { run } from '../../../host/lib.mjs';
import { recordRows } from '../LA-E5-01/report.mjs';

const TASK = 'LA-E5-04';
const EXPECT = [
  'AC-LA-E5-04-01',
  'AC-LA-E5-04-02',
  'AC-LA-E5-04-03',
  'AC-LA-E5-04-04',
  'AC-LA-E5-04-05',
  'AC-LA-E5-04-06',
  'AC-LA-E5-04-07',
  'AC-LA-E5-04-08',
  'AC-LA-E5-04-09',
];
const KEY_RE = /ltis_[A-Za-z0-9_-]{43}/g;

const r = createRunner({ task: TASK, defaultProject: 'qa2-la-sim-r1' });
const CONTROL = () => path.join(r.CLONE, 'tests', 'acceptance', 'artifacts', 'control');
const SECRETS = () => path.join(r.CLONE, 'infra', '.secrets');

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

/** QA form (d) for AC-LA-E5-04-08 (and fresh-account key provisioning in B1 before LA-E5-07). */
async function ltiBootstrapAction(req) {
  const account = String(req.account ?? '');
  const name = String(req.name ?? `QA2 ${account}`);
  const rotate = Boolean(req.rotateApiKey);
  if (
    !/^qa2-[a-z0-9-]{1,48}$/.test(account) ||
    account === 'cogniate' ||
    account === 'qa-second' ||
    !/^[\w-]{1,64}$/.test(String(req.id)) ||
    !r.state.h1Verified
  ) {
    return { code: 2 };
  }
  const args = [
    'run',
    'lti:bootstrap',
    '-w',
    'services/lti-service',
    '--',
    '--account',
    account,
    '--name',
    name,
    ...(rotate ? ['--rotate-api-key'] : []),
  ];
  const res = await run('npm', args, { cwd: r.CLONE, env: r.STACK_ENV, timeoutMs: 120_000 });
  const keyFile = path.join(SECRETS(), `lti-api-key.${account}`);
  const printedKeys = [...new Set(`${res.stdout}\n${res.stderr}`.match(KEY_RE) ?? [])];
  if (fs.existsSync(keyFile)) {
    const fileKey = fs.readFileSync(keyFile, 'utf8').trim();
    if (fileKey) printedKeys.push(fileKey);
    const seedFile = path.join(SECRETS(), 'seed.json');
    if (fs.existsSync(seedFile)) {
      fs.chmodSync(keyFile, fs.statSync(seedFile).mode & 0o777);
    }
  }
  r.redact.add(...printedKeys);
  const keyFileWritten = fs.existsSync(keyFile) && fs.statSync(keyFile).size > 0;
  const out = `out-qa2-bootstrap-${req.id}.json`;
  fs.writeFileSync(
    path.join(CONTROL(), out),
    JSON.stringify({ account, cliCode: res.code, keyCount: new Set(printedKeys).size, keyFileWritten }),
  );
  r.saveText(
    path.join('host-actions', `qa2-lti-bootstrap-${account}-${req.id}.log`),
    `$ npm ${args.join(' ')}\nexit: ${res.code}\nduration_ms: ${res.durationMs}\nkey file written: ${keyFileWritten}\n\n--- stdout\n${res.stdout}\n--- stderr\n${res.stderr}\n`,
  );
  return { code: 0, out };
}

await r.main(async () => {
  const started = Date.now();
  if (!(await setup())) return;
  const control = createHostControl(r, { 'qa2-lti-bootstrap': ltiBootstrapAction });
  const stop = control.start();
  const passStart = Date.now();
  try {
    await r.containerSuite(TASK, { env: { QA_TASK: TASK } });
  } finally {
    const log = stop();
    r.record(
      'HOSTCTL',
      'Host actions asked for by the LA-E5-04 tests (whitelist: qa2-lti-bootstrap = QA form (d))',
      'PASS',
      log.length ? log : ['none'],
    );
  }
  r.timings.inContainerPassMs = Date.now() - passStart;
  recordRows(r, TASK, path.join(r.ART, `container-${TASK}`), EXPECT);
  r.timings.totalBeforeTeardownMs = Date.now() - started;
});
