#!/usr/bin/env node
// QA-3 Slot 4 Batch 2 shared-stack runner (qa3-la-sim-r3, PUBLIC_PORT=9453, STACK_SUBNET=172.21.0.0/16).
// Brings up and seeds qa3-la-sim-r3 ONCE, runs the service-restart/stop K1-SIM suites sequentially:
// 1. LA-E4-03 (AC-LA-E4-03-02, -03, -04, -05)
// 2. LA-E4-07 (AC-LA-E4-07-02, -03, -04, -05, -06; AC-05 = 200 with lti-service stopped)
// and tears down qa3-la-sim-r3 cleanly in finally.
import fs from 'node:fs';
import path from 'node:path';
import { createRunner } from '../../host/core.mjs';
import { createHostControl } from '../../host/host-control.mjs';
import { run } from '../../host/lib.mjs';
import { recordRows } from '../tasks-ops/LA-E5-01/report.mjs';

const BATCH2_TASKS = [
  {
    task: 'LA-E1-08',
    expect: ['AC-LA-E1-08-02'],
  },
  {
    task: 'LA-E2-05',
    expect: [
      'AC-LA-E2-05-04',
      'AC-LA-E2-05-05',
      'AC-LA-E2-05-06',
      'AC-LA-E2-05-10',
    ],
  },
  {
    task: 'LA-E4-07',
    expect: [
      'AC-LA-E4-07-02',
      'AC-LA-E4-07-03',
      'AC-LA-E4-07-04',
      'AC-LA-E4-07-05',
      'AC-LA-E4-07-06',
    ],
  },
  {
    task: 'LA-E4-03',
    expect: [
      'AC-LA-E4-03-02',
      'AC-LA-E4-03-03',
      'AC-LA-E4-03-04',
      'AC-LA-E4-03-05',
    ],
  },
];

const ALLOWED_SCRIPTS = new Set(['app:grant', 'app:binding', 'lti:shared-platform']);

const r = createRunner({ task: 'LA-QA3-BATCH-2', defaultProject: 'qa3-la-sim-r3' });
const CONTROL = () => path.join(r.CLONE, 'tests', 'acceptance', 'artifacts', 'control');

function sanitizeArgs(rawArgs) {
  if (!Array.isArray(rawArgs) || rawArgs.length > 40) return null;
  for (const arg of rawArgs) {
    if (typeof arg !== 'string' || arg.includes('\0') || arg.length > 512) return null;
  }
  return rawArgs;
}

async function handleM1Cli(req) {
  if (!/^[\w-]{1,64}$/.test(String(req.id)) || !r.state.h1Verified) return { code: 2 };
  const script = String(req.script ?? '');
  if (!ALLOWED_SCRIPTS.has(script)) return { code: 2 };
  const args = sanitizeArgs(req.args);
  if (args === null) return { code: 2 };

  const service = script.startsWith('lti:') ? 'lti-service' : 'cogniate-app';
  const composeArgs = [
    'compose',
    '-f',
    'infra/compose.yaml',
    '--env-file',
    '.env',
    'exec',
    '-T',
    '--workdir',
    '/repo',
    '-e',
    'NPM_CONFIG_UPDATE_NOTIFIER=false',
    service,
    'npm',
    'run',
    script,
    '-w',
    `services/${service}`,
    '--',
    ...args,
  ];
  const res = await run('docker', composeArgs, { cwd: r.CLONE, env: r.STACK_ENV, timeoutMs: 60_000 });
  for (const secret of res.stdout.match(/(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])/g) ?? []) {
    r.redact.add(secret);
  }
  const out = `out-${req.id}.raw.json`;
  fs.writeFileSync(path.join(CONTROL(), out), JSON.stringify(res), { mode: 0o600 });
  r.saveText(
    path.join('host-actions', `m1-cli-${req.id}.log`),
    `$ docker ${composeArgs.join(' ')}\nexit: ${res.code}\n\n--- stdout\n${res.stdout}\n--- stderr\n${res.stderr}\n`,
  );
  return { code: 0, out };
}

async function handleM1Restart(req) {
  if (!/^[\w-]{1,64}$/.test(String(req.id)) || !r.state.h1Verified) return { code: 2 };
  if (!['cogniate-app', 'lti-service'].includes(req.service)) return { code: 2 };
  const res = await run('npm', ['run', 'stack:restart', '--', req.service], {
    cwd: r.CLONE,
    env: { ...r.STACK_ENV, STACK_PROFILE: 'acceptance' },
    timeoutMs: 180_000,
  });
  const out = `out-${req.id}.raw.json`;
  fs.writeFileSync(path.join(CONTROL(), out), JSON.stringify(res), { mode: 0o600 });
  r.saveText(
    path.join('host-actions', `m1-restart-${req.id}.log`),
    `$ npm run stack:restart -- ${req.service}\nexit: ${res.code}\n\n--- stdout\n${res.stdout}\n--- stderr\n${res.stderr}\n`,
  );
  return { code: 0, out };
}

async function handleLtiStop(req) {
  if (!/^[\w-]{1,64}$/.test(String(req.id)) || !r.state.h1Verified) return { code: 2 };
  const res = await run('docker', ['compose', '-f', 'infra/compose.yaml', '--env-file', '.env', 'stop', 'lti-service'], {
    cwd: r.CLONE,
    env: r.STACK_ENV,
    timeoutMs: 60_000,
  });
  const out = `out-${req.id}.raw.json`;
  fs.writeFileSync(path.join(CONTROL(), out), JSON.stringify(res), { mode: 0o600 });
  r.saveText(
    path.join('host-actions', `qa3-lti-stop-${req.id}.log`),
    `$ docker compose stop lti-service\nexit: ${res.code}\n\n--- stdout\n${res.stdout}\n--- stderr\n${res.stderr}\n`,
  );
  return { code: 0, out };
}

async function handleLtiStart(req) {
  if (!/^[\w-]{1,64}$/.test(String(req.id)) || !r.state.h1Verified) return { code: 2 };
  const res = await run('npm', ['run', 'stack:restart', '--', 'lti-service'], {
    cwd: r.CLONE,
    env: { ...r.STACK_ENV, STACK_PROFILE: 'acceptance' },
    timeoutMs: 180_000,
  });
  const out = `out-${req.id}.raw.json`;
  fs.writeFileSync(path.join(CONTROL(), out), JSON.stringify(res), { mode: 0o600 });
  r.saveText(
    path.join('host-actions', `qa3-lti-start-${req.id}.log`),
    `$ npm run stack:restart -- lti-service\nexit: ${res.code}\n\n--- stdout\n${res.stdout}\n--- stderr\n${res.stderr}\n`,
  );
  return { code: 0, out };
}

async function setup() {
  const ci = await r.npm('root-npm-ci', ['ci', '--no-audit', '--no-fund'], { timeoutMs: 900_000 });
  const gen = await r.npm('gen-env', ['run', 'gen-env']);
  r.loadStackFiles();
  await r.composeNameGuard();
  if (r.state.abort) return false;
  const up = await r.npm('stack-up', ['run', 'stack:up'], { timeoutMs: 900_000 });
  const seed = up.code === 0 ? await r.npm('seed', ['run', 'seed'], { timeoutMs: 900_000 }) : null;
  r.loadStackFiles();
  await r.checkProject();
  const ok = ci.code === 0 && gen.code === 0 && up.code === 0 && seed?.code === 0;
  r.record(
    'SETUP',
    'Batch 2 shared stack (qa3-la-sim-r3): npm ci, gen-env, stack:up, seed',
    r.pass(ok),
    [`npm ci ${ci.code}, gen-env ${gen.code}, stack:up ${up.code}, seed ${seed?.code ?? 'not run'}`],
    [ci.log, gen.log, up.log, seed?.log].filter(Boolean),
  );
  if (!r.state.abort && (!r.state.urls?.lti || !r.state.ca)) r.state.abort = 'no PUBLIC_*_URL in .env or no root.crt';
  return !r.state.abort && ok;
}

await r.main(async () => {
  const started = Date.now();
  if (!(await setup())) return;
  const control = createHostControl(r, {
    'm1-cli': handleM1Cli,
    'm1-restart': handleM1Restart,
    'qa3-lti-stop': handleLtiStop,
    'qa3-lti-start': handleLtiStart,
  });
  const stop = control.start();
  const passStart = Date.now();
  try {
    for (const item of BATCH2_TASKS) {
      const t0 = Date.now();
      await r.containerSuite(item.task, { env: { QA_TASK: item.task, LA_LEVEL: 'k1sim' } });
      r.timings[`pass_${item.task}_ms`] = Date.now() - t0;
      recordRows(r, item.task, path.join(r.ART, `container-${item.task}`), item.expect);
    }
  } finally {
    const log = stop();
    r.record(
      'HOSTCTL',
      'Host actions asked for by Batch 2 tests (m1-cli, m1-restart, qa3-lti-stop, qa3-lti-start)',
      'PASS',
      log.length ? log : ['none'],
    );
  }
  r.timings.inContainerPassMs = Date.now() - passStart;
  r.timings.totalBeforeTeardownMs = Date.now() - started;
});
