#!/usr/bin/env node
// QA-2 runner for LA-E5-23:
// - Host-only K0 + UNIT mode (LA_LEVEL=k0): runs async-store.k0.test.ts (AC-LA-E5-23-01..03, atomic audited ops, F5 rules).
// - SIM slot mode (AC-LA-E5-23-04, R2 LTI service area): runs G1-G4 golden capture + compare vs G-BASE,
//   T2a, T2b, T3a, T3b, T3c, and M1 sim phase on the booked qa2-la-sim-r2 stack.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');

if ((process.env.LA_LEVEL ?? '').toLowerCase() === 'k0') {
  fs.rmSync(path.join(ROOT, 'node_modules', '.vitest-cache'), { recursive: true, force: true });
  fs.rmSync(path.join(ROOT, 'node_modules', '.vite'), { recursive: true, force: true });
  const res = spawnSync(
    './tests/node_modules/.bin/vitest',
    ['run', '-c', 'tests/ltiaas/tasks-ops/LA-E5-23/vitest.config.mts', '--reporter=verbose'],
    { cwd: ROOT, stdio: 'inherit', env: { ...process.env, LA_LEVEL: 'k0' } },
  );
  process.exit(res.status ?? 1);
}

const { createRunner } = await import('../../../host/core.mjs');
const { allContainers, httpsLoopback, run, secretsInFile, walkFiles } = await import('../../../host/lib.mjs');
const { m1HostControl } = await import('../../../host/m1-control.mjs');
const { casePattern, phaseRows } = await import('../../../host/m1-phases.mjs');
const { readManifests, vitestResults } = await import('../../../acceptance/M1/common/coverage.mjs');
const { BASELINE_REAL_PROFILES, appLmsProviders, checkProfiles, registeredChannels, seedPortalUser } = await import(
  '../../lib/open-world.mjs'
);
const { secretScan } = await import('../../golden/lib/normalize.mjs');
const { compareCaptures, loadCapture, loadExpectedDelta, report } = await import('../../golden/lib/compare.mjs');

const TASK = 'LA-E5-23';
const r = createRunner({
  task: TASK,
  defaultProject: 'qa2-la-sim-r2',
  extraOptions: {
    'golden-out': { type: 'string' },
    'test-sha': { type: 'string' },
    'deadline-utc': { type: 'string' },
  },
  extraHelp:
    '  --golden-out <dir>          Optional output directory for normalized G1-G4 golden files.\n' +
    '  --test-sha <40-hex>         Optional frozen test SHA for M1 sim phase.\n' +
    '  --deadline-utc <ISO>        Optional UTC deadline ISO timestamp before starting M1 sim phase.\n',
});

const EXPECT = {
  T2a: [
    'AC-T2-01',
    'AC-T2-02',
    'AC-T2-03',
    'AC-T2-04',
    'AC-T2-05',
    'AC-T2-06',
    'AC-T2-08',
    'AC-T2-12',
    'AC-T2-13',
    'AC-T2-14',
    'AC-T2-15',
    'AC-T2-16',
    'AC-T2-18',
    'AC-T2-19',
    'AC-T2-29',
    'AC-T2-31',
  ],
  T2b: [
    'AC-T2-09',
    'AC-T2-10',
    'AC-T2-11',
    'AC-T2-20',
    'AC-T2-21',
    'AC-T2-22',
    'AC-T2-23',
    'AC-T2-24',
    'AC-T2-25',
    'AC-T2-26',
    'AC-T2-27',
    'AC-T2-28',
    'AC-T2-30',
    'AC-T2-32',
  ],
  T3a: [
    'AC-T3-06',
    'AC-T3-07',
    'AC-T3-08',
    'AC-T3-10',
    'AC-T3-11',
    'AC-T3-12',
    'AC-T3-13',
    'AC-T3-14',
    'AC-T3-16',
    'AC-T3-17',
    'AC-T3-18',
    'AC-T3-22',
    'AC-T3-23',
    'AC-T3-24',
  ],
  T3b: [
    'AC-T3-01',
    'AC-T3-02',
    'AC-T3-03',
    'AC-T3-04',
    'AC-T3-05',
    'AC-T3-25',
    'AC-T3-26',
    'AC-T3-28',
    'AC-T3-29',
    'AC-T3-30',
  ],
  T3c: ['AC-T3-09', 'AC-T3-15', 'AC-T3-20', 'AC-T3-21', 'AC-T3-31', 'AC-T3-27', 'AC-T3-19'],
};

const GOLDEN_BASE_SHA = '1b17261be97c4701b928fa9dc2fa74c6d23028f6';
const GOLDEN_EXPECTED_IDS = [
  'LA-IC-01',
  'LA-IC-03',
  'LA-IC-04',
  'LA-IC-12',
  'LA-IC-13',
  'LA-IC-14',
  'LA-IC-15',
  'LA-IC-16',
  'LA-IC-17',
  'LA-IC-18',
  'LA-IC-19',
  'LA-IC-20',
  'LA-IC-21',
];

const compose = ['compose', '-p', r.PROJECT, '-f', 'infra/compose.yaml', '--env-file', '.env'];
const CONTROL = () => path.join(r.CLONE, 'tests', 'acceptance', 'artifacts', 'control');

function ltiSeedOf() {
  return r.state.rawSeed?.ltiSeed ?? null;
}

async function seedLtiManual(label) {
  const res = await r.npm(`seed-lti-manual-${label}`, ['run', 'seed:lti-manual'], { timeoutMs: 600_000 });
  r.loadStackFiles();
  return { code: res.code, log: res.log, ltiSeed: ltiSeedOf() };
}

async function setup() {
  const ci = await r.npm('root-npm-ci', ['ci', '--no-audit', '--no-fund'], { timeoutMs: 900_000 });
  const gen = await r.npm('gen-env', ['run', 'gen-env']);
  r.loadStackFiles();
  await r.composeNameGuard();
  if (r.state.abort) return false;
  const up = await r.npm('stack-up-default', ['run', 'stack:up'], {
    env: { ...r.STACK_ENV, STACK_PROFILE: 'default' },
    timeoutMs: 900_000,
  });
  const seed = up.code === 0 ? await r.npm('seed', ['run', 'seed'], { timeoutMs: 900_000 }) : null;
  r.loadStackFiles();
  r.record(
    'SETUP',
    'npm ci, gen-env, stack:up (default), seed',
    r.pass(ci.code === 0 && gen.code === 0 && up.code === 0 && seed?.code === 0),
    [`npm ci ${ci.code}, gen-env ${gen.code}, stack:up ${up.code}, seed ${seed?.code ?? 'not run'}`],
    [ci.log, gen.log, up.log, seed?.log].filter(Boolean),
  );
  await r.checkProject();
  if (!r.state.abort && (!r.state.urls?.lti || !r.state.ca)) {
    r.state.abort = 'no PUBLIC_*_URL in .env or no root.crt';
  }
  return !r.state.abort && up.code === 0 && seed?.code === 0;
}

async function readGoldenDefaultAndM1DefaultGate() {
  const key = fs.readFileSync(path.join(r.CLONE, 'infra/.secrets/lti-api-key.cogniate'), 'utf8').trim();
  r.redact.add(key);
  const get = async (url, headers = {}) => {
    const res = await httpsLoopback(url, { ca: r.state.ca, headers });
    assert.equal(res.status, 200, url);
    return JSON.parse(res.body);
  };
  const defaults = {
    providers: await get(r.state.urls.lti + '/api/providers', { authorization: 'Bearer ' + key }),
    lmsProviders: await appLmsProviders(httpsLoopback, {
      appUrl: r.state.urls.app,
      ca: r.state.ca,
      user: seedPortalUser(r.state.rawSeed),
    }),
    ltiHealth: await get(r.state.urls.lti + '/healthz'),
    appHealth: await get(r.state.urls.app + '/healthz'),
  };
  assert.equal(defaults.ltiHealth.profile, 'default');
  assert.equal(defaults.appHealth.profile, 'default');
  const tmp = path.join(r.CLONE, 'tests/.tmp');
  fs.mkdirSync(tmp, { recursive: true });
  fs.writeFileSync(path.join(tmp, 'golden-default.json'), JSON.stringify(defaults), { mode: 0o600 });
  r.record(
    'GOLDEN-DEFAULT',
    'G1 default profile answers read (providers, lms-providers, both /healthz)',
    'PASS',
    [`profiles ${defaults.providers.profiles.length}; lms ${defaults.lmsProviders.lms.map((e) => e.lms).join(',')}`],
  );

  // M1-02.common.default-profile gate on default stack
  assert.deepEqual(defaults.ltiHealth.knobs, []);
  assert.deepEqual(defaults.appHealth.knobs, []);
  assert.deepEqual(defaults.ltiHealth.simulation_profiles, []);
  const services = (await allContainers())
    .filter((c) => c.Config?.Labels?.['com.docker.compose.project'] === r.PROJECT)
    .map((c) => c.Config.Labels['com.docker.compose.service']);
  assert.ok(!services.includes('lms-sim') && !services.includes('lti-gate'), 'No simulation containers in the default stack');
  checkProfiles(defaults.providers.profiles, BASELINE_REAL_PROFILES, {
    registered: registeredChannels(defaults.lmsProviders),
    realOnly: true,
  });
  for (const profile of ['blackboard-sim', 'canvas-sim-cloud', 'nope']) {
    const res = await httpsLoopback(r.state.urls.lti + '/api/platforms', {
      method: 'POST',
      ca: r.state.ca,
      headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: JSON.stringify({ profile, clientId: 'gate-test', name: 'gate-test' }),
    });
    const body = JSON.parse(res.body);
    assert.equal(res.status, 400);
    assert.equal(body.details.message, 'UNKNOWN_PROFILE');
  }
  r.record(
    'M1-02.common.default-profile',
    'Default stack exposes the six baseline real profiles (LD-1 open world), no simulation profiles or helper containers',
    'PASS',
    ['default profile verified on lti-service and cogniate-app'],
  );
}

async function runGoldenCaptureAndCompare() {
  const t0 = Date.now();
  const label = 'la-e5-23-r2';
  const outDir = r.opt['golden-out'] ? path.resolve(r.opt['golden-out']) : path.join(r.ART, 'golden');
  const upAcc = await r.npm('stack-up-acceptance-golden', ['run', 'stack:up'], {
    env: { ...r.STACK_ENV, STACK_PROFILE: 'acceptance' },
    timeoutMs: 900_000,
  });
  assert.equal(upAcc.code, 0, 'stack:up acceptance for golden');
  r.loadStackFiles();
  await r.checkProject();
  assert.ok(r.state.h1Verified, 'QA project guard after acceptance profile change');

  const inside =
    'set -euo pipefail; source infra/scripts/lib.sh; require_running proxy; prepare_e2e; qa_env_args; ' +
    'dc --profile test run --rm --no-deps --name "$COMPOSE_PROJECT_NAME-qa-golden-$$" --build "${QA_ENV_ARGS[@]+"${QA_ENV_ARGS[@]}"}" e2e sh -c ' +
    "'npm ci --prefix tests --no-audit --no-fund && cd tests && node node_modules/vitest/vitest.mjs run --config ltiaas/golden/vitest.config.mts'";
  const stop = m1HostControl(r);
  const captureStart = Date.now();
  let pass;
  try {
    pass = await r.exec('golden-capture', 'bash', ['-c', inside], {
      env: {
        ...r.STACK_ENV,
        QA_GOLDEN_LABEL: label,
        QA_GOLDEN_DEFAULT: '/repo/tests/.tmp/golden-default.json',
      },
      timeoutMs: 3_600_000,
    });
  } finally {
    await stop();
  }
  const captureMs = Date.now() - captureStart;
  const from = path.join(r.CLONE, 'tests/acceptance/artifacts/golden', label);
  r.record(
    'GOLDEN-CAPTURE',
    'Capture script in the e2e container (G1-G4)',
    r.pass(pass.code === 0),
    [`exit ${pass.code}; ${Math.round(captureMs / 1000)} s`],
    [pass.log].filter(Boolean),
  );
  if (pass.code !== 0) return false;

  const secrets = [];
  for (const file of walkFiles(path.join(r.CLONE, 'infra/.secrets'))) {
    for (const item of secretsInFile(file).items) secrets.push(item.value);
  }
  for (const name of ['m1-secrets.raw.jsonl', 'captured-secrets.jsonl']) {
    const file = path.join(r.CLONE, 'tests/acceptance/artifacts', name);
    if (fs.existsSync(file)) {
      for (const line of fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
        const v = JSON.parse(line);
        secrets.push(typeof v === 'string' ? v : v.value);
      }
    }
  }
  const files = ['G1', 'G2', 'G3', 'G4'].map((g) => [g, fs.readFileSync(path.join(from, `${g}.json`), 'utf8')]);
  const hits = secretScan(files, secrets);
  r.record(
    'GOLDEN-SECRET-SCAN',
    'Zero secret hits in the normalized G1-G4 (K-HYG method)',
    r.pass(hits.length === 0),
    [`values ${new Set(secrets.filter((s) => typeof s === 'string' && s.length >= 8)).size}; hits ${hits.length}`],
  );
  assert.deepEqual(hits, []);

  fs.mkdirSync(outDir, { recursive: true });
  for (const [g, text] of files) fs.writeFileSync(path.join(outDir, `${g}.json`), text);
  const stats = JSON.parse(fs.readFileSync(path.join(from, 'capture-stats.json'), 'utf8'));
  const head = (await run('git', ['rev-parse', 'HEAD'], { cwd: r.CLONE })).stdout.trim();
  fs.writeFileSync(
    path.join(outDir, 'meta.json'),
    JSON.stringify(
      {
        goldenVersion: 1,
        productSha: head,
        label,
        project: r.PROJECT,
        capturedAt: new Date().toISOString(),
        captureSeconds: Math.round(captureMs / 1000),
        totalSeconds: Math.round((Date.now() - t0) / 1000),
        normalization: stats.stats,
        secretValuesChecked: new Set(secrets.filter((s) => typeof s === 'string' && s.length >= 8)).size,
        secretHits: 0,
      },
      null,
      2,
    ) + '\n',
  );

  // Compare against G-BASE with approved LA-IC-* expected deltas
  const baseDir = path.join(r.QA_TESTS_DIR, 'ltiaas/golden', GOLDEN_BASE_SHA);
  const expectedDir = path.join(r.QA_TESTS_DIR, 'ltiaas/golden/expected');
  const simHostsFile = path.join(r.QA_TESTS_DIR, 'sim/hosts.json');
  const base = loadCapture(baseDir);
  const candidate = loadCapture(outDir);
  const expected = GOLDEN_EXPECTED_IDS.map((id) => loadExpectedDelta(id, expectedDir));
  const cmp = compareCaptures(base, candidate, expected, { simHosts: simHostsFile });
  const unexplained = cmp.differences.filter((d) => !d.explainedBy);
  const cmpLog = path.join(r.ART, 'golden-compare.txt');
  fs.writeFileSync(
    cmpLog,
    [
      ...report(cmp),
      `${cmp.ok ? 'EQUAL' : 'DIFFERENT'}: ${cmp.differences.length} differences (${unexplained.length} not explained), ${cmp.missing.length} expected changes missing`,
    ].join('\n') + '\n',
  );
  r.record(
    'AC-LA-E5-23-04',
    `Golden G1-G4 compare against G-BASE (${GOLDEN_BASE_SHA.slice(0, 8)}): 0 unexplained differences, 0 missing expected changes`,
    r.pass(cmp.ok),
    [
      `differences: ${cmp.differences.length} (unexplained: ${unexplained.length}); missing expected: ${cmp.missing.length}`,
      `golden out: ${outDir}`,
    ],
    [path.relative(r.QA_TESTS_DIR, cmpLog)],
  );
  return cmp.ok;
}

async function runT2AndT3Suites() {
  // Restore default profile before T2/T3
  await r.npm('stack-up-default-before-t2', ['run', 'stack:up'], {
    env: { ...r.STACK_ENV, STACK_PROFILE: 'default' },
    timeoutMs: 900_000,
  });

  // 1. AC-T2-31 (first part): seed:lti-manual twice gives the same ltiSeed values
  const a = await seedLtiManual('1');
  const b = await seedLtiManual('2');
  const same = a.ltiSeed !== null && JSON.stringify(a.ltiSeed) === JSON.stringify(b.ltiSeed);
  r.record(
    'AC-T2-31',
    'seed:lti-manual twice gives the same ltiSeed values',
    r.pass(a.code === 0 && b.code === 0 && same),
    [`exit ${a.code} and ${b.code}; second run ${same ? 'equal' : 'DIFFERENT'}`],
    [a.log, b.log],
  );
  if (a.code !== 0 || !a.ltiSeed) return false;

  // 2. Pass A: T2a,T2b,T3a,T3b
  const TASKS = ['T2a', 'T2b', 'T3a', 'T3b'];
  const { tests } = await r.containerSuite('passA-T2a-T2b-T3a-T3b', {
    env: { QA_TASK: TASKS.join(',') },
    expectIds: TASKS.flatMap((t) => EXPECT[t] ?? []),
  });
  const inScope = /^(AC-T(2|3)-|SETUP-)/;
  const others = tests.filter((t) => !inScope.test(t.id) && t.id !== 'H6');
  r.record(
    'H14',
    `npm run test:acceptance forwards QA_TASK=${TASKS.join(',')} into the e2e container`,
    r.pass(tests.length > 0 && others.length === 0),
    [`tests reported: ${tests.length}; outside ${TASKS.join(',')}: ${others.length}`],
  );
  const lti = await r.healthz(r.state.urls.lti);
  const app = await r.healthz(r.state.urls.app);
  r.record(
    'AC-T2-30',
    '/healthz shows "profile": "default" after npm run test:acceptance ends',
    r.pass(lti?.profile === 'default' && app?.profile === 'default'),
    [`lti-service profile ${lti?.profile ?? 'n/a'}, cogniate-app profile ${app?.profile ?? 'n/a'}`],
  );

  // 3. Knob pass (AC-T2-07)
  const knob = (body) =>
    (body.knobs ?? []).some((k) => (k.name ?? k) === 'LTIK_TTL_SECONDS' && String(k.value ?? '') === '20');
  const on = await r.npm(
    'restart-lti-knob',
    ['run', 'stack:restart', '--', 'lti-service', '--env', 'LTIK_TTL_SECONDS=20'],
    { timeoutMs: 300_000 },
  );
  const active = await r.waitHealth(r.state.urls.lti, knob);
  r.record(
    'KNOB',
    'stack:restart -- lti-service --env LTIK_TTL_SECONDS=20 activates the knob',
    r.pass(on.code === 0 && active.ok),
    [`exit ${on.code}`],
    [on.log],
  );
  try {
    const { tests: knobTests } = await r.containerSuite('knob-AC-T2-07', {
      env: { QA_TASK: 'T2a', QA_GREP: 'AC-T2-07' },
      expectIds: ['AC-T2-07'],
    });
    const ran = knobTests.filter((t) => t.status !== 'SKIP').map((t) => t.id);
    r.record(
      'H14',
      'QA_GREP=AC-T2-07 is forwarded (the knob pass ran only AC-T2-07)',
      r.pass(ran.length > 0 && ran.every((id) => id === 'AC-T2-07')),
      [`ran: ${ran.join(', ') || 'none'}`],
    );
  } finally {
    const off = await r.npm('restart-lti-default', ['run', 'stack:restart', '--', 'lti-service'], {
      timeoutMs: 300_000,
    });
    const cleared = await r.waitHealth(r.state.urls.lti, (body) => Array.isArray(body.knobs) && body.knobs.length === 0);
    r.record(
      'KNOB',
      'stack:restart -- lti-service restores knobs: []',
      r.pass(off.code === 0 && cleared.ok),
      [`exit ${off.code}`],
      [off.log],
    );
  }

  // 4. AC-T2-31 after reset (stack:reset, stack:up, seed, seed:lti-manual, passC)
  const reset = await r.npm('stack-reset', ['run', 'stack:reset'], { timeoutMs: 600_000 });
  const up = reset.code === 0 ? await r.npm('stack-up-after-reset', ['run', 'stack:up'], { timeoutMs: 900_000 }) : null;
  const seed = up?.code === 0 ? await r.npm('seed-after-reset', ['run', 'seed'], { timeoutMs: 900_000 }) : null;
  const ltiAfter = seed?.code === 0 ? await seedLtiManual('after-reset') : null;
  r.record(
    'AC-T2-31',
    'After stack:reset, stack:up, seed, seed:lti-manual: seed.json has ltiSeed again',
    r.pass(ltiAfter?.code === 0 && ltiAfter.ltiSeed !== null),
    [`reset ${reset.code}, up ${up?.code ?? '-'}, seed ${seed?.code ?? '-'}, seed:lti-manual ${ltiAfter?.code ?? '-'}`],
    [reset.log, up?.log, seed?.log, ltiAfter?.log].filter(Boolean),
  );
  if (ltiAfter?.code === 0) {
    await r.containerSuite('passC-AC-T2-03-31', {
      env: { QA_TASK: 'T2a', QA_GREP: 'AC-T2-03|AC-T2-31' },
      expectIds: ['AC-T2-03', 'AC-T2-31'],
    });
  }

  // 5. T3a,T3c on the freshly reset and seeded stack
  const ACTIONS = {
    'seed-lti-manual': async () => {
      const res = await r.npm('seed-lti-manual-again', ['run', 'seed:lti-manual'], { timeoutMs: 600_000 });
      r.loadStackFiles();
      return { code: res.code };
    },
    'compat-run': async (req) => {
      const name = String(req.input ?? '');
      if (!/^compat-input-[\w-]+\.json$/.test(name)) return { code: 2 };
      const file = path.join(CONTROL(), name);
      let data;
      try {
        data = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch {
        return { code: 2 };
      }
      for (const v of [data.studentLtik, data.deepLinkLtik]) if (typeof v === 'string' && v) r.redact.add(v);
      const env = {
        ...r.STACK_ENV,
        COMPAT_INPUT_FILE: file,
        QA_COMPAT_STUDENT_LTIK: String(data.studentLtik ?? ''),
        QA_COMPAT_DEEPLINK_LTIK: String(data.deepLinkLtik ?? ''),
        QA_COMPAT_RUN_ID: String(data.runId ?? ''),
        QA_COMPAT_EXPECT: JSON.stringify(data.expect ?? {}),
      };
      const res = await r.npm('test-compat', ['run', 'test:compat'], { env, timeoutMs: 780_000 });
      const out = name.replace(/^compat-input-/, 'compat-out-').replace(/\.json$/, '.txt');
      fs.writeFileSync(path.join(CONTROL(), out), r.redact.apply(`${res.stdout}\n--- stderr\n${res.stderr}`));
      return { code: res.code, out };
    },
  };

  function startHostControl() {
    const dir = CONTROL();
    const done = new Set();
    const log = [];
    let busy = false;
    const timer = setInterval(async () => {
      if (busy || !fs.existsSync(dir)) return;
      const next = fs
        .readdirSync(dir)
        .filter((f) => /^req-[\w-]+\.json$/.test(f))
        .sort()
        .find((f) => !done.has(f));
      if (!next) return;
      busy = true;
      done.add(next);
      let req;
      try {
        req = JSON.parse(fs.readFileSync(path.join(dir, next), 'utf8'));
      } catch {
        req = { id: next.slice(4, -5), action: 'invalid' };
      }
      const startedAt = Date.now();
      const fn = ACTIONS[req.action];
      let res;
      try {
        res = fn ? await fn(req) : { code: 2 };
      } catch (err) {
        res = { code: 3, error: String(err) };
      }
      const answer = {
        action: req.action,
        ok: Boolean(fn) && res.code === 0,
        code: res.code,
        startedAt,
        endedAt: Date.now(),
        ...(res.out ? { out: res.out } : {}),
      };
      fs.writeFileSync(path.join(dir, `ack-${req.id}.json`), JSON.stringify(answer));
      log.push(
        `${new Date(startedAt).toISOString()} ${req.action}: exit ${res.code} in ${answer.endedAt - startedAt} ms`,
      );
      busy = false;
    }, 500);
    return () => {
      clearInterval(timer);
      return log;
    };
  }

  const stopT3c = startHostControl();
  try {
    await r.containerSuite('T3c', {
      env: { QA_TASK: 'T3a,T3c' },
      expectIds: [...EXPECT.T3a, ...EXPECT.T3c],
    });
  } finally {
    const log = stopT3c();
    r.record(
      'HOSTCTL',
      'Host actions asked for by the T3c tests (whitelist: npm run test:compat, npm run seed:lti-manual)',
      'PASS',
      log.length ? log : ['none'],
    );
  }
  return true;
}

async function runM1SimIfTimePermits() {
  const deadlineMs = r.opt['deadline-utc'] ? Date.parse(r.opt['deadline-utc']) : Date.now() + 3_600_000;
  // Require at least 8 minutes before deadline so stack reset + M1 sim + teardown finish cleanly inside the slot window.
  if (Date.now() + 8 * 60_000 > deadlineMs) {
    r.record(
      'INFO',
      `M1 sim phase skipped due to slot window time budget (now ${new Date().toISOString()}, deadline ${r.opt['deadline-utc']})`,
      'INFO',
    );
    return;
  }
  // Reset and re-seed before M1 sim so prior T2/T3 rate-limit buckets and service logs do not carry over.
  const reset = await r.npm('stack-reset-before-m1', ['run', 'stack:reset'], { timeoutMs: 600_000 });
  const up = reset.code === 0 ? await r.npm('stack-up-before-m1', ['run', 'stack:up'], { timeoutMs: 900_000 }) : null;
  const seed = up?.code === 0 ? await r.npm('seed-before-m1', ['run', 'seed'], { timeoutMs: 900_000 }) : null;
  if (seed?.code !== 0) return;
  r.loadStackFiles();
  const head = (await run('git', ['rev-parse', 'HEAD'], { cwd: r.CLONE })).stdout.trim();
  const testSha = r.opt['test-sha'] ?? head;
  const identity = { productSha: head, testSha };
  const manifests = readManifests(r.QA_TESTS_DIR, ['common', 'blackboard', 'canvas']);
  const simApiCases = phaseRows(manifests, 'sim').filter((row) => row.kind === 'api');
  const artifactDir = path.join(r.CLONE, 'tests/acceptance/artifacts');
  const reportFile = path.join(artifactDir, 'm1-vitest-results.json');
  fs.rmSync(reportFile, { force: true });

  const stop = m1HostControl(r);
  let res;
  try {
    res = await r.exec('m1-sim-suite', 'npm', ['run', 'test:acceptance'], {
      env: {
        ...r.STACK_ENV,
        QA_TASK: 'M1',
        QA_M1_PROVIDER: 'all',
        QA_GREP: casePattern(simApiCases),
        QA_PRODUCT_SHA: identity.productSha,
        QA_TEST_SHA: identity.testSha,
      },
      timeoutMs: 1_800_000,
    });
  } finally {
    await stop();
  }
  for (const name of ['m1-secrets.raw.jsonl', 'captured-secrets.jsonl']) {
    const file = path.join(artifactDir, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
      const value = JSON.parse(line);
      const secret = typeof value === 'string' ? value : value.value;
      r.redact.add(secret);
    }
  }
  const actual = fs.existsSync(reportFile)
    ? vitestResults(JSON.parse(fs.readFileSync(reportFile, 'utf8')), simApiCases, identity, { partial: true })
    : [];
  const passed = actual.filter((row) => row.status === 'PASS').length;
  const failed = actual.filter((row) => row.status !== 'PASS');
  r.record(
    'AC-LA-E5-23-04-M1-SIM',
    `M1 sim API regression (${passed}/${simApiCases.length} passed)`,
    r.pass(res.code === 0 && passed === simApiCases.length && failed.length === 0),
    [
      `exit ${res.code}; passed ${passed}/${simApiCases.length}; failed ${failed.length}${
        failed.length ? ` (${failed.map((f) => f.id).join(', ')})` : ''
      }`,
    ],
    [res.log].filter(Boolean),
  );
}

await r.main(async () => {
  if (!(await setup())) return;
  await readGoldenDefaultAndM1DefaultGate();
  await runGoldenCaptureAndCompare();
  await runT2AndT3Suites();
  await runM1SimIfTimePermits();
});
