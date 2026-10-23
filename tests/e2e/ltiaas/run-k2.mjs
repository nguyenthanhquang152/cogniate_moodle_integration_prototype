#!/usr/bin/env node
// QA-E2E host runner for LA-E7-07 K2 browser conformance kit (tests/e2e/ltiaas/*.k2.ts)
// and Slot 6 R2-sim Moodle simulator suite (--suite r2-sim, tests/e2e/ltiaas/r2-moodle-sim.spec.ts).
// Modeled directly on tests/e2e/host/run-m2.mjs.
//
//   Harness only (no Docker, no product call):
//     node tests/e2e/ltiaas/run-k2.mjs --harness-only
//   Slot 6 Docker runs (only when Lead grants DOCKER-YES):
//     COMPOSE_PROJECT_NAME=qa-e2e-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
//     COURSE_FIXTURES_DIR=/Users/quangnguyen/cogniate-qa-runs/qa-multi-r1-bf09cdad-2026-10-22T12-05-24-521Z/tests/fixtures/courses \
//     node tests/e2e/ltiaas/run-k2.mjs --suite r2-sim --sha <product-sha> --replace-tests
//
//     COMPOSE_PROJECT_NAME=qa-e2e-la-sim-r2 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
//     COURSE_FIXTURES_DIR=/Users/quangnguyen/cogniate-qa-runs/qa-multi-r1-bf09cdad-2026-10-22T12-05-24-521Z/tests/fixtures/courses \
//     node tests/e2e/ltiaas/run-k2.mjs --suite k2 --sha <product-sha> --replace-tests
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createRunner } from '../../host/core.mjs';
import { httpsLoopback, run, walkFiles } from '../../host/lib.mjs';
import { m1HostControl } from '../../host/m1-control.mjs';
import { loadManifest, verifyK2Coverage } from './coverage.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const testsDir = path.resolve(here, '..', '..');
const options = {
  'test-sha': { type: 'string' },
  'tests-from': { type: 'string' },
  'replace-tests': { type: 'boolean', default: false },
  'harness-only': { type: 'boolean', default: false },
  suite: { type: 'string', default: 'k2' },
};
const { values: opt } = parseArgs({
  strict: false,
  options: { ...options, sha: { type: 'string' }, source: { type: 'string' } },
});
const print = (line) => process.stdout.write(`${line}\n`);
const source = path.resolve(opt.source ?? path.join(testsDir, '..'));
const manifest = loadManifest();

if (opt['harness-only']) {
  const self = await run(process.execPath, [path.join(here, 'coverage.selftest.mjs')], {
    cwd: source,
    timeoutMs: 120_000,
  });
  print(self.stdout.trim());
  assert.equal(self.code, 0, self.stderr);

  const types = await run('npm', ['--prefix', testsDir, 'run', 'typecheck'], {
    cwd: source,
    timeoutMs: 300_000,
  });
  assert.equal(types.code, 0, types.stdout + types.stderr);

  const pw = path.join(testsDir, 'node_modules/.bin/playwright');
  const listed = await run(pw, ['test', '-c', 'e2e/ltiaas/playwright.config.ts', '--list'], {
    cwd: testsDir,
    timeoutMs: 120_000,
  });
  assert.equal(listed.code, 0, listed.stderr);
  const ids = [...listed.stdout.matchAll(/\{case:([A-Za-z0-9._-]+)\}/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'No duplicate discovered K2 case');
  assert.deepEqual(
    [...ids].sort(),
    manifest.cases.map((c) => c.id).sort(),
    'Discovered K2 cases equal tests/e2e/ltiaas/manifest.json',
  );

  const r2Listed = await run(pw, ['test', '-c', 'e2e/ltiaas/playwright.r2-sim.config.ts', '--list'], {
    cwd: testsDir,
    timeoutMs: 120_000,
  });
  assert.equal(r2Listed.code, 0, r2Listed.stderr);
  const r2Ids = [...r2Listed.stdout.matchAll(/\{case:(R2-SIM\.[A-Za-z0-9._-]+)\}/g)].map((m) => m[1]);
  assert.deepEqual(
    r2Ids,
    ['R2-SIM.connect-mbz-deeplink-and-grades', 'R2-SIM.grades-409-503-and-check14'],
    'Discovered R2-sim cases match expected Slot 6 Moodle-sim suite',
  );

  const t7 = await run(pw, ['test', '--list'], {
    cwd: testsDir,
    env: { ...process.env, QA_SUITE: 'e2e' },
    timeoutMs: 120_000,
  });
  assert.equal(t7.code, 0, t7.stderr);
  assert.equal(/\.k2\.ts|r2-moodle-sim\.spec\.ts/.test(t7.stdout), false, 'T7 suite never selects K2 or R2-sim files');

  const m2 = await run(pw, ['test', '-c', 'e2e/M2/playwright.config.ts', '--list'], {
    cwd: testsDir,
    timeoutMs: 120_000,
  });
  assert.equal(m2.code, 0, m2.stderr);
  assert.equal(/\.k2\.ts|r2-moodle-sim\.spec\.ts/.test(m2.stdout), false, 'M2 suite never selects K2 or R2-sim files');

  print(
    `HARNESS ONLY: ${manifest.cases.length} K2 browser cases + ${r2Ids.length} R2-sim cases discovered and accounted; T7 and M2 selections unchanged.`,
  );
  print('No product acceptance, stack or live provider check was executed.');
  process.exit(0);
}

const suiteMode = opt.suite === 'r2-sim' ? 'r2-sim' : 'k2';
const defaultProject = suiteMode === 'r2-sim' ? 'qa-e2e-la-sim-r1' : 'qa-e2e-la-sim-r2';
assert.ok(opt.sha, 'Product --sha is required');
const resolvedProduct = await run('git', ['rev-parse', `${opt.sha}^{commit}`], { cwd: source });
assert.equal(resolvedProduct.code, 0, `Could not resolve --sha ${opt.sha}`);
const productSha = resolvedProduct.stdout.trim();
const testSha = opt['test-sha'] ? (await run('git', ['rev-parse', `${opt['test-sha']}^{commit}`], { cwd: source })).stdout.trim() : productSha;

const r = createRunner({ task: suiteMode === 'r2-sim' ? 'LA-E7-09' : 'LA-E7-07', defaultProject, extraOptions: options });
const COURSES = {
  'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-scorm-v2.zip':
    'a685744e5fd9de21c203c3b2f47916ef1079532196ed870df89a00ab8ee76df7',
  'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-html.zip':
    '9f04d3abd65f85e362b2dca5207cc4b86ffa286e4b1a73923c157b69321f3f6d',
};
const compose = ['compose', '-p', r.PROJECT, '-f', 'infra/compose.yaml', '--env-file', '.env'];

async function installTests() {
  if (opt['replace-tests'] || opt['tests-from']) {
    const fromTests = path.resolve(opt['tests-from'] ?? testsDir);
    const destTests = path.join(r.CLONE, 'tests');
    fs.rmSync(destTests, { recursive: true, force: true });
    fs.cpSync(fromTests, destTests, { recursive: true });
    return;
  }
  const archive = path.join(path.dirname(r.CLONE), `${path.basename(r.CLONE)}-tests.tar`);
  assert.equal((await run('git', ['archive', '--format=tar', '--output', archive, testSha, 'tests'], { cwd: source })).code, 0);
  try {
    assert.equal((await r.exec('install-frozen-tests', 'tar', ['-xf', archive, '-C', r.CLONE])).code, 0);
  } finally {
    fs.rmSync(archive, { force: true });
  }
}

function copyCourses() {
  const folder = process.env.COURSE_FIXTURES_DIR;
  assert.ok(folder, 'COURSE_FIXTURES_DIR is required (U3 and R2-sim publish the real course packages)');
  const dest = path.join(r.CLONE, 'tests/fixtures/courses');
  fs.mkdirSync(dest, { recursive: true });
  for (const [name, digest] of Object.entries(COURSES)) {
    const bytes = fs.readFileSync(path.join(folder, name));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), digest, name);
    fs.writeFileSync(path.join(dest, name), bytes);
  }
}

async function volumesAndContainers() {
  const vols = await run('docker', ['volume', 'ls', '--format', '{{.Name}}|{{.Label "com.docker.compose.project"}}']);
  const ctrs = await run('docker', ['ps', '-a', '--format', '{{.ID}}|{{.Status}}|{{.Label "com.docker.compose.project"}}']);
  const other = (text) =>
    text
      .split('\n')
      .filter(Boolean)
      .filter((line) => !line.endsWith(`|${r.PROJECT}`))
      .sort();
  return {
    volumes: other(vols.stdout),
    containers: other(ctrs.stdout).map((l) => l.replace(/\|Up [^|]*/, '|Up')),
  };
}

async function simSecrets() {
  const script =
    "const h=require('https'),f=require('fs');h.get({host:'127.0.0.1',port:443,path:'/__sim/secrets',servername:'lms-sim.test'," +
    "headers:{host:'lms-sim.test'},ca:f.readFileSync(process.env.CA_FILE)},(s)=>{let b='';s.on('data',(c)=>b+=c);s.on('end',()=>process.stdout.write(b))})" +
    ".on('error',(e)=>{process.stderr.write(e.message);process.exit(1)})";
  const res = await run('docker', [...compose, 'exec', '-T', 'lms-sim', 'node', '-e', script], {
    cwd: r.CLONE,
    env: r.STACK_ENV,
    timeoutMs: 60_000,
  });
  assert.equal(res.code, 0, 'Simulator secret capture failed');
  return JSON.parse(res.stdout).values.filter((v) => typeof v === 'string' && v.length >= 8);
}

function clonedValues() {
  const dir = path.join(r.CLONE, 'tests/acceptance/artifacts');
  const values = [];
  for (const name of ['m1-secrets.raw.jsonl', 'captured-secrets.jsonl']) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
      const v = JSON.parse(line);
      const value = typeof v === 'string' ? v : v.value;
      if (typeof value === 'string' && value.length >= 8) values.push(value);
    }
  }
  return values;
}

await r.main(async () => {
  const before = await volumesAndContainers();
  await installTests();
  copyCourses();
  assert.equal((await r.npm('root-ci', ['ci', '--no-audit', '--no-fund'], { timeoutMs: 900_000 })).code, 0);
  assert.equal((await r.npm('gen-env', ['run', 'gen-env'])).code, 0);
  r.loadStackFiles();
  await r.composeNameGuard();
  assert.equal(r.state.abort, null, 'compose name guard');
  assert.equal(
    (await r.npm('stack-up-acceptance', ['run', 'stack:up'], { env: { ...r.STACK_ENV, STACK_PROFILE: 'acceptance' }, timeoutMs: 900_000 }))
      .code,
    0,
  );
  assert.equal((await r.npm('seed', ['run', 'seed'], { timeoutMs: 900_000 })).code, 0);
  r.loadStackFiles();
  await r.checkProject();
  assert.ok(r.state.h1Verified, 'QA project guard');

  const lti = await r.healthz(r.state.urls.lti);
  const appHealth = await r.healthz(r.state.urls.app);
  assert.equal(lti?.profile, 'acceptance');
  assert.equal(appHealth?.profile, 'acceptance');

  const apiKey = fs.readFileSync(path.join(r.CLONE, 'infra/.secrets/lti-api-key.cogniate'), 'utf8').trim();
  r.redact.add(apiKey);
  const providers = await httpsLoopback(`${r.state.urls.lti}/api/providers`, {
    ca: r.state.ca,
    headers: { authorization: `Bearer ${apiKey}` },
  });
  assert.equal(providers.status, 200, 'GET /api/providers');
  assert.deepEqual([lti?.knobs, appHealth?.knobs], [[], []]);

  const pwConfig = suiteMode === 'r2-sim' ? 'e2e/ltiaas/playwright.r2-sim.config.ts' : 'e2e/ltiaas/playwright.config.ts';
  const artSub = suiteMode === 'r2-sim' ? 'r2-sim' : 'k2';
  const inside =
    'set -euo pipefail; source infra/scripts/lib.sh; require_running proxy; prepare_e2e; qa_env_args; ' +
    `dc --profile test run --rm --no-deps --name "$COMPOSE_PROJECT_NAME-qa-${artSub}-$$" --build "\${QA_ENV_ARGS[@]+"\${QA_ENV_ARGS[@]}"}" e2e sh -c ` +
    `'npm ci --prefix tests --no-audit --no-fund && cd tests && ./node_modules/.bin/playwright test -c ${pwConfig}'`;

  const stop = m1HostControl(r);
  let pass;
  try {
    pass = await r.exec(`${artSub}-browser-pass`, 'bash', ['-c', inside], {
      env: { ...r.STACK_ENV, QA_PRODUCT_SHA: productSha, QA_TEST_SHA: testSha },
      timeoutMs: 7_200_000,
    });
  } finally {
    await stop();
  }

  const values = [...new Set([...(await simSecrets()), ...clonedValues()])];
  for (const v of values) r.redact.add(v);

  const reportFile = path.join(r.CLONE, `tests/e2e/artifacts/${artSub}/playwright.json`);
  assert.ok(fs.existsSync(reportFile), `No ${artSub} Playwright report at ${reportFile}`);
  const parsedReport = JSON.parse(fs.readFileSync(reportFile, 'utf8'));

  if (suiteMode === 'k2') {
    const cov = verifyK2Coverage(parsedReport, manifest);
    r.saveText('k2-case-results.json', JSON.stringify(cov, null, 2));
    for (const row of cov.rows) r.record(row.id, row.title, row.status === 'passed' ? 'PASS' : 'FAIL');
    assert.ok(cov.ok, `K2 coverage problems: ${cov.problems.join('; ')}`);
  }

  let hits = 0;
  const scanned = [
    ...walkFiles(path.join(r.CLONE, 'infra/.logs')).filter((f) => f.endsWith('.jsonl')),
    ...walkFiles(r.ART).filter((f) => /\.(json|jsonl|log|txt)$/.test(f)),
  ];
  for (const file of scanned) {
    const text = fs.readFileSync(file, 'utf8');
    for (const v of values) if (text.includes(v)) hits++;
  }
  r.saveText(`${artSub}-secret-scan.json`, JSON.stringify({ capturedValues: values.length, checkedFiles: scanned.length, hits }));
  r.record(
    `M3-07-${artSub.toUpperCase()}`,
    'Zero captured-secret hits in service, simulator and gate logs and in redacted evidence',
    hits === 0 ? 'PASS' : 'FAIL',
    [`values ${values.length}, files ${scanned.length}, hits ${hits}`],
  );
  const after = await volumesAndContainers();
  r.record(
    `M3-06-${artSub.toUpperCase()}`,
    'Baseline volumes and other containers unchanged',
    JSON.stringify(after) === JSON.stringify(before) ? 'PASS' : 'FAIL',
    [`volumes ${before.volumes.length} → ${after.volumes.length}; containers ${before.containers.length} → ${after.containers.length}`],
  );
  assert.equal(pass.code, 0, 'Playwright pass exit code');
});
