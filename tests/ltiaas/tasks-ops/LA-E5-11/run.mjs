#!/usr/bin/env node
// QA-2 host runner for LA-E5-11 (K1-SIM, SIM slot): App audit writer, operator policy, `app:audit list`.
// Reuses tests/host/core.mjs, tests/host/host-control.mjs, tests/ltiaas/tasks-ops/LA-E5-01/cli-output.mjs
// and tests/ltiaas/tasks-ops/LA-E5-01/report.mjs.
//
//   COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
//     node tests/ltiaas/tasks-ops/LA-E5-11/run.mjs --sha <integration sha> --replace-tests
import fs from 'node:fs';
import path from 'node:path';
import { createRunner } from '../../../host/core.mjs';
import { createHostControl } from '../../../host/host-control.mjs';
import { run } from '../../../host/lib.mjs';
import { cliLines } from '../LA-E5-01/cli-output.mjs';
import { recordRows } from '../LA-E5-01/report.mjs';

const TASK = 'LA-E5-11';
const EXPECT = ['AC-LA-E5-11-08'];
const ALLOWED_FLAGS = new Set(['--connection', '--action', '--since', '--limit']);

const r = createRunner({ task: TASK, defaultProject: 'qa2-la-sim-r1' });
const CONTROL = () => path.join(r.CLONE, 'tests', 'acceptance', 'artifacts', 'control');

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
    'npm ci, gen-env, stack:up, seed (fresh stack for app:audit list)',
    r.pass(ok),
    [`npm ci ${ci.code}, gen-env ${gen.code}, stack:up ${up.code}, seed ${seed?.code ?? 'not run'}`],
    [ci.log, gen.log, up.log, seed?.log].filter(Boolean),
  );
  if (!r.state.abort && (!r.state.urls?.lti || !r.state.ca)) r.state.abort = 'no PUBLIC_*_URL in .env or no root.crt';
  return !r.state.abort && ok;
}

async function handleAppAuditListAction(req) {
  if (!/^[\w-]{1,64}$/.test(String(req.id)) || !r.state.h1Verified) return { code: 2 };
  const extraArgs = sanitizeListArgs(req.args);
  if (extraArgs === null) return { code: 2 };

  // QA form (i), tasks/README.md §2: `docker compose exec cogniate-app npm run app:audit -- list`
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

await r.main(async () => {
  const started = Date.now();
  if (!(await setup())) return;
  const control = createHostControl(r, {
    'qa2-app-audit-list': handleAppAuditListAction,
  });
  const stop = control.start();
  const passStart = Date.now();
  try {
    await r.containerSuite(TASK, { env: { QA_TASK: TASK } });
  } finally {
    const log = stop();
    r.record(
      'HOSTCTL',
      'Host actions asked for by the LA-E5-11 tests (qa2-app-audit-list = QA form (i))',
      'PASS',
      log.length ? log : ['none'],
    );
  }
  r.timings.inContainerPassMs = Date.now() - passStart;
  recordRows(r, TASK, path.join(r.ART, `container-${TASK}`), EXPECT);
  r.timings.totalBeforeTeardownMs = Date.now() - started;
});
