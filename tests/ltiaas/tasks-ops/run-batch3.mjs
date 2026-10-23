#!/usr/bin/env node
// QA-2 Batch 3 shared-stack runner (qa2-la-sim-r3).
// Brings up qa2-la-sim-r3 ONCE, captures LA-E5-05 fresh-stack CLI + double-seed state and LA-E5-21 default /healthz +
// production knob refusal, then runs LA-E5-05 -> LA-E5-21 -> LA-E5-09 sequentially in isolated e2e passes, restores
// keyring.json in finally, and tears down qa2-la-sim-r3 cleanly.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRunner } from '../../host/core.mjs';
import { createHostControl } from '../../host/host-control.mjs';
import { run } from '../../host/lib.mjs';
import { recordRows } from './LA-E5-01/report.mjs';

const EXPECT_E505 = [
  'AC-LA-E5-05-01',
  'AC-LA-E5-05-02',
  'AC-LA-E5-05-03',
  'AC-LA-E5-05-04',
  'AC-LA-E5-05-05',
  'AC-LA-E5-05-06',
  'AC-LA-E5-05-07',
  'AC-LA-E5-05-08',
];
const EXPECT_E521 = ['AC-LA-E5-21-01', 'AC-LA-E5-21-07'];
const EXPECT_E510 = [
  'AC-LA-E5-10-01',
  'AC-LA-E5-10-02',
  'AC-LA-E5-10-03',
  'AC-LA-E5-10-04',
  'AC-LA-E5-10-06',
  'AC-LA-E5-10-08',
  'AC-LA-E5-10-09',
];
const EXPECT_E516 = [
  'AC-LA-E5-16-01',
  'AC-LA-E5-16-02',
  'AC-LA-E5-16-03',
  'AC-LA-E5-16-05',
  'AC-LA-E5-16-07',
];
const EXPECT_E509 = [
  'AC-LA-E5-09-01',
  'AC-LA-E5-09-02',
  'AC-LA-E5-09-03',
  'AC-LA-E5-09-04',
  'AC-LA-E5-09-05',
];

const TENANT_KEY_RE = /ltis_[A-Za-z0-9_-]{43}/g;
const OP_KEY_RE = /ltio_[A-Za-z0-9_-]{43}/g;

const r = createRunner({ task: 'LA-BATCH-3', defaultProject: 'qa2-la-sim-r3' });
const CONTROL = () => path.join(r.CLONE, 'tests', 'acceptance', 'artifacts', 'control');
const SECRETS = () => path.join(r.CLONE, 'infra', '.secrets');
const KEYRING_DIR = () => path.join(SECRETS(), 'lti');
const KEYRING_FILE = () => path.join(KEYRING_DIR(), 'keyring.json');
const E505_STATE_FILE = () => path.join(r.CLONE, 'tests', '.tmp', 'qa2-LA-E5-05.json');
const E521_STATE_FILE = () => path.join(r.CLONE, 'tests', '.tmp', 'qa2-LA-E5-21.json');

let originalKeyringBytes = null;
let keyringTouched = false;

const sha256 = (file) => (fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null);

function redactKeysInText(text) {
  const foundTenant = text.match(TENANT_KEY_RE) ?? [];
  const foundOp = text.match(OP_KEY_RE) ?? [];
  r.redact.add(...foundTenant, ...foundOp);
}

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

async function setup() {
  const ci = fs.existsSync(path.join(r.CLONE, 'node_modules', '.package-lock.json'))
    ? { code: 0, log: null }
    : await r.npm('root-npm-ci', ['ci', '--no-audit', '--no-fund'], { timeoutMs: 900_000 });
  fs.rmSync(path.join(r.CLONE, 'node_modules', '.vitest-cache'), { recursive: true, force: true });
  fs.rmSync(path.join(r.CLONE, 'node_modules', '.vite'), { recursive: true, force: true });
  const gen = await r.npm('gen-env', ['run', 'gen-env']);
  r.loadStackFiles();
  await r.composeNameGuard();
  if (r.state.abort) return false;

  if (fs.existsSync(KEYRING_FILE())) {
    originalKeyringBytes = fs.readFileSync(KEYRING_FILE());
    fs.rmSync(KEYRING_FILE(), { force: true });
  }

  const up = await r.npm('stack-up', ['run', 'stack:up'], { timeoutMs: 900_000 });
  r.loadStackFiles();
  await r.checkProject();
  if (r.state.abort || up.code !== 0) return false;

  // LA-E5-05 fresh-stack cogniate bootstrap + double seed
  const freshCog = await executeBootstrapCli('cogniate', 'Cogniate');
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

  const e505State = {
    freshCogniateBootstrap: freshCog.summary,
    seed1Code: seed1.code,
    seed2Code: seed2?.code ?? -1,
    opKeySameAfterSeed2: Boolean(beforeOpSha && beforeOpSha === afterOpSha),
    cogniateKeySameAfterSeed2: Boolean(beforeCogSha && beforeCogSha === afterCogSha),
    secondKeySameAfterSeed2: Boolean(beforeSecSha && beforeSecSha === afterSecSha),
  };
  fs.mkdirSync(path.dirname(E505_STATE_FILE()), { recursive: true });
  fs.writeFileSync(E505_STATE_FILE(), JSON.stringify(e505State, null, 2));

  // LA-E5-21 default /healthz + production knob refusal capture
  const defaultHealthWait = await r.waitHealth(
    r.state.urls.lti,
    (h) => h.status === 'ok' && h.service === 'lti-service' && h.profile === 'default',
    60_000,
  );
  const productionKnobRun = await executeProductionKnobRefusal();
  fs.mkdirSync(path.dirname(E521_STATE_FILE()), { recursive: true });
  fs.writeFileSync(
    E521_STATE_FILE(),
    JSON.stringify(
      {
        defaultHealth: defaultHealthWait.last,
        productionKnobRun,
      },
      null,
      2,
    ),
  );

  const ok = ci.code === 0 && gen.code === 0 && up.code === 0 && seed1.code === 0 && seed2?.code === 0;
  r.record(
    'SETUP',
    'Batch 3 shared stack: npm ci, gen-env, stack:up, fresh cogniate lti:bootstrap, seed #1, seed #2, default /healthz + production knob capture',
    r.pass(ok),
    [
      `npm ci ${ci.code}, gen-env ${gen.code}, stack:up ${up.code}, fresh cogniate bootstrap ${freshCog.rawRes.code}, seed #1 ${seed1.code}, seed #2 ${seed2?.code ?? 'not run'}`,
    ],
    [ci.log, gen.log, up.log, seed1.log, seed2?.log].filter(Boolean),
  );
  if (!r.state.abort && (!r.state.urls?.lti || !r.state.ca)) r.state.abort = 'no PUBLIC_*_URL in .env or no root.crt';
  return !r.state.abort && ok;
}

await r.main(async () => {
  const started = Date.now();
  if (!(await setup())) return;
  const control = createHostControl(r, {
    'qa2-e505-bootstrap': handleBootstrapAction,
    'qa2-e505-shared-platform': handleSharedPlatformAction,
    'qa2-e521-production-knob': async (req) => {
      if (!/^[\w-]{1,64}$/.test(String(req.id))) return { code: 2 };
      const res = await executeProductionKnobRefusal();
      const out = `out-qa2-e521-${req.id}.json`;
      fs.writeFileSync(path.join(CONTROL(), out), JSON.stringify(res));
      return { code: 0, out };
    },
    'qa2-e509-write-keyring-and-restart': handleWriteKeyringAndRestart,
  });
  const stop = control.start();
  const passStart = Date.now();
  try {
    for (const [task, expect] of [
      ['LA-E5-05', EXPECT_E505],
      ['LA-E5-21', EXPECT_E521],
      ['LA-E5-10', EXPECT_E510],
      ['LA-E5-16', EXPECT_E516],
      ['LA-E5-09', EXPECT_E509],
    ]) {
      const t0 = Date.now();
      await r.containerSuite(task, { env: { QA_TASK: task } });
      r.timings[`pass_${task}_ms`] = Date.now() - t0;
      recordRows(r, task, path.join(r.ART, `container-${task}`), expect);
    }
  } finally {
    const log = stop();
    r.record(
      'HOSTCTL',
      'Host actions asked for by Batch 3 tests (qa2-e505-bootstrap, qa2-e505-shared-platform, qa2-e521-production-knob, qa2-e509-write-keyring-and-restart)',
      'PASS',
      log.length ? log : ['none'],
    );
    await restoreKeyringAndRestart();
  }
  r.timings.inContainerPassMs = Date.now() - passStart;
  r.timings.totalBeforeTeardownMs = Date.now() - started;
});
