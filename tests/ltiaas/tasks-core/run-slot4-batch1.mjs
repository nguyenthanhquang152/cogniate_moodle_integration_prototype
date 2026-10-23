#!/usr/bin/env node
// QA-3 Slot 4 Batch 1 shared-stack runner (qa3-la-sim-r2, PUBLIC_PORT=9453, STACK_SUBNET=172.21.0.0/16).
// Brings up and seeds qa3-la-sim-r2 ONCE, runs the non-destructive K1-SIM suites sequentially:
// 1. LA-E5-12 (AC-LA-E5-12-01..07)
// 2. LA-E1-08 AC-02 (M1 capability-guard cases M1-18.blackboard.tool-config, M1-21.blackboard.capabilities,
//    M1-20.canvas.capability-moodle, M1-21.canvas.course-shell)
// 3. LA-E2-03 (AC-LA-E2-03-03, -04, -05, -07)
// 4. LA-E2-04 (AC-LA-E2-04-03, -04, -08)
// 5. LA-E2-05 (AC-LA-E2-05-04, -05, -06, -10)
// 6. LA-E2-06 (AC-LA-E2-06-02, -03)
// 7. LA-E3-07 (AC-LA-E3-07-02, -03, -06)
// and tears down qa3-la-sim-r2 cleanly in finally.
import fs from 'node:fs';
import path from 'node:path';
import { createRunner } from '../../host/core.mjs';
import { createHostControl } from '../../host/host-control.mjs';
import { run } from '../../host/lib.mjs';
import { cliLines } from '../tasks-ops/LA-E5-01/cli-output.mjs';
import { recordRows } from '../tasks-ops/LA-E5-01/report.mjs';

const BATCH1_TASKS = [
  {
    task: 'LA-E5-12',
    expect: [
      'AC-LA-E5-12-01',
      'AC-LA-E5-12-02',
      'AC-LA-E5-12-03',
      'AC-LA-E5-12-04',
      'AC-LA-E5-12-05',
      'AC-LA-E5-12-06',
      'AC-LA-E5-12-07',
    ],
  },
  {
    task: 'LA-E2-03',
    expect: [
      'AC-LA-E2-03-03',
      'AC-LA-E2-03-04',
      'AC-LA-E2-03-05',
      'AC-LA-E2-03-07',
    ],
  },
  {
    task: 'LA-E2-04',
    expect: [
      'AC-LA-E2-04-03',
      'AC-LA-E2-04-04',
      'AC-LA-E2-04-08',
    ],
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
    task: 'LA-E2-06',
    expect: [
      'AC-LA-E2-06-02',
      'AC-LA-E2-06-03',
    ],
  },
  {
    task: 'LA-E3-07',
    expect: [
      'AC-LA-E3-07-02',
      'AC-LA-E3-07-03',
      'AC-LA-E3-07-06',
    ],
  },
];

const ALLOWED_SCRIPTS = new Set(['app:grant', 'app:binding', 'app:audit', 'lti:shared-platform']);
const ALLOWED_ENV_KEYS = new Set(['STACK_PROFILE', 'OPERATORS', 'OPERATORS_FILE', 'OPERATOR_NAME']);

const r = createRunner({ task: 'LA-QA3-BATCH-1', defaultProject: 'qa3-la-sim-r2' });
const CONTROL = () => path.join(r.CLONE, 'tests', 'acceptance', 'artifacts', 'control');

function sanitizeEnv(rawEnv) {
  if (!rawEnv || typeof rawEnv !== 'object') return [];
  const envFlags = [];
  for (const [k, v] of Object.entries(rawEnv)) {
    if (!ALLOWED_ENV_KEYS.has(k) || typeof v !== 'string' || v.includes('\0') || v.length > 256) return null;
    envFlags.push('-e', `${k}=${v}`);
  }
  if (rawEnv.STACK_PROFILE === 'production') {
    envFlags.push('-e', 'LTI_API_URL=');
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

async function handleQa3AppCli(req) {
  if (!/^[\w-]{1,64}$/.test(String(req.id)) || !r.state.h1Verified) return { code: 2 };
  const script = String(req.script ?? '');
  if (!ALLOWED_SCRIPTS.has(script)) return { code: 2 };
  const args = sanitizeArgs(req.args);
  const envFlags = sanitizeEnv(req.env);
  if (args === null || envFlags === null) return { code: 2 };

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
    ...envFlags,
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
    'Batch 1 shared stack (qa3-la-sim-r2): npm ci, gen-env, stack:up, seed',
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
    'qa3-app-cli': handleQa3AppCli,
    'm1-cli': handleM1Cli,
  });
  const stop = control.start();
  const passStart = Date.now();
  try {
    // 1. Run all tasks-core K1-SIM suites in BATCH1_TASKS
    for (const item of BATCH1_TASKS) {
      const t0 = Date.now();
      await r.containerSuite(item.task, { env: { QA_TASK: item.task, LA_LEVEL: 'k1sim' } });
      r.timings[`pass_${item.task}_ms`] = Date.now() - t0;
      recordRows(r, item.task, path.join(r.ART, `container-${item.task}`), item.expect);
    }

    // 2. Run LA-E1-08 AC-02 (4 M1 capability-guard cases)
    const sha = (await run('git', ['rev-parse', 'HEAD'], { cwd: r.CLONE })).stdout.trim();
    const t0 = Date.now();
    const e108Suite = await r.containerSuite('LA-E1-08-AC02', {
      env: {
        QA_TASK: 'M1',
        QA_M1_PROVIDER: 'all',
        QA_PRODUCT_SHA: sha,
        QA_TEST_SHA: sha,
        QA_GREP: 'M1-18\\.blackboard\\.tool-config|M1-21\\.blackboard\\.capabilities|M1-20\\.canvas\\.capability-moodle|M1-21\\.canvas\\.course-shell',
      },
    });
    r.timings.pass_LA_E1_08_AC02_ms = Date.now() - t0;
    r.record(
      'AC-LA-E1-08-02',
      '[LA-E1-08] K1-CAP C2 capability guards on baseline channels (M1-18, M1-20, M1-21)',
      r.pass(e108Suite.ok && e108Suite.tests.length >= 4 && e108Suite.tests.every((t) => t.status === 'PASS')),
      [`tests: ${e108Suite.tests.length} passed`],
    );
  } finally {
    const log = stop();
    r.record(
      'HOSTCTL',
      'Host actions asked for by Batch 1 tests (qa3-app-cli, m1-cli)',
      'PASS',
      log.length ? log : ['none'],
    );
  }
  r.timings.inContainerPassMs = Date.now() - passStart;
  r.timings.totalBeforeTeardownMs = Date.now() - started;
});
