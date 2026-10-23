#!/usr/bin/env node
// QA-2 Batch 2 shared-stack runner (qa2-la-sim-r2).
// Brings up and seeds qa2-la-sim-r2 ONCE, runs the 11 Batch 2 suites sequentially in isolated e2e passes:
// LA-E5-11 -> LA-E5-02 -> LA-E5-04 -> LA-E5-10 -> LA-E5-07 -> LA-E5-03 -> LA-E5-15 -> LA-E5-16 -> LA-E5-17 -> LA-E5-20 -> LA-E5-19,
// records per-AC rows for every task, and tears down qa2-la-sim-r2 cleanly in finally.
import fs from 'node:fs';
import path from 'node:path';
import { createRunner } from '../../host/core.mjs';
import { createHostControl } from '../../host/host-control.mjs';
import { run } from '../../host/lib.mjs';
import { cliLines } from './LA-E5-01/cli-output.mjs';
import { recordRows } from './LA-E5-01/report.mjs';

const BATCH2_TASKS = [
  {
    task: 'LA-E5-11',
    expect: ['AC-LA-E5-11-08'],
  },
  {
    task: 'LA-E5-02',
    expect: [
      'AC-LA-E5-02-01',
      'AC-LA-E5-02-02',
      'AC-LA-E5-02-03',
      'AC-LA-E5-02-04',
      'AC-LA-E5-02-05',
      'AC-LA-E5-02-06',
      'AC-LA-E5-02-09',
    ],
  },
  {
    task: 'LA-E5-04',
    expect: [
      'AC-LA-E5-04-01',
      'AC-LA-E5-04-02',
      'AC-LA-E5-04-03',
      'AC-LA-E5-04-04',
      'AC-LA-E5-04-05',
      'AC-LA-E5-04-06',
      'AC-LA-E5-04-07',
      'AC-LA-E5-04-08',
      'AC-LA-E5-04-09',
    ],
  },
  {
    task: 'LA-E5-10',
    expect: [
      'AC-LA-E5-10-01',
      'AC-LA-E5-10-02',
      'AC-LA-E5-10-03',
      'AC-LA-E5-10-04',
      'AC-LA-E5-10-06',
      'AC-LA-E5-10-08',
      'AC-LA-E5-10-09',
    ],
  },
  {
    task: 'LA-E5-07',
    expect: [
      'AC-LA-E5-07-01',
      'AC-LA-E5-07-02',
      'AC-LA-E5-07-03',
      'AC-LA-E5-07-04',
      'AC-LA-E5-07-05',
      'AC-LA-E5-07-07',
      'AC-LA-E5-07-08',
      'AC-LA-E5-07-11',
      'AC-LA-E5-07-12',
    ],
  },
  {
    task: 'LA-E5-03',
    expect: [
      'AC-LA-E5-03-01',
      'AC-LA-E5-03-02',
      'AC-LA-E5-03-03',
      'AC-LA-E5-03-04',
      'AC-LA-E5-03-05',
      'AC-LA-E5-03-06',
      'AC-LA-E5-03-07',
      'AC-LA-E5-03-08',
      'AC-LA-E5-03-09',
      'AC-LA-E5-03-11',
      'AC-LA-E5-03-12',
    ],
  },
  {
    task: 'LA-E5-15',
    expect: [
      'AC-LA-E5-15-01',
      'AC-LA-E5-15-02',
      'AC-LA-E5-15-03',
      'AC-LA-E5-15-05',
      'AC-LA-E5-15-06',
      'AC-LA-E5-15-07',
    ],
  },
  {
    task: 'LA-E5-16',
    expect: [
      'AC-LA-E5-16-01',
      'AC-LA-E5-16-02',
      'AC-LA-E5-16-03',
      'AC-LA-E5-16-05',
      'AC-LA-E5-16-07',
    ],
  },
  {
    task: 'LA-E5-17',
    expect: [
      'AC-LA-E5-17-01',
      'AC-LA-E5-17-02',
      'AC-LA-E5-17-03',
      'AC-LA-E5-17-06',
      'AC-LA-E5-17-07',
    ],
  },
  {
    task: 'LA-E5-20',
    expect: [
      'AC-LA-E5-20-01',
      'AC-LA-E5-20-02',
    ],
  },
  {
    task: 'LA-E5-19',
    expect: [
      'AC-LA-E5-19-01',
      'AC-LA-E5-19-04',
      'AC-LA-E5-19-08',
    ],
  },
];

const ALLOWED_FLAGS = new Set(['--connection', '--action', '--since', '--limit']);
const KEY_RE = /ltis_[A-Za-z0-9_-]{43}/g;

const r = createRunner({ task: 'LA-BATCH-2', defaultProject: 'qa2-la-sim-r2' });
const CONTROL = () => path.join(r.CLONE, 'tests', 'acceptance', 'artifacts', 'control');
const SECRETS = () => path.join(r.CLONE, 'infra', '.secrets');

function sanitizeListArgs(rawArgs) {
  if (!Array.isArray(rawArgs)) return [];
  const out = [];
  for (let i = 0; i < rawArgs.length; i += 1) {
    const flag = String(rawArgs[i] ?? '');
    if (!ALLOWED_FLAGS.has(flag)) return null;
    const val = String(rawArgs[i + 1] ?? '');
    if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(val)) return null;
    out.push(flag, val);
    i += 1;
  }
  return out;
}

async function handleAppAuditListAction(req) {
  if (!/^[\w-]{1,64}$/.test(String(req.id)) || !r.state.h1Verified) return { code: 2 };
  const extraArgs = sanitizeListArgs(req.args);
  if (extraArgs === null) return { code: 2 };
  const composeArgs = [
    'compose',
    '-f',
    'infra/compose.yaml',
    '--env-file',
    '.env',
    'exec',
    '-T',
    '-e',
    'NPM_CONFIG_UPDATE_NOTIFIER=false',
    'cogniate-app',
    'npm',
    'run',
    'app:audit',
    '--',
    'list',
    ...extraArgs,
  ];
  const res = await run('docker', composeArgs, { cwd: r.CLONE, env: r.STACK_ENV, timeoutMs: 60_000 });
  const summary = {
    args: extraArgs,
    cliCode: res.code,
    cliLines: cliLines(res.stdout, res.stderr),
    stdoutLines: cliLines(res.stdout, ''),
    stderrLines: cliLines('', res.stderr),
  };
  const out = `out-qa2-e511-audit-list-${req.id}.json`;
  fs.writeFileSync(path.join(CONTROL(), out), JSON.stringify(summary));
  r.saveText(
    path.join('host-actions', `qa2-app-audit-list-${req.id}.log`),
    `$ docker ${composeArgs.join(' ')}\nexit: ${res.code}\n\n--- stdout\n${res.stdout}\n--- stderr\n${res.stderr}\n`,
  );
  return { code: 0, out };
}

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

async function runE502K0() {
  const dir = path.join(r.ART, 'k0-LA-E5-02');
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
  recordRows(r, 'LA-E5-02-k0', dir, ['AC-LA-E5-02-10']);
  return res.code === 0;
}

async function setup() {
  const ci = await r.npm('root-npm-ci', ['ci', '--no-audit', '--no-fund'], { timeoutMs: 900_000 });
  if (ci.code !== 0) {
    r.record('SETUP', 'npm ci', 'FAIL', [`npm ci ${ci.code}`], [ci.log]);
    return false;
  }
  await runE502K0();
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
    'Batch 2 shared stack: npm ci, gen-env, stack:up, seed',
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
  const control = createHostControl(r, {
    'qa2-app-audit-list': handleAppAuditListAction,
    'qa2-lti-bootstrap': ltiBootstrapAction,
    'lti-restart': () => {
      if (!r.state.h1Verified) return { code: 2 };
      return r.npm('restart-lti-service', ['run', 'stack:restart', '--', 'lti-service'], { timeoutMs: 300_000 });
    },
  });
  const stop = control.start();
  const passStart = Date.now();
  try {
    for (const item of BATCH2_TASKS) {
      const t0 = Date.now();
      await r.containerSuite(item.task, { env: { QA_TASK: item.task } });
      r.timings[`pass_${item.task}_ms`] = Date.now() - t0;
      recordRows(r, item.task, path.join(r.ART, `container-${item.task}`), item.expect);
    }
  } finally {
    const log = stop();
    r.record(
      'HOSTCTL',
      'Host actions asked for by Batch 2 tests (qa2-app-audit-list, qa2-lti-bootstrap, lti-restart)',
      'PASS',
      log.length ? log : ['none'],
    );
  }
  r.timings.inContainerPassMs = Date.now() - passStart;
  r.timings.totalBeforeTeardownMs = Date.now() - started;
});
