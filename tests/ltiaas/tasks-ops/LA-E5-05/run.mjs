#!/usr/bin/env node
// QA-2 host runner for LA-E5-05 (K1-SIM, SIM slot): LTI CLIs as operator API clients.
// Reuses tests/host/core.mjs, tests/host/host-control.mjs and tests/ltiaas/tasks-ops/LA-E5-01/report.mjs.
//
//   COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
//     node tests/ltiaas/tasks-ops/LA-E5-05/run.mjs --sha <integration sha> --replace-tests
//
// Steps:
// 1. Setup: npm ci, gen-env, compose name guard, stack:up (fresh volume).
// 2. AC-LA-E5-05-01 & -02 setup capture: on the fresh stack before seed, run `lti:operator init --if-none` and
//    `npm run lti:bootstrap -w services/lti-service -- --account cogniate --name Cogniate`, recording the JSON line
//    shape (`{account, created, kid, apiKey}`) and writing `infra/.secrets/lti-api-key.cogniate`.
// 3. AC-LA-E5-05-08 setup capture: run `npm run seed` (#1) and `npm run seed` (#2) on the same volume, verifying both
//    pass and the key files (`lti-operator-key`, `lti-api-key.cogniate`, `lti-api-key.qa-second`) are unchanged.
// 4. In-container pass QA_TASK=LA-E5-05 (`npm run test:acceptance`): AC-LA-E5-05-01..08. During the pass the runner
//    answers `qa2-e505-bootstrap` (QA forms (d) and (e)) and `qa2-e505-shared-platform`.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRunner } from '../../../host/core.mjs';
import { createHostControl } from '../../../host/host-control.mjs';
import { run } from '../../../host/lib.mjs';
import { recordRows } from '../LA-E5-01/report.mjs';

const TASK = 'LA-E5-05';
const EXPECT = [
  'AC-LA-E5-05-01',
  'AC-LA-E5-05-02',
  'AC-LA-E5-05-03',
  'AC-LA-E5-05-04',
  'AC-LA-E5-05-05',
  'AC-LA-E5-05-06',
  'AC-LA-E5-05-07',
  'AC-LA-E5-05-08',
];
const TENANT_KEY_RE = /ltis_[A-Za-z0-9_-]{43}/g;
const OP_KEY_RE = /ltio_[A-Za-z0-9_-]{43}/g;

const r = createRunner({ task: TASK, defaultProject: 'qa2-la-sim-r1' });
const CONTROL = () => path.join(r.CLONE, 'tests', 'acceptance', 'artifacts', 'control');
const SECRETS = () => path.join(r.CLONE, 'infra', '.secrets');
const SETUP_STATE_FILE = () => path.join(r.CLONE, 'tests', '.tmp', 'qa2-LA-E5-05.json');

const sha256 = (file) => (fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null);

function redactKeysInText(text) {
  const foundTenant = text.match(TENANT_KEY_RE) ?? [];
  const foundOp = text.match(OP_KEY_RE) ?? [];
  r.redact.add(...foundTenant, ...foundOp);
}

/**
 * Runs `bootstrap.ts` inside `lti-service` (to capture the raw JSON stdout line `{account, created, kid, apiKey}`)
 * or via `npm run lti:bootstrap -w services/lti-service`, and syncs the key file permissions for `e2e`.
 */
async function executeBootstrapCli(account, name, { rotateApiKey = false, rotateSigningKey = false, renameOperatorKey = false } = {}) {
  const opKeyFile = path.join(SECRETS(), 'lti-operator-key');
  const opCopyFile = path.join(SECRETS(), 'lti', 'lti-operator-key');
  const backupOpKeyFile = `${opKeyFile}.qa2-e505-bak`;
  const backupOpCopyFile = `${opCopyFile}.qa2-e505-bak`;

  if (renameOperatorKey) {
    if (fs.existsSync(opKeyFile)) fs.renameSync(opKeyFile, backupOpKeyFile);
    if (fs.existsSync(opCopyFile)) fs.copyFileSync(opCopyFile, backupOpCopyFile);
  }

  let rawRes;
  let opCopyDeletedOnMissing = false;
  try {
    // Run `npm run lti:bootstrap -w services/lti-service -- ...` on the host (QA forms (d) and (e)).
    // Per BD-A2-34, `infra/scripts/lti-bootstrap.sh` copies `infra/.secrets/lti-operator-key` atomically to
    // `infra/.secrets/lti/lti-operator-key` (`0600`), and when the original is missing it deletes the copy and exits 1.
    const cliFlags = [
      '--account',
      account,
      '--name',
      name,
      ...(rotateApiKey ? ['--rotate-api-key'] : []),
      ...(rotateSigningKey ? ['--rotate-signing-key'] : []),
    ];

    const args = ['run', 'lti:bootstrap', '-w', 'services/lti-service', '--', ...cliFlags];
    rawRes = await run('npm', args, { cwd: r.CLONE, env: r.STACK_ENV, timeoutMs: 120_000 });
    if (renameOperatorKey) {
      opCopyDeletedOnMissing = !fs.existsSync(opCopyFile);
    }
  } finally {
    if (renameOperatorKey) {
      if (fs.existsSync(backupOpKeyFile)) {
        fs.renameSync(backupOpKeyFile, opKeyFile);
      }
      if (fs.existsSync(backupOpCopyFile)) {
        const oldUmask = process.umask(0o077);
        try {
          fs.renameSync(backupOpCopyFile, opCopyFile);
          fs.chmodSync(opCopyFile, 0o600);
        } finally {
          process.umask(oldUmask);
        }
      }
    }
  }

  const combined = `${rawRes.stdout}\n${rawRes.stderr}`;
  redactKeysInText(combined);

  const keyFile = path.join(SECRETS(), `lti-api-key.${account}`);
  if (fs.existsSync(keyFile)) {
    const fileKey = fs.readFileSync(keyFile, 'utf8').trim();
    if (fileKey) r.redact.add(fileKey);
    const seedFile = path.join(SECRETS(), 'seed.json');
    const refMode = fs.existsSync(seedFile) ? fs.statSync(seedFile).mode & 0o777 : 0o644;
    fs.chmodSync(keyFile, refMode);
  }

  // Parse either raw JSON line `{"account":...,"created":...,"kid":...,"apiKey":...}` or wrapper output from `lti-bootstrap.sh`
  // (which parses that exact JSON line on lines 59-60 of `infra/scripts/lti-bootstrap.sh`).
  let jsonLineShapeOk = false;
  let parsedAccount = '';
  let created = null;
  let kid = null;
  let hasApiKey = false;

  const stdoutLines = rawRes.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of stdoutLines) {
    if (line.startsWith('{') && line.endsWith('}')) {
      try {
        const obj = JSON.parse(line);
        if (
          obj &&
          typeof obj.account === 'string' &&
          typeof obj.created === 'boolean' &&
          typeof obj.kid === 'string' &&
          'apiKey' in obj
        ) {
          jsonLineShapeOk = true;
          parsedAccount = obj.account;
          created = obj.created;
          kid = obj.kid;
          hasApiKey = typeof obj.apiKey === 'string' && /^ltis_[A-Za-z0-9_-]{43}$/.test(obj.apiKey);
        }
      } catch {
        // Ignore non-JSON lines.
      }
    }
  }

  if (!jsonLineShapeOk) {
    const summaryMatch = rawRes.stdout.match(/account=([^\s;]+)\s+created=(true|false)\s+kid=([^\s;]+)/);
    if (summaryMatch) {
      jsonLineShapeOk = true;
      parsedAccount = summaryMatch[1];
      created = summaryMatch[2] === 'true';
      kid = summaryMatch[3];
      hasApiKey = /API key \(shown once\):\s*ltis_[A-Za-z0-9_-]{43}/.test(rawRes.stdout);
    }
  }

  const stderrLines = `${rawRes.stderr}\n${rawRes.stdout}`
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('>') && !l.startsWith('npm '));

  const keyFileWritten = fs.existsSync(keyFile) && fs.statSync(keyFile).size > 0;
  return {
    summary: {
      account: parsedAccount,
      cliCode: rawRes.code,
      jsonLineShapeOk,
      created,
      kid,
      hasApiKey,
      keyFileWritten,
      opCopyDeletedOnMissing,
      stderrLines,
    },
    rawRes,
  };
}

async function setup() {
  const ci = await r.npm('root-npm-ci', ['ci', '--no-audit', '--no-fund'], { timeoutMs: 900_000 });
  const gen = await r.npm('gen-env', ['run', 'gen-env']);
  r.loadStackFiles();
  await r.composeNameGuard();
  if (r.state.abort) return false;
  const up = await r.npm('stack-up', ['run', 'stack:up'], { timeoutMs: 900_000 });
  r.loadStackFiles();
  await r.checkProject();
  if (r.state.abort || up.code !== 0) return false;

  // Step 2: On the fresh stack before seed, run `npm run lti:bootstrap -w services/lti-service -- --account cogniate --name Cogniate`
  // to capture AC-LA-E5-05-01 and AC-LA-E5-05-02 on a brand-new stack.
  const freshCog = await executeBootstrapCli('cogniate', 'Cogniate');

  // Step 3: Run `npm run seed` (#1) and `npm run seed` (#2) on the same volume (AC-LA-E5-05-08).
  const seed1 = await r.npm('seed-1', ['run', 'seed'], { timeoutMs: 900_000 });
  r.loadStackFiles();

  const opKeyFile = path.join(SECRETS(), 'lti-operator-key');
  const cogKeyFile = path.join(SECRETS(), 'lti-api-key.cogniate');
  const secKeyFile = path.join(SECRETS(), 'lti-api-key.qa-second');
  const beforeOpSha = sha256(opKeyFile);
  const beforeCogSha = sha256(cogKeyFile);
  const beforeSecSha = sha256(secKeyFile);

  const seed2 = seed1.code === 0 ? await r.npm('seed-2', ['run', 'seed'], { timeoutMs: 900_000 }) : null;
  r.loadStackFiles();

  const afterOpSha = sha256(opKeyFile);
  const afterCogSha = sha256(cogKeyFile);
  const afterSecSha = sha256(secKeyFile);

  const setupState = {
    freshCogniateBootstrap: freshCog.summary,
    seed1Code: seed1.code,
    seed2Code: seed2?.code ?? -1,
    opKeySameAfterSeed2: Boolean(beforeOpSha && beforeOpSha === afterOpSha),
    cogniateKeySameAfterSeed2: Boolean(beforeCogSha && beforeCogSha === afterCogSha),
    secondKeySameAfterSeed2: Boolean(beforeSecSha && beforeSecSha === afterSecSha),
  };
  fs.mkdirSync(path.dirname(SETUP_STATE_FILE()), { recursive: true });
  fs.writeFileSync(SETUP_STATE_FILE(), JSON.stringify(setupState, null, 2));

  const ok = ci.code === 0 && gen.code === 0 && up.code === 0 && seed1.code === 0 && seed2?.code === 0;
  r.record(
    'SETUP',
    'npm ci, gen-env, stack:up, fresh cogniate lti:bootstrap, seed #1, seed #2',
    r.pass(ok),
    [
      `npm ci ${ci.code}, gen-env ${gen.code}, stack:up ${up.code}, fresh cogniate bootstrap ${freshCog.rawRes.code}, seed #1 ${seed1.code}, seed #2 ${seed2?.code ?? 'not run'}`,
    ],
    [ci.log, gen.log, up.log, seed1.log, seed2?.log].filter(Boolean),
  );
  if (!r.state.abort && (!r.state.urls?.lti || !r.state.ca)) r.state.abort = 'no PUBLIC_*_URL in .env or no root.crt';
  return !r.state.abort && ok;
}

async function handleBootstrapAction(req) {
  const account = String(req.account ?? '');
  const name = String(req.name ?? `QA2 ${account}`);
  if (
    !/^qa2-[a-z0-9-]{1,48}$/.test(account) ||
    account === 'cogniate' ||
    account === 'qa-second' ||
    !/^[\w-]{1,64}$/.test(String(req.id)) ||
    !r.state.h1Verified
  ) {
    return { code: 2 };
  }
  const { summary, rawRes } = await executeBootstrapCli(account, name, {
    rotateApiKey: Boolean(req.rotateApiKey),
    rotateSigningKey: Boolean(req.rotateSigningKey),
    renameOperatorKey: Boolean(req.renameOperatorKey),
  });
  const out = `out-qa2-e505-bootstrap-${req.id}.json`;
  fs.writeFileSync(path.join(CONTROL(), out), JSON.stringify(summary));
  r.saveText(
    path.join('host-actions', `qa2-e505-bootstrap-${account}-${req.id}.log`),
    `exit: ${rawRes.code}\nduration_ms: ${rawRes.durationMs}\n\n--- stdout\n${rawRes.stdout}\n--- stderr\n${rawRes.stderr}\n`,
  );
  return { code: 0, out };
}

async function handleSharedPlatformAction(req) {
  const account = String(req.account ?? '');
  const profile = String(req.profile ?? '');
  const clientId = String(req.clientId ?? '');
  const name = req.name ? String(req.name) : undefined;
  if (
    !/^qa2-[a-z0-9-]{1,48}$/.test(account) ||
    !/^[a-z0-9-]{1,48}$/.test(profile) ||
    !/^[\w-]{1,64}$/.test(clientId) ||
    !/^[\w-]{1,64}$/.test(String(req.id)) ||
    !r.state.h1Verified
  ) {
    return { code: 2 };
  }
  const cliArgs = [
    'compose',
    '-f',
    'infra/compose.yaml',
    '--env-file',
    '.env',
    'exec',
    '-T',
    '-e',
    'NPM_CONFIG_UPDATE_NOTIFIER=false',
    'lti-service',
    'npm',
    'run',
    'lti:shared-platform',
    '--',
    '--account',
    account,
    '--profile',
    profile,
    '--client-id',
    clientId,
    ...(name ? ['--name', name] : []),
  ];
  const res = await run('docker', cliArgs, { cwd: r.CLONE, env: r.STACK_ENV, timeoutMs: 60_000 });
  redactKeysInText(`${res.stdout}\n${res.stderr}`);
  const idMatch = res.stdout.match(/\b(plt_[A-Za-z0-9_-]+)\b/);
  const summary = {
    cliCode: res.code,
    stdout: res.stdout,
    stderr: res.stderr,
    platformId: idMatch ? idMatch[1] : null,
  };
  const out = `out-qa2-e505-shared-${req.id}.json`;
  fs.writeFileSync(path.join(CONTROL(), out), JSON.stringify(summary));
  r.saveText(
    path.join('host-actions', `qa2-e505-shared-${account}-${req.id}.log`),
    `$ docker ${cliArgs.join(' ')}\nexit: ${res.code}\n\n--- stdout\n${res.stdout}\n--- stderr\n${res.stderr}\n`,
  );
  return { code: 0, out };
}

await r.main(async () => {
  const started = Date.now();
  if (!(await setup())) return;
  const control = createHostControl(r, {
    'qa2-e505-bootstrap': handleBootstrapAction,
    'qa2-e505-shared-platform': handleSharedPlatformAction,
  });
  const stop = control.start();
  const passStart = Date.now();
  try {
    await r.containerSuite(TASK, { env: { QA_TASK: TASK } });
  } finally {
    const log = stop();
    r.record(
      'HOSTCTL',
      'Host actions asked for by the LA-E5-05 tests (qa2-e505-bootstrap = QA forms (d)/(e), qa2-e505-shared-platform)',
      'PASS',
      log.length ? log : ['none'],
    );
  }
  r.timings.inContainerPassMs = Date.now() - passStart;
  recordRows(r, TASK, path.join(r.ART, `container-${TASK}`), EXPECT);
  r.timings.totalBeforeTeardownMs = Date.now() - started;
});
