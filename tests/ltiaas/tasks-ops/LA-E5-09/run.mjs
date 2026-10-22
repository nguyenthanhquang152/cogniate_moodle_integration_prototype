#!/usr/bin/env node
// QA-2 host runner for LA-E5-09 (K1-SIM, SIM slot): Key provider status, re-wrap job, legacy refusal.
// Reuses tests/host/core.mjs, tests/host/host-control.mjs and tests/ltiaas/tasks-ops/LA-E5-01/report.mjs.
//
//   COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
//     node tests/ltiaas/tasks-ops/LA-E5-09/run.mjs --sha <integration sha> --replace-tests
//
// Host actions (tasks/README.md §2 QA form (a)):
// - `qa2-e509-write-keyring-and-restart`: writes `infra/.secrets/lti/keyring.json` (mode 0600) with
//   `{active: "k2", keys: {legacy: <LTI_MASTER_KEY>, k2: <new 64 hex>}}`, restarts `lti-service`, and checks `/healthz`.
// - In `finally`, restores the original `infra/.secrets/lti/keyring.json` state, restarts `lti-service`, and checks `/healthz`.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRunner } from '../../../host/core.mjs';
import { createHostControl } from '../../../host/host-control.mjs';
import { recordRows } from '../LA-E5-01/report.mjs';

const TASK = 'LA-E5-09';
const EXPECT = [
  'AC-LA-E5-09-01',
  'AC-LA-E5-09-02',
  'AC-LA-E5-09-03',
  'AC-LA-E5-09-04',
  'AC-LA-E5-09-05',
];

const r = createRunner({ task: TASK, defaultProject: 'qa2-la-sim-r1' });
const CONTROL = () => path.join(r.CLONE, 'tests', 'acceptance', 'artifacts', 'control');
const KEYRING_DIR = () => path.join(r.CLONE, 'infra', '.secrets', 'lti');
const KEYRING_FILE = () => path.join(KEYRING_DIR(), 'keyring.json');

let originalKeyringBytes = null;
let keyringTouched = false;

async function setup() {
  const ci = await r.npm('root-npm-ci', ['ci', '--no-audit', '--no-fund'], { timeoutMs: 900_000 });
  const gen = await r.npm('gen-env', ['run', 'gen-env']);
  r.loadStackFiles();
  await r.composeNameGuard();
  if (r.state.abort) return false;

  // Ensure AC-01 starts with only LTI_MASTER_KEY and no keyring.json file.
  if (fs.existsSync(KEYRING_FILE())) {
    originalKeyringBytes = fs.readFileSync(KEYRING_FILE());
    fs.rmSync(KEYRING_FILE(), { force: true });
  }

  const up = await r.npm('stack-up', ['run', 'stack:up'], { timeoutMs: 900_000 });
  const seed = up.code === 0 ? await r.npm('seed', ['run', 'seed'], { timeoutMs: 900_000 }) : null;
  r.loadStackFiles();
  await r.checkProject();
  const ok = ci.code === 0 && gen.code === 0 && up.code === 0 && seed?.code === 0;
  r.record(
    'SETUP',
    'npm ci, gen-env, stack:up, seed (stack with only LTI_MASTER_KEY)',
    r.pass(ok),
    [`npm ci ${ci.code}, gen-env ${gen.code}, stack:up ${up.code}, seed ${seed?.code ?? 'not run'}`],
    [ci.log, gen.log, up.log, seed?.log].filter(Boolean),
  );
  if (!r.state.abort && (!r.state.urls?.lti || !r.state.ca)) r.state.abort = 'no PUBLIC_*_URL in .env or no root.crt';
  return !r.state.abort && ok;
}

async function handleWriteKeyringAndRestart(req) {
  if (!/^[\w-]{1,64}$/.test(String(req.id)) || !r.state.h1Verified) return { code: 2 };
  const masterKey = String(r.state.env?.LTI_MASTER_KEY ?? '').trim();
  if (!/^[0-9a-fA-F]{64}$/.test(masterKey)) {
    return { code: 2 };
  }
  const k2Key = crypto.randomBytes(32).toString('hex');
  r.redact.add(masterKey, k2Key);

  fs.mkdirSync(KEYRING_DIR(), { recursive: true });
  const keyringPayload = JSON.stringify(
    {
      active: 'k2',
      keys: {
        legacy: masterKey,
        k2: k2Key,
      },
    },
    null,
    2,
  );
  const oldUmask = process.umask(0o077);
  try {
    fs.writeFileSync(KEYRING_FILE(), `${keyringPayload}\n`, { mode: 0o600 });
    fs.chmodSync(KEYRING_FILE(), 0o600);
  } finally {
    process.umask(oldUmask);
  }
  keyringTouched = true;

  const restart = await r.npm(`lti-restart-keyring-${req.id}`, ['run', 'stack:restart', '--', 'lti-service'], {
    timeoutMs: 180_000,
  });
  const health = await r.waitHealth(r.state.urls.lti, (h) => h.status === 'ok', 60_000);
  const summary = {
    activeVersion: 'k2',
    restartExit: restart.code,
    healthOk: health.ok,
  };
  const out = `out-qa2-e509-keyring-${req.id}.json`;
  fs.writeFileSync(path.join(CONTROL(), out), JSON.stringify(summary));
  return { code: restart.code === 0 && health.ok ? 0 : 1, out };
}

async function restoreKeyringAndRestart() {
  if (!keyringTouched && originalKeyringBytes === null) return;
  const oldUmask = process.umask(0o077);
  try {
    if (originalKeyringBytes !== null) {
      fs.mkdirSync(KEYRING_DIR(), { recursive: true });
      fs.writeFileSync(KEYRING_FILE(), originalKeyringBytes, { mode: 0o600 });
      fs.chmodSync(KEYRING_FILE(), 0o600);
    } else {
      fs.rmSync(KEYRING_FILE(), { force: true });
    }
  } finally {
    process.umask(oldUmask);
  }
  const restart = await r.npm('lti-restart-restore-keyring', ['run', 'stack:restart', '--', 'lti-service'], {
    timeoutMs: 180_000,
  });
  const health = await r.waitHealth(r.state.urls.lti, (h) => h.status === 'ok', 60_000);
  r.record(
    'RESTORE',
    'QA form (a) restore: original infra/.secrets/lti/keyring.json state restored, lti-service restarted, /healthz checked',
    r.pass(restart.code === 0 && health.ok),
    [`restart exit ${restart.code}; /healthz ${health.ok ? 'ok' : `not ok (${JSON.stringify(health.last)})`}`],
    [restart.log],
  );
}

await r.main(async () => {
  const started = Date.now();
  if (!(await setup())) return;
  const control = createHostControl(r, {
    'qa2-e509-write-keyring-and-restart': handleWriteKeyringAndRestart,
  });
  const stop = control.start();
  const passStart = Date.now();
  try {
    await r.containerSuite(TASK, { env: { QA_TASK: TASK } });
  } finally {
    const log = stop();
    r.record(
      'HOSTCTL',
      'Host actions asked for by the LA-E5-09 tests (qa2-e509-write-keyring-and-restart = QA form (a))',
      'PASS',
      log.length ? log : ['none'],
    );
    await restoreKeyringAndRestart();
  }
  r.timings.inContainerPassMs = Date.now() - passStart;
  recordRows(r, TASK, path.join(r.ART, `container-${TASK}`), EXPECT);
  r.timings.totalBeforeTeardownMs = Date.now() - started;
});
