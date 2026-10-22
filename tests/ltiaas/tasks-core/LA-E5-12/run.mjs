#!/usr/bin/env node
// QA-3 host runner for LA-E5-12 (K1-SIM, SIM slot): App CLI wiring (`--operator`, evidence flags, audit events).
// Uses `qa3-la-sim-r1` (`PUBLIC_PORT=9443`, `STACK_SUBNET=172.20.0.0/16`) and runs whitelisted `app:grant`,
// `app:binding`, and `app:audit` CLI invocations via `docker compose exec` with per-process env overrides
// (`STACK_PROFILE`, `OPERATORS`, `OPERATORS_FILE`, `OPERATOR_NAME`; tasks README §2 form (i) and LA-E5-12 design notes).
//
//   COMPOSE_PROJECT_NAME=qa3-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
//     node tests/ltiaas/tasks-core/LA-E5-12/run.mjs --sha <integration sha> --replace-tests
import fs from 'node:fs';
import path from 'node:path';
import { createRunner } from '../../../host/core.mjs';
import { createHostControl } from '../../../host/host-control.mjs';
import { run } from '../../../host/lib.mjs';
import { cliLines } from '../../tasks-ops/LA-E5-01/cli-output.mjs';
import { recordRows } from '../../tasks-ops/LA-E5-01/report.mjs';

const TASK = 'LA-E5-12';
const EXPECT = [
  'AC-LA-E5-12-01',
  'AC-LA-E5-12-02',
  'AC-LA-E5-12-03',
  'AC-LA-E5-12-04',
  'AC-LA-E5-12-05',
  'AC-LA-E5-12-06',
  'AC-LA-E5-12-07',
];
const ALLOWED_SCRIPTS = new Set(['app:grant', 'app:binding', 'app:audit']);
const ALLOWED_ENV_KEYS = new Set(['STACK_PROFILE', 'OPERATORS', 'OPERATORS_FILE', 'OPERATOR_NAME']);

const r = createRunner({ task: TASK, defaultProject: 'qa3-la-sim-r1' });
const CONTROL = () => path.join(r.CLONE, 'tests', 'acceptance', 'artifacts', 'control');

function sanitizeEnv(rawEnv) {
  if (!rawEnv || typeof rawEnv !== 'object') return [];
  const envFlags = [];
  for (const [k, v] of Object.entries(rawEnv)) {
    if (!ALLOWED_ENV_KEYS.has(k) || typeof v !== 'string' || v.includes('\0') || v.length > 256) return null;
    envFlags.push('-e', `${k}=${v}`);
  }
  return envFlags;
}

function sanitizeArgs(rawArgs) {
  if (!Array.isArray(rawArgs) || rawArgs.length > 40) return null;
  for (const arg of rawArgs) {
    if (typeof arg !== 'string' || arg.includes('\0') || arg.length > 512) return null;
  }
  return rawArgs;
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
    'npm ci, gen-env, stack:up, seed (SIM stack for LA-E5-12 app CLI wiring)',
    r.pass(ok),
    [`npm ci ${ci.code}, gen-env ${gen.code}, stack:up ${up.code}, seed ${seed?.code ?? 'not run'}`],
    [ci.log, gen.log, up.log, seed?.log].filter(Boolean),
  );
  if (!r.state.abort && (!r.state.urls?.lti || !r.state.ca)) r.state.abort = 'no PUBLIC_*_URL in .env or no root.crt';
  return !r.state.abort && ok;
}

async function handleQa3AppCli(req) {
  if (!/^[\w-]{1,64}$/.test(String(req.id)) || !r.state.h1Verified) return { code: 2 };
  const script = String(req.script ?? '');
  if (!ALLOWED_SCRIPTS.has(script)) return { code: 2 };
  const args = sanitizeArgs(req.args);
  const envFlags = sanitizeEnv(req.env);
  if (args === null || envFlags === null) return { code: 2 };

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
    ...envFlags,
    'cogniate-app',
    'npm',
    'run',
    script,
    '-w',
    'services/cogniate-app',
    '--',
    ...args,
  ];
  const res = await run('docker', composeArgs, { cwd: r.CLONE, env: r.STACK_ENV, timeoutMs: 60_000 });
  for (const secret of res.stdout.match(/(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])/g) ?? []) {
    r.redact.add(secret);
  }
  const summary = {
    script,
    args,
    cliCode: res.code,
    stdout: res.stdout,
    stderr: res.stderr,
    cliLines: cliLines(res.stdout, res.stderr),
    stdoutLines: cliLines(res.stdout, ''),
    stderrLines: cliLines('', res.stderr),
  };
  const out = `out-qa3-e512-cli-${req.id}.json`;
  fs.writeFileSync(path.join(CONTROL(), out), JSON.stringify(summary), { mode: 0o600 });
  r.saveText(
    path.join('host-actions', `qa3-app-cli-${req.id}.log`),
    `$ docker ${composeArgs.join(' ')}\nexit: ${res.code}\n\n--- stdout\n${res.stdout}\n--- stderr\n${res.stderr}\n`,
  );
  return { code: 0, out };
}

await r.main(async () => {
  const started = Date.now();
  if (!(await setup())) return;
  const control = createHostControl(r, {
    'qa3-app-cli': handleQa3AppCli,
  });
  const stop = control.start();
  const passStart = Date.now();
  try {
    await r.containerSuite(TASK, { env: { QA_TASK: TASK, LA_LEVEL: 'k1sim' } });
  } finally {
    const log = stop();
    r.record(
      'HOSTCTL',
      'Host actions asked for by the LA-E5-12 tests (qa3-app-cli = QA form (i))',
      'PASS',
      log.length ? log : ['none'],
    );
  }
  r.timings.inContainerPassMs = Date.now() - passStart;
  recordRows(r, TASK, path.join(r.ART, `container-${TASK}`), EXPECT);
  r.timings.totalBeforeTeardownMs = Date.now() - started;
});
