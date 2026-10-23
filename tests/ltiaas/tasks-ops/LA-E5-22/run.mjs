#!/usr/bin/env node
// QA-2 host runner for LA-E5-22 (K1-SIM, SIM slot): the upgrade route U1 (TEST-STRATEGY §4.5) for AC-LA-E5-22-01.
// Node built-ins only. Reuses tests/host/core.mjs and tests/host/m1-control.mjs.
//
//   COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
//     node tests/ltiaas/tasks-ops/LA-E5-22/run.mjs --sha <candidate sha> --old-sha <pre-LA-E5-22 sha>
import fs from 'node:fs';
import path from 'node:path';
import { createRunner } from '../../../host/core.mjs';
import { run } from '../../../host/lib.mjs';
import { m1HostControl } from '../../../host/m1-control.mjs';
import { recordRows } from '../LA-E5-01/report.mjs';

const TASK = 'LA-E5-22';
const r = createRunner({
  task: TASK,
  defaultProject: 'qa2-la-sim-r1',
  extraOptions: { 'old-sha': { type: 'string' } },
  extraHelp: '  --old-sha <commit>           Old build of the upgrade route U1 (before LA-E5-22). Required.\n',
});
const OLD = r.opt['old-sha'];
if (!OLD || !r.opt.sha) {
  console.error('--sha <candidate> and --old-sha <old build> are both required (U1 needs two builds).');
  process.exit(2);
}
const COMPOSE = ['compose', '-f', 'infra/compose.yaml', '--env-file', '.env'];
const COPY_SKIP = /(^|[/\\])(node_modules|artifacts|test-results|playwright-report|\.tmp)([/\\]|$)/;

async function useBuild(sha, label) {
  let co = await r.exec(`git-checkout-${label}`, 'git', ['checkout', '--quiet', '--force', '--detach', sha]);
  if (co.code !== 0) {
    await r.exec(`git-fetch-${label}`, 'git', ['fetch', '--quiet', r.SOURCE, sha]);
    co = await r.exec(`git-checkout-${label}-2`, 'git', ['checkout', '--quiet', '--force', '--detach', sha]);
  }
  fs.cpSync(r.QA_TESTS_DIR, path.join(r.CLONE, 'tests'), {
    recursive: true,
    filter: (src) => !COPY_SKIP.test(path.relative(r.QA_TESTS_DIR, src)),
  });
  const head = (await run('git', ['rev-parse', 'HEAD'], { cwd: r.CLONE })).stdout.trim();
  const ci =
    co.code === 0 ? await r.npm(`root-npm-ci-${label}`, ['ci', '--no-audit', '--no-fund'], { timeoutMs: 900_000 }) : null;
  fs.rmSync(path.join(r.CLONE, 'node_modules', '.vitest-cache'), { recursive: true, force: true });
  fs.rmSync(path.join(r.CLONE, 'node_modules', '.vite'), { recursive: true, force: true });
  const ok = co.code === 0 && ci?.code === 0 && head.startsWith(sha.slice(0, 7));
  r.record(
    `U1-${label.toUpperCase()}`,
    `Clone on the ${label} build; QA tests copied from ${r.QA_TESTS_DIR}; npm ci`,
    r.pass(ok),
    [`HEAD ${head}`, `checkout ${co.code}, npm ci ${ci?.code ?? 'not run'}`],
    [co.log, ci?.log].filter(Boolean),
  );
  return ok;
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
  r.record(
    'SETUP',
    'Old build: gen-env, stack:up, seed',
    r.pass(ok),
    [`gen-env ${gen.code}, stack:up ${up.code}, seed ${seed?.code ?? 'not run'}`],
    [gen.log, up.log, seed?.log].filter(Boolean),
  );
  await r.checkProject();
  if (!r.state.abort && (!r.state.urls?.lti || !r.state.ca)) r.state.abort = 'no PUBLIC_*_URL in .env or no root.crt';
  return !r.state.abort && ok;
}

async function switchToCandidate() {
  if (!r.state.h1Verified) return false;
  const stop = await r.exec('u1-stop-services', 'docker', [...COMPOSE, 'stop', 'cogniate-app', 'lti-service'], {
    timeoutMs: 180_000,
  });
  r.record('U1-STOP', 'U1: both services stopped before the code switch', r.pass(stop.code === 0), [`exit ${stop.code}`], [
    stop.log,
  ]);
  return stop.code === 0 && (await useBuild(r.opt.sha, 'candidate'));
}

async function candidateStart() {
  const ring = path.join(r.CLONE, 'infra', '.secrets', 'app-keys', 'keyring.json');
  const env = r.state.env ?? {};
  const before = {
    ring: fs.existsSync(ring),
    master: Boolean(env.APP_MASTER_KEY),
    ringEnv: 'APP_KEYRING_FILE' in env,
    masterFileEnv: 'APP_MASTER_KEY_FILE' in env,
  };
  const up = await r.npm('stack-up-candidate', ['run', 'stack:up'], { timeoutMs: 900_000 });
  r.loadStackFiles();
  const health = await r.waitHealth(r.state.urls.app, (h) => h.status === 'ok', 120_000);
  const onlyMaster = !before.ring && before.master && !before.ringEnv && !before.masterFileEnv && !fs.existsSync(ring);
  r.record(
    'AC-LA-E5-22-01',
    'host part: the candidate build starts on the old volumes with only APP_MASTER_KEY (no app key-ring file)',
    r.pass(onlyMaster && up.code === 0 && health.ok),
    [
      `before start: app key-ring file ${before.ring ? 'PRESENT' : 'absent'}; APP_MASTER_KEY ${before.master ? 'set' : 'MISSING'}; APP_KEYRING_FILE ${before.ringEnv ? 'SET' : 'unset'}; APP_MASTER_KEY_FILE ${before.masterFileEnv ? 'SET' : 'unset'}`,
      `stack:up exit ${up.code}; app /healthz ${health.ok ? 'ok' : `not ok (${JSON.stringify(health.last)})`}; app key-ring file after start ${fs.existsSync(ring) ? 'PRESENT' : 'absent'}`,
    ],
    [up.log],
  );
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
  recordRows(r, `${TASK}-old`, path.join(r.ART, `container-${TASK}-old`), ['LA-E5-22-U1OLD']);
  t = Date.now();
  if (!(await switchToCandidate())) return;
  if (!(await candidateStart())) return;
  r.timings.switchAndStartMs = Date.now() - t;
  t = Date.now();
  const stopM1New = m1HostControl(r);
  try {
    await r.containerSuite(`${TASK}-new`, { env: { QA_TASK: TASK, QA_LA_PHASE: 'new' } });
  } finally {
    await stopM1New();
  }
  r.timings.newPassMs = Date.now() - t;
  recordRows(r, `${TASK}-new`, path.join(r.ART, `container-${TASK}-new`), ['AC-LA-E5-22-01']);
  r.timings.totalBeforeTeardownMs = Date.now() - started;
});
