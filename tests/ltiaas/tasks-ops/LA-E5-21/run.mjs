#!/usr/bin/env node
// QA-2 host runner for LA-E5-21 (K1-SIM, SIM slot): production profile and secrets from files.
// Reuses tests/host/core.mjs, tests/host/host-control.mjs and tests/ltiaas/tasks-ops/LA-E5-01/report.mjs.
//
//   COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
//     node tests/ltiaas/tasks-ops/LA-E5-21/run.mjs --sha <integration sha> --replace-tests
//
// Steps:
// 1. Setup: npm ci, gen-env, compose name guard, stack:up (starts in `default` profile), seed, H1 check.
// 2. Capture `GET /healthz` in `default` profile (AC-LA-E5-21-07) and run tasks README §2 form (f)
//    (`docker compose ... run --rm --no-deps -e STACK_PROFILE=production -e LTIK_TTL_SECONDS=20 lti-service npm start`)
//    for AC-LA-E5-21-01, writing the redacted capture to `tests/.tmp/qa2-LA-E5-21.json`.
// 3. In-container pass QA_TASK=LA-E5-21 (`npm run test:acceptance`, which starts the `acceptance` profile):
//    AC-LA-E5-21-01 and AC-LA-E5-21-07.
import fs from 'node:fs';
import path from 'node:path';
import { createRunner } from '../../../host/core.mjs';
import { createHostControl } from '../../../host/host-control.mjs';
import { recordRows } from '../LA-E5-01/report.mjs';

const TASK = 'LA-E5-21';
const EXPECT = [
  'AC-LA-E5-21-01',
  'AC-LA-E5-21-07',
];

const r = createRunner({ task: TASK, defaultProject: 'qa2-la-sim-r1' });
const CONTROL = () => path.join(r.CLONE, 'tests', 'acceptance', 'artifacts', 'control');
const SETUP_STATE_FILE = () => path.join(r.CLONE, 'tests', '.tmp', 'qa2-LA-E5-21.json');

/**
 * Runs tasks README §2 form (f) on QA's own compose project:
 * `docker compose ... run --rm --no-deps -e STACK_PROFILE=production -e LTIK_TTL_SECONDS=20 lti-service npm start`
 * and parses the emitted `config_refused` JSON log lines without exposing any raw secret.
 */
async function executeProductionKnobRefusal() {
  if (!r.state.h1Verified) {
    return { code: 2, configRefusedCount: 0, configRefusedEvents: [] };
  }
  const args = [
    'compose',
    '--project-directory',
    path.join(r.CLONE, 'infra'),
    '-p',
    r.PROJECT,
    '-f',
    path.join(r.CLONE, 'infra', 'compose.yaml'),
    '--env-file',
    path.join(r.CLONE, '.env'),
    'run',
    '--rm',
    '--no-deps',
    '-u',
    `${process.getuid()}:${process.getgid()}`,
    '-e',
    'STACK_PROFILE=production',
    '-e',
    'LTIK_TTL_SECONDS=20',
    '-e',
    'TEST_LTI_CLOCK_OFFSET_S=10',
    'lti-service',
    'npm',
    'start',
  ];
  const runRes = await r.exec('lti-production-knob-refusal', 'docker', args, { timeoutMs: 120_000 });
  const combined = `${runRes.stdout}\n${runRes.stderr}`;
  const configRefusedEvents = [];
  for (const rawLine of combined.split('\n')) {
    const trimmed = rawLine.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && parsed.event === 'config_refused') {
        configRefusedEvents.push({
          event: parsed.event,
          reason: parsed.reason,
          service: parsed.service,
          level: parsed.level,
        });
      }
    } catch {
      // ignore non-JSON lines
    }
  }
  return {
    code: runRes.code,
    configRefusedCount: configRefusedEvents.length,
    configRefusedEvents,
  };
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
    'npm ci, gen-env, stack:up (default profile), seed',
    r.pass(ok),
    [`npm ci ${ci.code}, gen-env ${gen.code}, stack:up ${up.code}, seed ${seed?.code ?? 'not run'}`],
    [ci.log, gen.log, up.log, seed?.log].filter(Boolean),
  );
  if (!r.state.abort && (!r.state.urls?.lti || !r.state.ca)) r.state.abort = 'no PUBLIC_*_URL in .env or no root.crt';
  if (r.state.abort || !ok) return false;

  // Capture /healthz in default profile (AC-LA-E5-21-07) and the form (f) production knob refusal (AC-LA-E5-21-01).
  const defaultHealthWait = await r.waitHealth(
    r.state.urls.lti,
    (h) => h.status === 'ok' && h.service === 'lti-service' && h.profile === 'default',
    60_000,
  );
  const productionKnobRun = await executeProductionKnobRefusal();
  fs.mkdirSync(path.dirname(SETUP_STATE_FILE()), { recursive: true });
  fs.writeFileSync(
    SETUP_STATE_FILE(),
    JSON.stringify(
      {
        defaultHealth: defaultHealthWait.last,
        productionKnobRun,
      },
      null,
      2,
    ),
  );
  return true;
}

await r.main(async () => {
  const started = Date.now();
  if (!(await setup())) return;
  const passStart = Date.now();
  const ctl = createHostControl(r, {
    'qa2-e521-production-knob': async (req) => {
      if (!/^[\w-]{1,64}$/.test(String(req.id))) return { code: 2 };
      const res = await executeProductionKnobRefusal();
      const out = `out-qa2-e521-${req.id}.json`;
      fs.writeFileSync(path.join(CONTROL(), out), JSON.stringify(res));
      return { code: 0, out };
    },
  });
  const stop = ctl.start();
  try {
    await r.containerSuite(TASK, { env: { QA_TASK: TASK } });
  } finally {
    const log = stop();
    r.record('HOSTCTL', 'Host actions asked for by LA-E5-21 tests (qa2-e521-production-knob = QA form (f))', 'PASS', log.length ? log : ['none']);
  }
  r.timings.inContainerPassMs = Date.now() - passStart;
  recordRows(r, TASK, path.join(r.ART, `container-${TASK}`), EXPECT);
  r.timings.totalBeforeTeardownMs = Date.now() - started;
});
