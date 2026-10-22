#!/usr/bin/env node
// QA-2 host runner for LA-E5-01 (K1-SIM, SIM slot). Node built-ins only. It reuses tests/host/core.mjs (preflight,
// clone, H1 guard, in-container pass, label-scoped teardown, redaction, summary) and tests/host/host-control.mjs.
//
//   COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
//     node tests/ltiaas/tasks-ops/LA-E5-01/run.mjs --sha <integration sha> --replace-tests
//
// --replace-tests copies this tests/ folder into the clone (the SHA does not have the QA-2 suites yet).
// Steps:
// 1. Setup: npm ci, gen-env, compose name guard, `npm run stack:up` (#1, default profile), `npm run seed`, H1 check.
// 2. AC-LA-E5-01-04 (host): default profile; the last `service_started` line of lti-service has
//    operator_bind "127.0.0.1:4110".
// 3. AC-LA-E5-01-06 host part: a second `npm run seed` on the same volume exits 0; the key file is unchanged.
// 4. In-container pass QA_TASK=LA-E5-01 (`npm run test:acceptance`: acceptance profile, the suite, then the default
//    profile again). During the pass the runner answers one host action, only for this QA project:
//    qa2-operator-init = QA form (c): `docker compose exec -T lti-service npm run lti:operator -- init [--if-none |
//    --replace] --name qa`. The test gets the CLI lines with every key masked. For --replace the runner writes the
//    one new key to infra/.secrets/lti-operator-key (operability §6.4 step 2; same file mode as before).
// 5. AC-LA-E5-01-04 control: during the pass the acceptance profile logged operator_bind "0.0.0.0:4110", and after
//    the pass the default profile logged "127.0.0.1:4110" again.
// 6. One row per AC from the Vitest report; an expected id that did not run is a FAIL.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRunner } from '../../../host/core.mjs';
import { createHostControl } from '../../../host/host-control.mjs';
import { run } from '../../../host/lib.mjs';
import { initResult } from './cli-output.mjs';
import { recordRows } from './report.mjs';

const TASK = 'LA-E5-01';
const EXPECT = ['AC-LA-E5-01-01', 'AC-LA-E5-01-02', 'AC-LA-E5-01-03', 'AC-LA-E5-01-05', 'AC-LA-E5-01-06', 'AC-LA-E5-01-07',
  'AC-LA-E5-01-08', 'AC-LA-E5-01-09', 'AC-LA-E5-01-10', 'LA-E5-01-HYG'];
const DEFAULT_BIND = '127.0.0.1:4110';
const ACCEPTANCE_BIND = '0.0.0.0:4110';

const r = createRunner({ task: TASK, defaultProject: 'qa2-la-sim-r1' });
const KEY_FILE = () => path.join(r.CLONE, 'infra', '.secrets', 'lti-operator-key');
const CONTROL = () => path.join(r.CLONE, 'tests', 'acceptance', 'artifacts', 'control');
const sha256 = (file) => (fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null);
const mode = (file) => (fs.existsSync(file) ? (fs.statSync(file).mode & 0o777).toString(8).padStart(4, '0') : 'missing');

/** `service_started` lines of lti-service (infra/.logs/lti-service.jsonl), oldest first. */
function serviceStarted() {
  const file = path.join(r.CLONE, 'infra', '.logs', 'lti-service.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').flatMap((line) => {
    try {
      const e = JSON.parse(line);
      return e && e.event === 'service_started' ? [e] : [];
    } catch {
      return [];
    }
  });
}

async function setup() {
  const ci = await r.npm('root-npm-ci', ['ci', '--no-audit', '--no-fund'], { timeoutMs: 900_000 });
  const gen = await r.npm('gen-env', ['run', 'gen-env']);
  r.loadStackFiles();
  await r.composeNameGuard();
  if (r.state.abort) return false;
  const up = await r.npm('stack-up-1', ['run', 'stack:up'], { timeoutMs: 900_000 });
  const seed = up.code === 0 ? await r.npm('seed', ['run', 'seed'], { timeoutMs: 900_000 }) : null;
  r.loadStackFiles();
  const ok = ci.code === 0 && gen.code === 0 && up.code === 0 && seed?.code === 0;
  r.record('SETUP', 'npm ci, gen-env, stack:up (#1, default profile), seed', r.pass(ok), [
    `npm ci ${ci.code}, gen-env ${gen.code}, stack:up ${up.code}, seed ${seed?.code ?? 'not run'}`,
    `operator key file: ${fs.existsSync(KEY_FILE()) ? `present, mode ${mode(KEY_FILE())}` : 'MISSING'}; seed.json mode ${mode(path.join(r.CLONE, 'infra', '.secrets', 'seed.json'))}`,
  ], [ci.log, gen.log, up.log, seed?.log].filter(Boolean));
  await r.checkProject();
  if (!r.state.abort && (!r.state.urls?.lti || !r.state.ca)) r.state.abort = 'no PUBLIC_*_URL in .env or no root.crt';
  return !r.state.abort && ok;
}

async function defaultProfileBind() {
  const health = await r.healthz(r.state.urls.lti);
  const last = serviceStarted().at(-1);
  r.record('AC-LA-E5-01-04', 'default profile: the service_started line of lti-service has operator_bind "127.0.0.1:4110"',
    r.pass(health?.profile === 'default' && last?.operator_bind === DEFAULT_BIND), [
      `/healthz profile ${health?.profile ?? 'no answer'}; last service_started ts ${last?.ts ?? 'none'}, operator_bind ${JSON.stringify(last?.operator_bind ?? null)}`,
    ]);
}

async function secondSeed() {
  const before = sha256(KEY_FILE());
  const seed2 = await r.npm('seed-2', ['run', 'seed'], { timeoutMs: 900_000 });
  const after = sha256(KEY_FILE());
  r.record('AC-LA-E5-01-06', 'host part: a second npm run seed on the same volume exits 0, and infra/.secrets/lti-operator-key is unchanged',
    r.pass(seed2.code === 0 && before !== null && before === after), [
      `seed #2 exit ${seed2.code}; key file SHA-256 ${before === null ? 'missing' : before === after ? 'unchanged' : 'CHANGED'}`,
      `seed #2 output has "operator key exists": ${/operator key exists/.test(seed2.stdout + seed2.stderr)} (information)`,
    ], [seed2.log]);
}

/** QA form (c) for the in-container tests (host-init.ts). Own QA project only: STACK_ENV and the H1 guard. */
async function operatorInit(req) {
  const wanted = String(req.mode);
  if (!['plain', 'if-none', 'replace'].includes(wanted) || !/^[\w-]{1,64}$/.test(String(req.id)) || !r.state.h1Verified) return { code: 2 };
  const flags = wanted === 'if-none' ? ['--if-none'] : wanted === 'replace' ? ['--replace'] : [];
  // -T: no TTY. -e: npm makes no update check from the container (no outbound call, no extra stderr line).
  const args = ['compose', '-f', 'infra/compose.yaml', '--env-file', '.env', 'exec', '-T', '-e', 'NPM_CONFIG_UPDATE_NOTIFIER=false',
    'lti-service', 'npm', 'run', 'lti:operator', '--', 'init', ...flags, '--name', 'qa'];
  const res = await run('docker', args, { cwd: r.CLONE, env: r.STACK_ENV, timeoutMs: 120_000 });
  const { keys, ...shared } = initResult(wanted, res);
  r.redact.add(...keys); // before any evidence is written
  let keyFileWritten = false;
  if (wanted === 'replace' && res.code === 0 && keys.length === 1) {
    const file = KEY_FILE();
    const old = fs.readFileSync(file, 'utf8');
    const tmp = `${file}.qa2-tmp`;
    fs.writeFileSync(tmp, `${keys[0]}${old.endsWith('\n') ? '\n' : ''}`, { mode: 0o600, flag: 'wx' });
    fs.chmodSync(tmp, fs.statSync(file).mode & 0o777);
    fs.renameSync(tmp, file);
    keyFileWritten = true;
  }
  const out = `out-qa2-init-${req.id}.json`;
  fs.writeFileSync(path.join(CONTROL(), out), JSON.stringify({ ...shared, keyFileWritten }));
  r.saveText(path.join('host-actions', `qa2-operator-init-${wanted}-${req.id}.log`),
    `$ docker ${args.join(' ')}\nexit: ${res.code}\nduration_ms: ${res.durationMs}\nkey file written: ${keyFileWritten}\n\n--- stdout\n${res.stdout}\n--- stderr\n${res.stderr}\n`);
  return { code: 0, out };
}

function acceptanceBindControl(passStart) {
  const lines = serviceStarted();
  const during = lines.filter((e) => Date.parse(String(e.ts)) >= passStart);
  const last = lines.at(-1);
  const sawAcceptance = during.some((e) => e.operator_bind === ACCEPTANCE_BIND);
  r.record('AC-LA-E5-01-04', 'control: the acceptance profile logged operator_bind "0.0.0.0:4110"; after the pass the default profile logged "127.0.0.1:4110" again',
    r.pass(sawAcceptance && last?.operator_bind === DEFAULT_BIND), [
      `service_started lines since the pass start: ${during.map((e) => JSON.stringify(e.operator_bind ?? null)).join(', ') || 'none'}; last ${JSON.stringify(last?.operator_bind ?? null)}`,
    ]);
}

await r.main(async () => {
  const started = Date.now();
  if (!(await setup())) return;
  await defaultProfileBind();
  await secondSeed();
  const control = createHostControl(r, { 'qa2-operator-init': operatorInit });
  const stop = control.start();
  const passStart = Date.now();
  try {
    await r.containerSuite(TASK, { env: { QA_TASK: TASK } });
  } finally {
    const log = stop();
    r.record('HOSTCTL', 'Host actions asked for by the LA-E5-01 tests (whitelist: qa2-operator-init = QA form (c))', 'PASS', log.length ? log : ['none']);
  }
  r.timings.inContainerPassMs = Date.now() - passStart;
  acceptanceBindControl(passStart);
  recordRows(r, TASK, path.join(r.ART, `container-${TASK}`), EXPECT);
  r.timings.totalBeforeTeardownMs = Date.now() - started;
});
