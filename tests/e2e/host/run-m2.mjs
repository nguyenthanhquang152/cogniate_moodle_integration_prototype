#!/usr/bin/env node
// QA-E2E host runner for M2 (portal browser suite in tests/e2e/M2, label SIM). Node built-ins only.
//
//   Harness only (no Docker, no product call):
//     node tests/e2e/host/run-m2.mjs --harness-only
//   Product run (Lead-reserved lane, frozen 40-character SHAs, tests committed at the test SHA):
//     COMPOSE_PROJECT_NAME=qa-e2e-m2-r1 PUBLIC_PORT=8643 STACK_SUBNET=172.27.0.0/16 \
//     COURSE_FIXTURES_DIR=<dir with the two course zips> \
//     node tests/e2e/host/run-m2.mjs --sha <product sha> --test-sha <test sha>
//
// Steps: preflight → clone → frozen tests → course zips → npm ci, gen-env → STACK_PROFILE=acceptance stack:up, seed →
// acceptance health (lms-sim, lti-gate, simulation profiles) → one Playwright pass of e2e/M2 in the e2e container (with the
// M1 host-control channel for the operator CLI) → strict case accounting against tests/e2e/M2/manifest.json →
// private leak scan → label-scoped teardown. Raw values stay in memory or in the private clone; evidence is redacted.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { playwrightResults, verifyResults } from '../../acceptance/M1/common/coverage.mjs';
import { createRunner } from '../../host/core.mjs';
import { httpsLoopback, run, walkFiles } from '../../host/lib.mjs';
import { m1HostControl } from '../../host/m1-control.mjs';
import { readM2Manifest } from '../M2/coverage.mjs';
import {
  BASELINE_SIMULATION_PROFILES, appLmsProviders, checkSimulationProfiles, registeredChannels, seedPortalUser,
} from '../../acceptance/lib/open-world.mjs';

const testsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const options = { 'test-sha': { type: 'string' }, 'harness-only': { type: 'boolean', default: false } };
const { values: opt } = parseArgs({ strict: false, options: { ...options, sha: { type: 'string' }, source: { type: 'string' } } });
const print = (line) => process.stdout.write(line + '\n');
const source = path.resolve(opt.source ?? path.join(testsDir, '..'));
const manifest = readM2Manifest(testsDir); // Fails closed before any Docker step if a row or the inventory is missing.

if (opt['harness-only']) {
  // Self-tests, types and discovery only. This branch must stay above every Docker and clone step.
  const self = await run(process.execPath, ['--test', path.join(testsDir, 'e2e/M2/coverage.selftest.mjs')], { cwd: source, timeoutMs: 120_000 });
  print(self.stdout.trim()); assert.equal(self.code, 0, self.stderr);
  const types = await run('npm', ['--prefix', testsDir, 'run', 'typecheck'], { cwd: source, timeoutMs: 300_000 });
  assert.equal(types.code, 0, types.stdout + types.stderr);
  const pw = path.join(testsDir, 'node_modules/.bin/playwright');
  const listed = await run(pw, ['test', '-c', 'e2e/M2/playwright.config.ts', '--list'], { cwd: testsDir, timeoutMs: 120_000 });
  assert.equal(listed.code, 0, listed.stderr);
  const ids = [...listed.stdout.matchAll(/\{case:(M2-\d{2}\.[a-z0-9-]+)\}/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'No duplicate discovered M2 case');
  assert.deepEqual([...ids].sort(), manifest.map((r) => r.id).sort(), 'Discovered M2 cases equal the manifest');
  const t7 = await run(pw, ['test', '--list'], { cwd: testsDir, env: { ...process.env, QA_SUITE: 'e2e' }, timeoutMs: 120_000 });
  assert.equal(t7.code, 0, t7.stderr); assert.equal(/\{case:M2-/.test(t7.stdout), false, 'The T7 suite never runs M2 files');
  print(`HARNESS ONLY: ${manifest.length} M2 browser cases discovered and accounted; T7 selection unchanged.`);
  print('No product acceptance, stack or live provider check was executed.');
  process.exit(0);
}

assert.match(opt.sha ?? '', /^[a-f0-9]{40}$/, 'Exact product SHA required (--sha)');
assert.match(opt['test-sha'] ?? '', /^[a-f0-9]{40}$/, 'Exact test SHA required (--test-sha)');
const identity = { productSha: opt.sha, testSha: opt['test-sha'] };
for (const revision of [identity.productSha, identity.testSha]) {
  const resolved = await run('git', ['rev-parse', revision + '^{commit}'], { cwd: source });
  assert.equal(resolved.code, 0); assert.equal(resolved.stdout.trim(), revision);
}
const clean = await run('git', ['diff', '--exit-code', identity.testSha, '--', 'tests'], { cwd: source });
const untracked = await run('git', ['ls-files', '--others', '--exclude-standard', '--', 'tests'], { cwd: source });
assert.equal(clean.code, 0, 'Current tests must equal the frozen test SHA');
assert.equal(untracked.stdout.trim(), '', 'Untracked test source cannot carry a frozen SHA label');

const r = createRunner({ task: 'M2', defaultProject: 'qa-e2e-m2-r1', extraOptions: options });
const COURSES = {
  'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-scorm-v2.zip': 'a685744e5fd9de21c203c3b2f47916ef1079532196ed870df89a00ab8ee76df7',
  'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-html.zip': '9f04d3abd65f85e362b2dca5207cc4b86ffa286e4b1a73923c157b69321f3f6d',
};
const compose = ['compose', '-p', r.PROJECT, '-f', 'infra/compose.yaml', '--env-file', '.env'];
async function installTests() {
  const archive = path.join(path.dirname(r.CLONE), path.basename(r.CLONE) + '-tests.tar');
  assert.equal((await run('git', ['archive', '--format=tar', '--output', archive, identity.testSha, 'tests'], { cwd: source })).code, 0);
  try { assert.equal((await r.exec('install-frozen-tests', 'tar', ['-xf', archive, '-C', r.CLONE])).code, 0); }
  finally { fs.rmSync(archive, { force: true }); }
}
function copyCourses() {
  const folder = process.env.COURSE_FIXTURES_DIR; assert.ok(folder, 'COURSE_FIXTURES_DIR is required (AC-M2-12 publishes the real HTML course)');
  const dest = path.join(r.CLONE, 'tests/fixtures/courses'); fs.mkdirSync(dest, { recursive: true });
  for (const [name, digest] of Object.entries(COURSES)) {
    const bytes = fs.readFileSync(path.join(folder, name));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), digest, name);
    fs.writeFileSync(path.join(dest, name), bytes);
  }
}
async function volumesAndContainers() {
  const vols = await run('docker', ['volume', 'ls', '--format', '{{.Name}}|{{.Label "com.docker.compose.project"}}']);
  const ctrs = await run('docker', ['ps', '-a', '--format', '{{.ID}}|{{.Status}}|{{.Label "com.docker.compose.project"}}']);
  const other = (text) => text.split('\n').filter(Boolean).filter((line) => !line.endsWith('|' + r.PROJECT)).sort();
  return { volumes: other(vols.stdout), containers: other(ctrs.stdout).map((l) => l.replace(/\|Up [^|]*/, '|Up')) };
}
/** /__sim/secrets read inside the simulator container; values stay in memory (never printed or logged). */
async function simSecrets() {
  const script = "const h=require('https'),f=require('fs');h.get({host:'127.0.0.1',port:443,path:'/__sim/secrets',servername:'lms-sim.test',"
    + "headers:{host:'lms-sim.test'},ca:f.readFileSync(process.env.CA_FILE)},(s)=>{let b='';s.on('data',(c)=>b+=c);s.on('end',()=>process.stdout.write(b))})"
    + ".on('error',(e)=>{process.stderr.write(e.message);process.exit(1)})";
  const res = await run('docker', [...compose, 'exec', '-T', 'lms-sim', 'node', '-e', script], { cwd: r.CLONE, env: r.STACK_ENV, timeoutMs: 60_000 });
  assert.equal(res.code, 0, 'Simulator secret capture failed');
  return JSON.parse(res.stdout).values.filter((v) => typeof v === 'string' && v.length >= 8);
}
function clonedValues() {
  const dir = path.join(r.CLONE, 'tests/acceptance/artifacts'), values = [];
  for (const name of ['m1-secrets.raw.jsonl', 'captured-secrets.jsonl']) {
    const file = path.join(dir, name); if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
      const v = JSON.parse(line); const value = typeof v === 'string' ? v : v.value;
      if (typeof value === 'string' && value.length >= 8) values.push(value);
    }
  }
  return values;
}

await r.main(async () => {
  const before = await volumesAndContainers();
  await installTests(); copyCourses();
  assert.equal((await r.npm('root-ci', ['ci', '--no-audit', '--no-fund'], { timeoutMs: 900_000 })).code, 0);
  assert.equal((await r.npm('gen-env', ['run', 'gen-env'])).code, 0);
  r.loadStackFiles(); await r.composeNameGuard(); assert.equal(r.state.abort, null, 'compose name guard');
  assert.equal((await r.npm('stack-up-acceptance', ['run', 'stack:up'], { env: { ...r.STACK_ENV, STACK_PROFILE: 'acceptance' }, timeoutMs: 900_000 })).code, 0);
  assert.equal((await r.npm('seed', ['run', 'seed'], { timeoutMs: 900_000 })).code, 0);
  r.loadStackFiles(); await r.checkProject(); assert.ok(r.state.h1Verified, 'QA project guard');
  const lti = await r.healthz(r.state.urls.lti), appHealth = await r.healthz(r.state.urls.app);
  assert.equal(lti?.profile, 'acceptance'); assert.equal(appHealth?.profile, 'acceptance');
  // LD-1 open world (LA-E0-04, row 2): the 2 baseline simulation profiles in order; each extra id is the simulation
  // profile of a registered channel (GET /api/providers, GET /app-api/lms-providers).
  const apiKey = fs.readFileSync(path.join(r.CLONE, 'infra/.secrets/lti-api-key.cogniate'), 'utf8').trim(); r.redact.add(apiKey);
  const providers = await httpsLoopback(r.state.urls.lti + '/api/providers', { ca: r.state.ca, headers: { authorization: 'Bearer ' + apiKey } });
  assert.equal(providers.status, 200, 'GET /api/providers');
  const lmsProviders = await appLmsProviders(httpsLoopback, { appUrl: r.state.urls.app, ca: r.state.ca, user: seedPortalUser(r.state.rawSeed) });
  checkSimulationProfiles(lti?.simulation_profiles, BASELINE_SIMULATION_PROFILES,
    { profiles: JSON.parse(providers.body).profiles, registered: registeredChannels(lmsProviders) });
  assert.deepEqual([lti?.knobs, appHealth?.knobs], [[], []]);
  const services = (await run('docker', [...compose, 'ps', '--services', '--status', 'running'], { cwd: r.CLONE, env: r.STACK_ENV })).stdout;
  for (const name of ['lms-sim', 'lti-gate']) assert.ok(services.split('\n').includes(name), `${name} runs`);
  r.record('M2-STACK', 'Acceptance stack with lms-sim, lti-gate and both simulation profiles; no knobs', 'PASS',
    [JSON.stringify({ lti: { profile: lti.profile, simulation_profiles: lti.simulation_profiles }, app: { profile: appHealth.profile } })]);

  const inside = 'set -euo pipefail; source infra/scripts/lib.sh; require_running proxy; prepare_e2e; qa_env_args; '
    + 'dc --profile test run --rm --no-deps --name "$COMPOSE_PROJECT_NAME-qa-m2-$$" --build "${QA_ENV_ARGS[@]+"${QA_ENV_ARGS[@]}"}" e2e sh -c '
    + "'npm ci --prefix tests --no-audit --no-fund && cd tests && ./node_modules/.bin/playwright test -c e2e/M2/playwright.config.ts'";
  const stop = m1HostControl(r);
  let pass;
  try {
    pass = await r.exec('m2-browser-pass', 'bash', ['-c', inside], {
      env: { ...r.STACK_ENV, QA_PRODUCT_SHA: identity.productSha, QA_TEST_SHA: identity.testSha }, timeoutMs: 7_200_000 });
  } finally { await stop(); }
  const values = [...new Set([...await simSecrets(), ...clonedValues()])];
  for (const v of values) r.redact.add(v);
  const reportFile = path.join(r.CLONE, 'tests/e2e/artifacts/m2/playwright-results.json');
  assert.ok(fs.existsSync(reportFile), 'No M2 Playwright report');
  const rows = playwrightResults(JSON.parse(fs.readFileSync(reportFile, 'utf8')), manifest, identity);
  for (const row of rows) r.record(row.id, row.title, row.status);
  r.saveText('m2-case-results.json', JSON.stringify(rows.map((row) => ({ ...row, command: 'run-m2.mjs', profile: 'acceptance', project: r.PROJECT })), null, 2));
  // Evidence: screenshots (approval input masked) and the JSON report; no traces or videos exist in this suite.
  const evidence = path.join(r.CLONE, 'tests/e2e/artifacts/m2');
  for (const file of walkFiles(evidence)) {
    const rel = path.relative(evidence, file), dest = path.join(r.ART, 'evidence', 'm2', rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (file.endsWith('.png')) fs.copyFileSync(file, dest);
    else if (/\.(json|txt|log)$/.test(file)) r.saveText(path.join('evidence', 'm2', rel), fs.readFileSync(file, 'utf8'));
  }
  let hits = 0;
  const scanned = [...walkFiles(path.join(r.CLONE, 'infra/.logs')).filter((f) => f.endsWith('.jsonl')),
    ...walkFiles(r.ART).filter((f) => /\.(json|jsonl|log|txt)$/.test(f))];
  for (const file of scanned) { const text = fs.readFileSync(file, 'utf8'); for (const v of values) if (text.includes(v)) hits++; }
  r.saveText('m2-secret-scan.json', JSON.stringify({ capturedValues: values.length, checkedFiles: scanned.length, hits }));
  r.record('M3-07-M2', 'Zero captured-secret hits in service, simulator and gate logs and in redacted evidence', hits === 0 ? 'PASS' : 'FAIL', [`values ${values.length}, files ${scanned.length}, hits ${hits}`]);
  const after = await volumesAndContainers();
  r.record('M3-06-M2', 'Baseline volumes and other containers unchanged by the M2 run', JSON.stringify(after) === JSON.stringify(before) ? 'PASS' : 'FAIL',
    [`volumes ${before.volumes.length} → ${after.volumes.length}; containers ${before.containers.length} → ${after.containers.length}`]);
  verifyResults(manifest, rows, identity);
  assert.equal(pass.code, 0, 'Playwright pass exit code');
});
