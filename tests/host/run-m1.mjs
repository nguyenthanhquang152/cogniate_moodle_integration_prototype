#!/usr/bin/env node
// Contract-derived M1 orchestration. No product imports or database mutation.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createRunner } from './core.mjs';
import { allContainers, httpsLoopback, run, walkFiles } from './lib.mjs';
import { m1HostControl } from './m1-control.mjs';
import { migrationRun, snapshotMigrationRun } from './m1-migration.mjs';
import { FULL_PHASES, SNAPSHOT_OLD_SHA, SNAPSHOT_CONTRACT_SHA, phaseRows, casePattern, snapshotStageRows } from './m1-phases.mjs';
import { WRAPPER } from './storage-compat-route.mjs';
import {
  CONDITIONAL_ID, checkConditional, countResults, joinInventory, readStorageManifest, sameConditionalInBothRounds, splitConditional,
} from './storage-inventory.mjs';
import { StorageLane } from './storage-lane.mjs';
import { storagePhase } from './storage-rows.mjs';
import { readManifests, verifyResults, vitestResults, playwrightResults } from '../acceptance/M1/common/coverage.mjs';
import { createRuntime } from '../sim/core/runtime.mjs';
import { loadProviders } from '../sim/server.mjs';

const testsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = {
  phase: { type: 'string', default: 'full' },
  provider: { type: 'string', default: 'all' },
  'test-sha': { type: 'string' },
  'harness-only': { type: 'boolean', default: false },
};
const { values: opt } = parseArgs({ strict: false, options: {
  ...options, sha: { type: 'string' }, source: { type: 'string' }, help: { type: 'boolean' },
} });
assert.ok(['full', ...FULL_PHASES, 'legacy'].includes(opt.phase), 'Unknown phase');
assert.ok(['all', 'blackboard', 'canvas'].includes(opt.provider), 'Unknown provider');
const source = path.resolve(opt.source ?? path.join(testsDir, '..'));
const owners = opt.provider === 'all' ? ['common', 'blackboard', 'canvas'] : ['common', opt.provider];
const print = (text) => process.stdout.write(text + '\n');
const loadingRuntime = () => createRuntime({ publicLtiUrl: 'https://tool.test',
  fetchJwks: async () => { throw new Error('Module discovery must not fetch a key'); } });
async function checked(command, args, extra = {}) {
  const result = await run(command, args, { cwd: source, timeoutMs: 120_000, ...extra });
  if (result.stdout) print(result.stdout.trim());
  assert.equal(result.code, 0, `${command} failed: ${result.stderr}`);
  return result;
}
if (opt.help) {
  print('M1: --sha <40 hex> --test-sha <40 hex> [--phase full|sim|snapshot-isolated|snapshot-upgrade|migration|storage|legacy] [--provider all|blackboard|canvas]');
  print('Preparation only: --harness-only --provider blackboard (no Docker or product calls).');
  print('Full = SIM + snapshot-isolated + populated 011-to-012 + Moodle migration + storage (AC-M1-41, own lane) twice at the same SHAs, then legacy; it requires Canvas.');
  process.exit(0);
}
if (opt['harness-only']) {
  // This branch must remain above all Docker, clone and product-run operations.
  const selftests = walkFiles(path.join(testsDir, 'sim')).filter((f) => f.endsWith('.test.mjs'));
  selftests.push(...walkFiles(path.join(testsDir, 'host')).filter((f) => f.endsWith('.selftest.mjs')));
  selftests.push(...walkFiles(path.join(testsDir, 'acceptance/M1/common')).filter((f) => f.endsWith('.selftest.mjs')));
  await checked(process.execPath, ['--test', ...selftests]);
  await checked('npm', ['--prefix', testsDir, 'run', 'typecheck']);
  const manifest = joinInventory(readManifests(testsDir, owners), readStorageManifest(testsDir), { full: opt.provider === 'all' });
  const providers = await loadProviders(loadingRuntime(),
    opt.provider === 'all' ? ['blackboard', 'canvas'] : [opt.provider]);
  const discovery = await run(process.execPath, [
    path.join(testsDir, 'node_modules/vitest/vitest.mjs'), 'list', '--config',
    path.join(testsDir, 'acceptance/M1/vitest.config.mts'), '--json',
  ], { cwd: source, env: { ...process.env, QA_M1_PROVIDER: opt.provider }, timeoutMs: 120_000 });
  assert.equal(discovery.code, 0, discovery.stderr);
  const discovered = JSON.parse(discovery.stdout);
  const api = manifest.filter((row) => row.kind === 'api');
  const ids = discovered.map((row) => row.name.match(/\{case:([^}]+)\}/)?.[1]);
  assert.equal(new Set(ids).size, ids.length, 'No duplicate discovered cases');
  for (const row of api) assert.ok(ids.includes(row.id), 'Undiscovered manifest case ' + row.id);
  for (const id of ids) assert.ok(api.some((row) => row.id === id), 'Unmanifested discovered case ' + id);
  for (const stage of ['snapshot-seed', 'snapshot-upgrade']) {
    const wanted = snapshotStageRows(manifest, stage);
    const probe = await run(process.execPath, [
      path.join(testsDir, 'node_modules/vitest/vitest.mjs'), 'list', '--config',
      path.join(testsDir, 'acceptance/M1/vitest.config.mts'), '--json',
    ], { cwd: source, env: { ...process.env, QA_M1_PROVIDER: opt.provider, QA_M1_MIGRATION_STAGE: stage,
      QA_GREP: casePattern(wanted) }, timeoutMs: 120_000 });
    assert.equal(probe.code, 0, probe.stderr);
    assert.deepEqual(JSON.parse(probe.stdout).map((row) => row.name.match(/\{case:([^}]+)\}/)?.[1]).sort(),
      wanted.map((row) => row.id).sort(), 'Snapshot host probe discovery: ' + stage);
  }
  // a-lock-scope runs one QA storage case through the candidate test:acceptance; its own stage selects it.
  const lockScope = await run(process.execPath, [
    path.join(testsDir, 'node_modules/vitest/vitest.mjs'), 'list', '--config',
    path.join(testsDir, 'acceptance/M1/vitest.config.mts'), '--json',
  ], { cwd: source, env: { ...process.env, QA_M1_PROVIDER: opt.provider, QA_M1_MIGRATION_STAGE: 'storage-lock-scope',
    QA_GREP: '\\{case:M1-41\\.common\\.a-lock-scope\\}' }, timeoutMs: 120_000 });
  assert.equal(lockScope.code, 0, lockScope.stderr);
  assert.deepEqual(JSON.parse(lockScope.stdout).map((row) => row.name.match(/\{case:([^}]+)\}/)?.[1]), ['M1-41.common.a-lock-scope'],
    'a-lock-scope QA storage case discovery');
  const byPhase = {};
  for (const row of manifest) { const ph = row.phase ?? (row.environment === 'MOODLE-LIVE' ? 'migration' : 'sim'); byPhase[ph] = (byPhase[ph] ?? 0) + 1; }
  print(`HARNESS ONLY: ${api.length} API cases, ${manifest.length - api.length} host rows (${manifest.filter((r) => r.ac === 'AC-M1-41').length} AC-M1-41); `
    + `${manifest.length} mandatory rows per round; phases ${JSON.stringify(byPhase)}; conditional ${CONDITIONAL_ID} only; providers ${providers.map((p) => p.id).join(', ')}.`);
  print('No product acceptance or live provider check was executed.');
  process.exit(0);
}

// Fail closed before Docker: a full suite cannot silently omit either provider.
const expected = joinInventory(readManifests(testsDir, owners), readStorageManifest(testsDir), { full: opt.provider === 'all' });
/** verifyResults for every row except c-host-negative, plus the conditional rule of ADR-012 §14. */
function verifyWithConditional(selection, actual) {
  const split = splitConditional(selection, actual);
  if (split.expected.length) verifyResults(split.expected, split.actual, identity);
  return checkConditional(split.conditionalExpected, split.conditionalActual);
}
await loadProviders(loadingRuntime(),
  opt.provider === 'all' ? ['blackboard', 'canvas'] : [opt.provider]);
assert.match(opt.sha ?? '', /^[a-f0-9]{40}$/, 'Exact product SHA required');
assert.match(opt['test-sha'] ?? '', /^[a-f0-9]{40}$/, 'Exact test SHA required');
const identity = { productSha: opt.sha, testSha: opt['test-sha'] };
assert.ok(!process.argv.some((arg) => ['--checkout', '--replace-tests', '--tests-from', '--only-task-folders', '--clean-project'].includes(arg)),
  'M1 requires an isolated clone and frozen tests; no cleanup or working-copy override');
for (const revision of [identity.productSha, identity.testSha]) {
  const resolved = await run('git', ['rev-parse', revision + '^{commit}'], { cwd: source });
  assert.equal(resolved.code, 0); assert.equal(resolved.stdout.trim(), revision);
}
const clean = await run('git', ['diff', '--exit-code', identity.testSha, '--', 'tests'], { cwd: source });
const newFiles = await run('git', ['ls-files', '--others', '--exclude-standard', '--', 'tests'], { cwd: source });
assert.equal(clean.code, 0, 'Current tests must equal the frozen test SHA');
assert.equal(newFiles.code, 0); assert.equal(newFiles.stdout.trim(), '', 'Untracked test source cannot carry a frozen SHA label');
assert.equal(path.resolve(testsDir), path.join(source, 'tests'), 'Run the host entry point from the frozen source tests folder');

async function childRun(script, args, environment, resultFile) {
  const result = await run(process.execPath, [script, ...args], {
    cwd: source, env: { ...process.env, ...environment }, timeoutMs: 43_200_000,
  });
  if (result.stdout) print(result.stdout);
  assert.equal(result.code, 0, `Required child failed (${script}): ${result.stderr}`);
  if (resultFile) {
    assert.ok(fs.existsSync(resultFile), 'Child did not publish its case inventory');
    return JSON.parse(fs.readFileSync(resultFile, 'utf8'));
  }
}
if (opt.phase === 'full') {
  assert.equal(opt.provider, 'all', 'Full acceptance requires both providers');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-m1-accounting-'));
  fs.chmodSync(scratch, 0o700);
  const runs = [];
  const baseProject = process.env.COMPOSE_PROJECT_NAME ?? 'qa-multi-r1';
  for (let round = 1; round <= 2; round++) {
    const rows = [];
    // The migration phase records this round's AC-M1-23 backup and clone for e-old-schema (ids only, no secret).
    const handoff = path.join(scratch, `round-${round}-handoff.json`);
    for (const phase of FULL_PHASES) {
      print(`Starting M1 round ${round}, ${phase}; one stack at a time.`);
      const resultFile = path.join(scratch, `round-${round}-${phase}.json`);
      // The storage phase has its own fresh clone and its own lane (project name), ADR-012 §13.
      const lane = phase === 'storage' ? { COMPOSE_PROJECT_NAME: `${baseProject}-st` } : {};
      rows.push(...await childRun(fileURLToPath(import.meta.url), [
        '--phase', phase, '--sha', identity.productSha, '--test-sha', identity.testSha, '--source', source,
      ], { QA_M1_RESULTS_FILE: resultFile, QA_M1_HANDOFF_FILE: handoff, ...lane }, resultFile));
    }
    verifyWithConditional(expected, rows); runs.push(rows);
    const count = countResults(rows);
    print(`Round ${round}: ${rows.length} rows; PASS ${count.PASS}; NOT_APPLICABLE ${count.NOT_APPLICABLE} (reported apart, never a PASS).`);
  }
  const outcome = (rows) => rows.map(({ id, status, environment }) => ({ id, status, environment })).sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(outcome(runs[0]), outcome(runs[1]), 'Two full runs must have the same per-case results');
  print(`c-host-negative in both rounds: ${sameConditionalInBothRounds(runs[0], runs[1])}.`);
  await childRun(fileURLToPath(import.meta.url), [
    '--phase', 'legacy', '--sha', identity.productSha, '--test-sha', identity.testSha, '--source', source,
  ], {});
  print('M1 SIM, isolated drift, populated 011-to-012, Moodle rollback, storage (AC-M1-41) and legacy accounting passed; M2, T7 and live checks remain separate.');
  process.exit(0);
}
if (opt.phase === 'legacy') {
  const suites = [
    ['run-t2.mjs', ['--tasks', 'T2a,T2b,T3a,T3b']],
    ['run-t3c.mjs', []], ['run-t4a.mjs', []],
    ['run-t4b.mjs', ['--tasks', 'T4b1,T4b2']],
    ['run-t5.mjs', ['--tasks', 'T5a,T5b,T6']], ['run-t8.mjs', []],
  ];
  for (const [name, args] of suites) {
    print(`Legacy gate: ${name}, frozen product/test revisions, existing knob passes.`);
    await childRun(path.join(testsDir, 'host', name), [
      '--sha', identity.productSha, '--source', source, '--replace-tests', '--tests-from', testsDir, ...args,
    ], { QA_M1_LEGACY_GUARD: '1', QA_PRODUCT_SHA: identity.productSha, QA_TEST_SHA: identity.testSha,
      COMPOSE_PROJECT_NAME: process.env.COMPOSE_PROJECT_NAME ?? 'qa-multi-legacy', STACK_PROFILE: 'default' });
  }
  print('All required legacy host runners exited successfully; use their per-case evidence labels in the final M3 report.');
  process.exit(0);
}

const r = createRunner({ task: 'M1', defaultProject: 'qa-multi-r1', extraOptions: options });
const rows = [], artifactDir = path.join(r.CLONE, 'tests/acceptance/artifacts');
const record = (id, notes) => {
  const entry = expected.find((row) => row.id === id); assert.ok(entry, 'Unmanifested host case ' + id);
  const row = { id, status: 'PASS', environment: entry.environment, ...identity, notes };
  rows.push(row); r.record(id, entry.title, 'PASS', [notes]); return row;
};
async function installTests({ exact } = {}) {
  // git archive reads only the frozen tests tree. Product checkouts cannot replace it.
  if (exact) {
    // ADR-012 §12 tree rule: tests/ must equal the frozen tree, so tracked old-only test files leave first.
    const list = async (rev) => new Set((await run('git', ['ls-tree', '-r', '--name-only', rev, '--', 'tests'], { cwd: r.CLONE })).stdout.split('\n').filter(Boolean));
    const oldFiles = await list(exact), frozen = await list(identity.testSha);
    for (const file of oldFiles) if (!frozen.has(file)) fs.rmSync(path.join(r.CLONE, file), { force: true });
  }
  const archive = path.join(path.dirname(r.CLONE), path.basename(r.CLONE) + '-tests.tar');
  const exported = await run('git', ['archive', '--format=tar', '--output', archive, identity.testSha, 'tests'], { cwd: source });
  assert.equal(exported.code, 0);
  try { assert.equal((await r.exec('install-frozen-tests', 'tar', ['-xf', archive, '-C', r.CLONE])).code, 0); }
  finally { fs.rmSync(archive, { force: true }); }
}
function loadCapturedSecrets() {
  const values = [];
  for (const name of ['m1-secrets.raw.jsonl', 'captured-secrets.jsonl']) {
    const file = path.join(artifactDir, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
      const value = JSON.parse(line), secret = typeof value === 'string' ? value : value.value;
      r.redact.add(secret); if (typeof secret === 'string' && secret.length >= 8) values.push(secret);
    }
  }
  return [...new Set(values)];
}
function shareEvidence(label) {
  loadCapturedSecrets();
  for (const file of walkFiles(artifactDir)) {
    const relative = path.relative(artifactDir, file);
    if (relative.startsWith('control/') || /(?:\.raw\.|captured-secrets|^state-)/.test(relative)) continue;
    if (!/\.(json|jsonl|log|txt)$/.test(file)) continue; // Browser traces require their owner's separate sanitization.
    r.saveText(path.join('evidence', label, relative), fs.readFileSync(file, 'utf8'));
  }
}
async function setup({ route } = {}) {
  const npmStep = async (name, args, o) => { route?.logCommand('npm', args); return r.npm(name, args, o); };
  assert.equal((await npmStep('root-ci', ['ci', '--no-audit', '--no-fund'], { timeoutMs: 900_000 })).code, 0);
  assert.equal((await npmStep('gen-env', ['run', 'gen-env'])).code, 0);
  r.loadStackFiles(); await r.composeNameGuard(); assert.equal(r.state.abort, null);
  // Old builds start only through the copied storage-compat.sh run -- (ADR-012 §12).
  if (route) assert.equal((await route.oldStart('stack-up-old', ['npm', 'run', 'stack:up'], { timeoutMs: 900_000 })).code, 0);
  else assert.equal((await r.npm('stack-up', ['run', 'stack:up'], { timeoutMs: 900_000 })).code, 0);
  assert.equal((await npmStep('seed', ['run', 'seed'], { timeoutMs: 900_000 })).code, 0);
  r.loadStackFiles(); await r.checkProject(); assert.ok(r.state.h1Verified);
  return !r.state.abort;
}
/** The storage phase clone preparation: frozen tests, install, gen-env and the name guard; no stack start. */
async function setupStorageClone() {
  await installTests();
  assert.equal((await r.npm('root-ci', ['ci', '--no-audit', '--no-fund'], { timeoutMs: 900_000 })).code, 0);
  assert.equal((await r.npm('gen-env', ['run', 'gen-env'])).code, 0);
  r.loadStackFiles(); await r.composeNameGuard(); assert.equal(r.state.abort, null);
}
async function defaultGate() {
  for (const url of [r.state.urls.app, r.state.urls.lti]) {
    const body = await r.healthz(url); assert.equal(body?.profile, 'default'); assert.deepEqual(body.knobs, []);
  }
  assert.deepEqual((await r.healthz(r.state.urls.lti)).simulation_profiles, []);
  const services = (await allContainers()).filter((c) => c.Config?.Labels?.['com.docker.compose.project'] === r.PROJECT)
    .map((c) => c.Config.Labels['com.docker.compose.service']);
  assert.ok(!services.includes('lms-sim') && !services.includes('lti-gate'), 'No simulation containers in the default stack');
  const key = fs.readFileSync(path.join(r.CLONE, 'infra/.secrets/lti-api-key.cogniate'), 'utf8').trim(); r.redact.add(key);
  const api = async (method, route, body) => {
    const result = await httpsLoopback(r.state.urls.lti + route, { method, ca: r.state.ca,
      headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body) });
    return { ...result, json: JSON.parse(result.body) };
  };
  const profiles = await api('GET', '/api/providers'); assert.equal(profiles.status, 200); assert.equal(profiles.json.profiles.length, 6);
  for (const profile of ['blackboard-sim', 'canvas-sim-cloud', 'nope']) {
    const answer = await api('POST', '/api/platforms', { profile, clientId: 'gate-test', name: 'gate-test' });
    assert.equal(answer.status, 400); assert.equal(answer.json.details.message, 'UNKNOWN_PROFILE');
  }
  record('M1-02.common.default-profile', 'Default stack exposes six real profiles, no simulation profiles or helper containers');
}
async function suite(label, selection, environment = {}, { route } = {}) {
  const reportFile = path.join(artifactDir, 'm1-vitest-results.json');
  const browserReport = path.join(artifactDir, 'playwright-results.json');
  fs.rmSync(reportFile, { force: true }); // A stale report must never satisfy a failed/empty command.
  fs.rmSync(browserReport, { force: true });
  const stop = m1HostControl(r);
  const startedAt = new Date().toISOString();
  let result;
  const suiteEnv = { QA_TASK: 'M1', QA_M1_PROVIDER: opt.provider, QA_GREP: casePattern(selection),
    QA_PRODUCT_SHA: identity.productSha, QA_TEST_SHA: identity.testSha, ...environment };
  try {
    // An old-build suite runs only through the copied wrapper (ADR-012 §12); the candidate suite runs directly.
    result = route ? await route.oldStart('acceptance-' + label, ['npm', 'run', 'test:acceptance'], { env: suiteEnv, timeoutMs: 7_200_000 })
      : await run('npm', ['run', 'test:acceptance'], { cwd: r.CLONE, env: { ...r.STACK_ENV, ...suiteEnv }, timeoutMs: 7_200_000 });
  } finally { await stop(); loadCapturedSecrets(); }
  r.saveText(`cmd/acceptance-${label}.log`, JSON.stringify({
    command: route ? `bash ${WRAPPER} run -- npm run test:acceptance` : 'npm run test:acceptance', ...identity, label, code: result.code,
    startedAt, durationMs: result.durationMs, stdout: result.stdout, stderr: result.stderr,
  }, null, 2));
  assert.ok(fs.existsSync(reportFile), 'No M1 JSON report was produced');
  const actual = vitestResults(JSON.parse(fs.readFileSync(reportFile, 'utf8')),
    selection.filter((row) => row.kind !== 'browser'), identity, { partial: true });
  const browserCases = selection.filter((row) => row.kind === 'browser');
  if (browserCases.length) assert.ok(fs.existsSync(browserReport), 'No required browser case report');
  if (fs.existsSync(browserReport)) actual.push(...playwrightResults(
    JSON.parse(fs.readFileSync(browserReport, 'utf8')), browserCases, identity, { partial: true }));
  for (const row of actual) Object.assign(row, { command: 'npm run test:acceptance', startedAt,
    artifact: `evidence/${label}`, profile: 'acceptance', project: r.PROJECT });
  shareEvidence(label);
  for (const row of actual) r.record(row.id, row.title, row.status === 'BLOCKED' ? 'FAIL' : row.status,
    row.status === 'BLOCKED' ? ['BLOCKED: live 5 s schedule missed its deadline; see measured case evidence'] : []);
  rows.push(...actual);
  verifyResults(selection, actual, identity); assert.equal(result.code, 0);
  return actual;
}
function copyCourseFixtures() {
  const folder = process.env.COURSE_FIXTURES_DIR; assert.ok(folder, 'COURSE_FIXTURES_DIR required for migration');
  const expected = {
    'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-scorm-v2.zip': 'a685744e5fd9de21c203c3b2f47916ef1079532196ed870df89a00ab8ee76df7',
    'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-html.zip': '9f04d3abd65f85e362b2dca5207cc4b86ffa286e4b1a73923c157b69321f3f6d',
  };
  const dest = path.join(r.CLONE, 'tests/fixtures/courses'); fs.mkdirSync(dest, { recursive: true });
  for (const [name, digest] of Object.entries(expected)) {
    const bytes = fs.readFileSync(path.join(folder, name));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), digest, name);
    fs.writeFileSync(path.join(dest, name), bytes);
  }
}
await r.main(async () => {
  await installTests();
  try {
    if (opt.phase === 'sim') {
      assert.ok(await setup()); await defaultGate();
      const selected = phaseRows(expected, 'sim');
      await suite('sim', selected.filter((row) => ['api', 'browser'].includes(row.kind)));
      verifyResults(selected, rows, identity);
    } else if (opt.phase === 'snapshot-isolated') {
      assert.ok(await setup());
      const selected = phaseRows(expected, 'snapshot-isolated');
      await suite('snapshot-isolated', selected, { QA_M1_ISOLATED: '1' });
      verifyResults(selected, rows, identity);
    } else if (opt.phase === 'snapshot-upgrade') {
      const probe = async (stage, executingSha, { route } = {}) => {
        const count = rows.length;
        const actual = await suite(stage, snapshotStageRows(expected, stage),
          { QA_M1_MIGRATION_STAGE: stage, QA_M1_EXECUTING_SHA: executingSha }, { route });
        rows.splice(count); return actual;
      };
      rows.push(...await snapshotMigrationRun(r, { installTests, setup, probe, identity }));
      verifyResults(phaseRows(expected, 'snapshot-upgrade'), rows, identity);
    } else if (opt.phase === 'migration') {
      copyCourseFixtures();
      // migrationRun records each successful stage once. Probe results are used
      // as assertions here, then included in the host inventory by that runner.
      const probe = async (stage, executingSha, { route } = {}) => {
        const id = stage === 'baseline' || stage === 'upgrade' ? `M1-23.common.${stage}` : `M1-30.common.${stage}`;
        const count = rows.length;
        await suite('migration-' + stage, expected.filter((row) => row.id === id),
          { QA_M1_MIGRATION_STAGE: stage, QA_M1_EXECUTING_SHA: executingSha,
            QA_GREP: `\\{case:${id.replaceAll('.', '\\.')}\\}` }, { route });
        rows.splice(count);
      };
      rows.push(...await migrationRun(r, { installTests, setup, probe, identity }));
      verifyResults(phaseRows(expected, 'migration'), rows, identity);
    } else if (opt.phase === 'storage') {
      // AC-M1-41 rows of the storage phase: own fresh clone and lane, QA fixture containers only (ADR-012 §11).
      const lane = new StorageLane(r);
      const handoff = () => process.env.QA_M1_HANDOFF_FILE && fs.existsSync(process.env.QA_M1_HANDOFF_FILE)
        ? JSON.parse(fs.readFileSync(process.env.QA_M1_HANDOFF_FILE, 'utf8')) : null;
      rows.push(...await storagePhase(lane, { identity, handoff, setupClone: setupStorageClone }));
      verifyWithConditional(phaseRows(expected, 'storage'), rows);
    }
  } finally {
    loadCapturedSecrets(); shareEvidence('final');
    const captured = loadCapturedSecrets();
    // Existing command files may have been written before a new token was
    // captured. Sanitize them before publishing the result, then check zero hits.
    const evidenceFiles = walkFiles(r.ART).filter((file) => /\.(log|json|jsonl|txt|md)$/.test(file));
    for (const file of evidenceFiles) {
      const clean = r.redact.apply(fs.readFileSync(file, 'utf8')); fs.writeFileSync(file, clean);
      for (const secret of captured) assert.equal(clean.includes(secret), false, 'Secret in redacted evidence');
    }
    r.saveText('m1-evidence-secret-scan.json', JSON.stringify({ capturedValues: captured.length,
      checkedFiles: evidenceFiles.length, hits: 0 }));
    r.saveText('m1-case-results.json', JSON.stringify(rows, null, 2));
    r.saveText('m1-identity.json', JSON.stringify({ ...identity, behaviorSha: SNAPSHOT_CONTRACT_SHA, snapshotSourceSha: SNAPSHOT_OLD_SHA,
      provider: opt.provider, phase: opt.phase, labels: [...new Set(rows.map((row) => row.environment))],
      project: r.PROJECT, publicPort: r.PUBLIC_PORT, subnet: r.STACK_SUBNET,
      timestamp: new Date().toISOString(), command: process.argv,
      health: { app: await r.healthz(r.state.urls?.app), lti: await r.healthz(r.state.urls?.lti) } }, null, 2));
    // Redaction is applied again by core.main after log collection.
    if (process.env.QA_M1_RESULTS_FILE) fs.writeFileSync(process.env.QA_M1_RESULTS_FILE, JSON.stringify(rows));
  }
});
