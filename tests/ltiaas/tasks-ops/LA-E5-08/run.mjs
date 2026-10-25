#!/usr/bin/env node
// QA-2 host runner for LA-E5-08 (K1-SIM, SIM slot): the upgrade route U1 (TEST-STRATEGY §4.5) for AC-01 and AC-02.
// Node built-ins only. It reuses tests/host/core.mjs (preflight, clone, H1 guard, in-container pass, label-scoped
// teardown, redaction, summary) and tests/host/m1-control.mjs (the m1-cli host action: app:grant for the M1 binding).
//
//   COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
//     node tests/ltiaas/tasks-ops/LA-E5-08/run.mjs --sha <candidate sha> --old-sha <old build sha>
//
// The old build is the build before the key provider (the Lead gives it; for example the LA intake SHA).
// Steps:
// 1. Clone at --sha (core), then switch the clone to --old-sha. After each checkout the runner copies this tests/
//    folder into the clone: U1 changes the product code only; the same QA tests run in both phases.
// 2. Old build: npm ci, gen-env, compose name guard, stack:up, seed, H1. In-container pass QA_TASK=LA-E5-08
//    QA_LA_PHASE=old: an M1 Blackboard-sim binding, a Deep Linking response, a launch with fixed launch values and a
//    score POST; one Moodle Dynamic Registration start (a stored registration session). State: tests/.tmp/qa2-LA-E5-08.
// 3. Switch (U1 step 2): `docker compose stop cogniate-app lti-service`; checkout --sha; QA tests again; npm ci.
//    The volumes, .env (the same LTI_MASTER_KEY) and infra/.secrets stay. gen-env does not run again.
// 4. AC-LA-E5-08-01 host part: no key-ring file, LTI_MASTER_KEY set, no LTI_KEYRING_FILE and no LTI_MASTER_KEY_FILE;
//    `npm run stack:up` exits 0 (the migrations run); /healthz answers; no key_provider_not_ready or key_open_failed line.
// 5. In-container pass QA_LA_PHASE=new: AC-01 (registration session, tool key) and AC-02 (old service key).
import fs from 'node:fs';
import path from 'node:path';
import { createRunner } from '../../../host/core.mjs';
import { run } from '../../../host/lib.mjs';
import { m1HostControl } from '../../../host/m1-control.mjs';
import { recordRows } from '../LA-E5-01/report.mjs';

const TASK = 'LA-E5-08';
const r = createRunner({
  task: TASK,
  defaultProject: 'qa2-la-sim-r1',
  extraOptions: { 'old-sha': { type: 'string' } },
  extraHelp: '  --old-sha <commit>           Old build of the upgrade route U1 (before the key provider). Required.\n',
});
const OLD = r.opt['old-sha'];
if (!OLD || !r.opt.sha) {
  console.error('--sha <candidate> and --old-sha <old build> are both required (U1 needs two builds).');
  process.exit(2);
}
const COMPOSE = ['compose', '-f', 'infra/compose.yaml', '--env-file', '.env'];
const COPY_SKIP = /(^|[/\\])(node_modules|artifacts|test-results|playwright-report|\.tmp)([/\\]|$)/;

/** U1 step 2: checkout of one build in the clone, the QA tests of this checkout on top, then npm ci. */
async function useBuild(sha, label) {
  let co = await r.exec(`git-checkout-${label}`, 'git', ['checkout', '--quiet', '--force', '--detach', sha]);
  if (co.code !== 0) {
    await r.exec(`git-fetch-${label}`, 'git', ['fetch', '--quiet', r.SOURCE, sha]);
    co = await r.exec(`git-checkout-${label}-2`, 'git', ['checkout', '--quiet', '--force', '--detach', sha]);
  }
  fs.cpSync(r.QA_TESTS_DIR, path.join(r.CLONE, 'tests'), { recursive: true, filter: (src) => !COPY_SKIP.test(path.relative(r.QA_TESTS_DIR, src)) });
  const head = (await run('git', ['rev-parse', 'HEAD'], { cwd: r.CLONE })).stdout.trim();
  const ci = co.code === 0 ? await r.npm(`root-npm-ci-${label}`, ['ci', '--no-audit', '--no-fund'], { timeoutMs: 900_000 }) : null;
  fs.rmSync(path.join(r.CLONE, 'node_modules', '.vitest-cache'), { recursive: true, force: true });
  fs.rmSync(path.join(r.CLONE, 'node_modules', '.vite'), { recursive: true, force: true });
  const ok = co.code === 0 && ci?.code === 0 && head.startsWith(sha.slice(0, 7));
  r.record(`U1-${label.toUpperCase()}`, `Clone on the ${label} build; QA tests copied from ${r.QA_TESTS_DIR}; npm ci`, r.pass(ok),
    [`HEAD ${head}`, `checkout ${co.code}, npm ci ${ci?.code ?? 'not run'}`], [co.log, ci?.log].filter(Boolean));
  return ok;
}

function keyEvents() {
  const file = path.join(r.CLONE, 'infra', '.logs', 'lti-service.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').flatMap((line) => {
    try {
      const e = JSON.parse(line);
      return e && ['key_provider_not_ready', 'key_open_failed'].includes(e.event) ? [`${e.event} ${JSON.stringify({ version: e.version, table: e.table })}`] : [];
    } catch {
      return [];
    }
  });
}

async function oldBuild() {
  if (!(await useBuild(OLD, 'old'))) return false;
  const gen = await r.npm('gen-env', ['run', 'gen-env']);
  r.loadStackFiles();
  await r.composeNameGuard();
  if (r.state.abort) return false;
  const up = await r.npm('stack-up-old', ['run', 'stack:up'], { timeoutMs: 900_000 });
  const seed = up.code === 0 ? await r.npm('seed', ['run', 'seed'], { timeoutMs: 900_000 }) : null;
  r.loadStackFiles();
  const ok = gen.code === 0 && up.code === 0 && seed?.code === 0;
  r.record('SETUP', 'Old build: gen-env, stack:up, seed', r.pass(ok), [`gen-env ${gen.code}, stack:up ${up.code}, seed ${seed?.code ?? 'not run'}`],
    [gen.log, up.log, seed?.log].filter(Boolean));
  await r.checkProject();
  if (!r.state.abort && (!r.state.urls?.lti || !r.state.ca)) r.state.abort = 'no PUBLIC_*_URL in .env or no root.crt';
  return !r.state.abort && ok;
}

async function switchToCandidate() {
  if (!r.state.h1Verified) return false;
  const stop = await r.exec('u1-stop-services', 'docker', [...COMPOSE, 'stop', 'cogniate-app', 'lti-service'], { timeoutMs: 180_000 });
  r.record('U1-STOP', 'U1: both services stopped before the code switch', r.pass(stop.code === 0), [`exit ${stop.code}`], [stop.log]);
  return stop.code === 0 && (await useBuild(r.opt.sha, 'candidate'));
}

async function candidateStart() {
  const ring = path.join(r.CLONE, 'infra', '.secrets', 'lti', 'keyring.json');
  const env = r.state.env ?? {};
  const before = { ring: fs.existsSync(ring), master: Boolean(env.LTI_MASTER_KEY), ringEnv: 'LTI_KEYRING_FILE' in env, masterFileEnv: 'LTI_MASTER_KEY_FILE' in env };
  const up = await r.npm('stack-up-candidate', ['run', 'stack:up'], { timeoutMs: 900_000 });
  r.loadStackFiles();
  const health = await r.waitHealth(r.state.urls.lti, (h) => h.status === 'ok', 120_000);
  const events = keyEvents();
  const onlyMaster = !before.ring && before.master && !before.ringEnv && !before.masterFileEnv && !fs.existsSync(ring);
  r.record('AC-LA-E5-08-01', 'host part: the candidate build starts on the old volumes with only LTI_MASTER_KEY (no key-ring file)',
    r.pass(onlyMaster && up.code === 0 && health.ok && events.length === 0), [
      `before start: key-ring file ${before.ring ? 'PRESENT' : 'absent'}; LTI_MASTER_KEY ${before.master ? 'set' : 'MISSING'}; LTI_KEYRING_FILE ${before.ringEnv ? 'SET' : 'unset'}; LTI_MASTER_KEY_FILE ${before.masterFileEnv ? 'SET' : 'unset'}`,
      `stack:up exit ${up.code}; /healthz ${health.ok ? 'ok' : `not ok (${JSON.stringify(health.last)})`}; key-ring file after start ${fs.existsSync(ring) ? 'PRESENT' : 'absent'}`,
      `key_provider_not_ready / key_open_failed lines: ${events.length ? events.join('; ') : 'none'}`,
    ], [up.log]);
  await r.checkProject();
  return up.code === 0 && health.ok && !r.state.abort;
}

await r.main(async () => {
  const started = Date.now();
  if (!(await oldBuild())) return;
  const stopM1 = m1HostControl(r);
  let t = Date.now();
  try {
    await r.containerSuite(`${TASK}-old`, { env: { QA_TASK: TASK, QA_LA_PHASE: 'old' } });
  } finally {
    await stopM1();
  }
  r.timings.oldPassMs = Date.now() - t;
  recordRows(r, `${TASK}-old`, path.join(r.ART, `container-${TASK}-old`), ['LA-E5-08-U1OLD', 'LA-E5-08-U1REG']);
  t = Date.now();
  if (!(await switchToCandidate())) return;
  if (!(await candidateStart())) return;
  r.timings.switchAndStartMs = Date.now() - t;
  t = Date.now();
  await r.containerSuite(`${TASK}-new`, { env: { QA_TASK: TASK, QA_LA_PHASE: 'new' } });
  r.timings.newPassMs = Date.now() - t;
  recordRows(r, `${TASK}-new`, path.join(r.ART, `container-${TASK}-new`), ['AC-LA-E5-08-01', 'AC-LA-E5-08-02']);
  const late = keyEvents();
  r.record('AC-LA-E5-08-01', 'end of run: no key_provider_not_ready or key_open_failed line in the lti-service log', r.pass(late.length === 0), [late.join('; ') || 'none']);
  r.timings.totalBeforeTeardownMs = Date.now() - started;
});
