#!/usr/bin/env node
// QA-E2E host runner for T7 (tasks/T7.md). Node built-ins only.
//
//   COMPOSE_PROJECT_NAME=qa-e2e-r1 PUBLIC_PORT=8543 STACK_SUBNET=172.31.0.0/16 \
//   COURSE_FIXTURES_DIR=<repo>/docs/raw/data/courses \
//   node tests/e2e/host/run-t7.mjs --sha <commit> [--runs 3] [--demo] [--replace-e2e] [--keep]
//
// Charter §3a: QA clones the SHA into a new folder (~/cogniate-qa-runs/…) and runs its own stack there. The project
// name must start with "qa-e2e": this runner never touches another project (qa-t*, cogniate-*).
// Steps: preflight → clone → course zips → npm ci, gen-env → compose name guard → N × `npm run test:e2e -- --yes` (each
// run does its own e2e:reset; AC-T7-01, AC-T7-11) → optional confirm check (B-T7-01: "no" in a terminal deletes nothing)
// → optional demo pass (AC-T7-15: e2e:reset, timed demo:prepare, the DEMO spec) → teardown (stack:down, then
// containers, volumes and networks of this project) → summary.
// B-T7-01: e2e:reset and test:e2e delete all stack data and ask for "yes" in a terminal. The runner has no terminal
// (no question), but it passes `-- --yes` anyway, as infra/README.md says for QA runners.
// Evidence: tests/e2e/artifacts/runs/<run id>/ in the QA working copy (git-ignored). Known secrets are redacted in
// text files; captured-secrets.jsonl is replaced by a masked list (first 6 characters and the length).
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { allContainers, cidrOverlap, networkSubnets, portFree, projectResources, readEnv, Redactor, run, secretsInFile, sha256File, walkFiles } from '../../host/lib.mjs';
import { isCloneEnvSecret } from './t7-env-secrets.mjs';

const { values: opt } = parseArgs({
  options: {
    sha: { type: 'string' },
    runs: { type: 'string', default: '1' },
    demo: { type: 'boolean', default: false },
    'demo-only': { type: 'boolean', default: false },
    'check-confirm': { type: 'boolean', default: false },
    'replace-e2e': { type: 'boolean', default: false },
    keep: { type: 'boolean', default: false },
    checkout: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
});
const HELP = `Usage: COMPOSE_PROJECT_NAME=qa-e2e-r1 PUBLIC_PORT=8543 STACK_SUBNET=172.31.0.0/16 COURSE_FIXTURES_DIR=<dir> \\
  node tests/e2e/host/run-t7.mjs --sha <commit> [options]
  --runs <n>        Consecutive "npm run test:e2e" runs (default 1; AC-T7-11 wants 3).
  --demo            After the runs: e2e:reset, timed "npm run demo:prepare", the AC-T7-15 player check.
  --demo-only       Only the demo pass (no scenario run).
  --check-confirm   After the runs: in a terminal (pty), answer "no" to the delete question of e2e:reset and test:e2e
                    (B-T7-01); then run both without a terminal and without --yes (A-T7-04: fail closed). Each time,
                    check that nothing was deleted.
  --replace-e2e     Copy tests/e2e from this working copy into the clone (QA suite newer than the SHA).
  --keep            Do not tear the stack down at the end (debugging).
  --checkout <dir>  Use an existing clone instead of a fresh one.
`;
if (opt.help) {
  process.stdout.write(HELP);
  process.exit(0);
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const E2E_DIR = path.resolve(HERE, '..');
const SOURCE = path.resolve(E2E_DIR, '..', '..');
const PROJECT = process.env.COMPOSE_PROJECT_NAME ?? '';
const PUBLIC_PORT = process.env.PUBLIC_PORT ?? '8543';
const STACK_SUBNET = process.env.STACK_SUBNET ?? '172.31.0.0/16';
const FIXTURES = process.env.COURSE_FIXTURES_DIR ?? path.join(SOURCE, 'docs', 'raw', 'data', 'courses');
if (!/^qa-e2e[a-z0-9-]*$/.test(PROJECT)) {
  console.error(`COMPOSE_PROJECT_NAME must start with "qa-e2e" (got "${PROJECT}").\n\n${HELP}`);
  process.exit(2);
}
if (!opt.sha && !opt.checkout) {
  console.error(`--sha or --checkout is required.\n\n${HELP}`);
  process.exit(2);
}
const RUNS = Math.max(0, opt['demo-only'] ? 0 : Number(opt.runs) || 1);
const RUN_ID = `${PROJECT}-${(opt.sha ?? 'checkout').slice(0, 8)}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const CLONE = path.resolve(opt.checkout ?? path.join(os.homedir(), 'cogniate-qa-runs', RUN_ID));
const ART = path.join(E2E_DIR, 'artifacts', 'runs', RUN_ID);
fs.mkdirSync(ART, { recursive: true });
const BASE_ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('npm_') && !k.startsWith('QA_') && k !== 'E2E_CONFIRM' && k !== 'E2E_RESET'));
const STACK_ENV = { ...BASE_ENV, COMPOSE_PROJECT_NAME: PROJECT, PUBLIC_PORT, STACK_SUBNET, COURSE_FIXTURES_DIR: FIXTURES };
const ZIPS = [
  { name: 'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-scorm-v2.zip', sha256: 'a685744e5fd9de21c203c3b2f47916ef1079532196ed870df89a00ab8ee76df7' },
  { name: 'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-html.zip', sha256: '9f04d3abd65f85e362b2dca5207cc4b86ffa286e4b1a73923c157b69321f3f6d' },
];

const redact = new Redactor();
const summary = { runId: RUN_ID, sha: opt.sha ?? null, clone: CLONE, project: PROJECT, publicPort: PUBLIC_PORT, stackSubnet: STACK_SUBNET, steps: [], runs: [], demo: null, abort: null };
const log = (line) => process.stdout.write(`${redact.apply(line)}\n`);
let seq = 0;

function save(rel, text) {
  const file = path.join(ART, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, redact.apply(text));
  return path.relative(SOURCE, file);
}

async function exec(name, cmd, args, { cwd = CLONE, env = STACK_ENV, timeoutMs = 900_000 } = {}) {
  log(`$ ${cmd} ${args.join(' ')}`);
  const r = await run(cmd, args, { cwd, env, timeoutMs });
  const file = save(path.join('cmd', `${String(++seq).padStart(2, '0')}-${name}.log`), `$ ${cmd} ${args.join(' ')}\ncwd: ${cwd}\nexit: ${r.code}${r.timedOut ? ' (TIMEOUT)' : ''}\nduration_s: ${(r.durationMs / 1000).toFixed(1)}\n\n--- stdout\n${r.stdout}\n--- stderr\n${r.stderr}\n`);
  log(`  exit ${r.code} in ${(r.durationMs / 1000).toFixed(1)} s (${file})`);
  return { ...r, log: file };
}

function step(name, ok, notes = []) {
  summary.steps.push({ name, ok, notes: notes.map((n) => redact.apply(n)) });
  log(`${ok ? 'OK  ' : 'FAIL'} ${name}${notes.length ? `\n     ${notes.map((n) => redact.apply(n)).join('\n     ')}` : ''}`);
  return ok;
}

function addSecretsFromClone() {
  const env = readEnv(path.join(CLONE, '.env')) ?? {};
  for (const [k, v] of Object.entries(env)) if (isCloneEnvSecret(k, v)) redact.add(v);
  for (const f of walkFiles(path.join(CLONE, 'infra', '.secrets'))) for (const item of secretsInFile(f).items) redact.add(item.value);
}

// ---------------------------------------------------------------- steps

async function preflight() {
  const notes = [`project ${PROJECT}, PUBLIC_PORT ${PUBLIC_PORT}, STACK_SUBNET ${STACK_SUBNET}`];
  let ok = true;
  const left = await projectResources(PROJECT);
  if (left.containers.length + left.volumes.length + left.networks.length > 0) {
    ok = false;
    notes.push(`project ${PROJECT} already has ${left.containers.length} containers, ${left.volumes.length} volumes, ${left.networks.length} networks (tear it down first)`);
  }
  if (!(await portFree(PUBLIC_PORT))) {
    ok = false;
    notes.push(`127.0.0.1:${PUBLIC_PORT} is busy`);
  }
  const clash = (await networkSubnets()).filter((n) => cidrOverlap(n.subnet, STACK_SUBNET));
  if (clash.length) {
    ok = false;
    notes.push(`STACK_SUBNET overlaps ${clash.map((n) => `${n.name} ${n.subnet}`).join(', ')}`);
  }
  return step('preflight (free project, port, subnet)', ok, notes);
}

async function cloneSha() {
  if (!opt.checkout) {
    if (fs.existsSync(CLONE)) return step('clone', false, [`${CLONE} exists`]);
    const c = await exec('git-clone', 'git', ['clone', '--quiet', '--no-hardlinks', SOURCE, CLONE], { cwd: os.tmpdir() });
    const co = await exec('git-checkout', 'git', ['checkout', '--quiet', '--detach', opt.sha]);
    if (c.code !== 0 || co.code !== 0) return step('clone', false, ['git clone or checkout failed']);
  }
  const head = (await run('git', ['log', '-1', '--format=%H %s'], { cwd: CLONE })).stdout.trim();
  const notes = [`HEAD ${head}`, `clone ${CLONE}`];
  const suiteMissing = !fs.existsSync(path.join(CLONE, 'tests', 'e2e', '1-scenario-a.spec.ts'));
  if (suiteMissing || opt['replace-e2e']) {
    fs.rmSync(path.join(CLONE, 'tests', 'e2e'), { recursive: true, force: true });
    fs.cpSync(E2E_DIR, path.join(CLONE, 'tests', 'e2e'), { recursive: true, filter: (src) => !/[/\\]artifacts([/\\]|$)/.test(path.relative(E2E_DIR, src) ? `/${path.relative(E2E_DIR, src)}` : '') });
    const diff = (await run('git', ['diff', '--stat', opt.sha ?? 'HEAD', '--', 'tests/e2e'], { cwd: SOURCE })).stdout.trim().split('\n').pop() || 'no tracked changes';
    const untracked = (await run('git', ['ls-files', '--others', '--exclude-standard', '--', 'tests/e2e'], { cwd: SOURCE })).stdout.split('\n').filter(Boolean);
    notes.push(`tests/e2e copied from the working copy (${suiteMissing ? 'not in the SHA' : '--replace-e2e'}): ${diff}; untracked: ${untracked.length}`);
    save('tests-e2e-diff-vs-sha.txt', `${(await run('git', ['diff', opt.sha ?? 'HEAD', '--', 'tests/e2e'], { cwd: SOURCE })).stdout}\n# untracked:\n${untracked.join('\n')}\n`);
  }
  return step('clone the SHA into a new folder', true, notes);
}

function copyFixtures() {
  const dest = path.join(CLONE, 'tests', 'fixtures', 'courses');
  fs.mkdirSync(dest, { recursive: true });
  const notes = [];
  let ok = true;
  for (const z of ZIPS) {
    const src = path.join(FIXTURES, z.name);
    const sha = fs.existsSync(src) ? crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex') : null;
    if (sha !== z.sha256) {
      ok = false;
      notes.push(`${z.name}: ${sha ? `SHA-256 ${sha}` : 'not found'}`);
      continue;
    }
    fs.copyFileSync(src, path.join(dest, z.name));
    notes.push(`${z.name}: OK`);
  }
  return step('course zips into the clone (tests/fixtures/courses, SHA-256 checked)', ok, notes);
}

async function setup() {
  const ci = await exec('npm-ci', 'npm', ['ci', '--no-audit', '--no-fund']);
  const gen = await exec('gen-env', 'npm', ['run', 'gen-env']);
  addSecretsFromClone();
  const cfg = await exec('compose-config-name', 'docker', ['compose', '-f', 'infra/compose.yaml', '--env-file', '.env', 'config', '--format', 'json']);
  let name = null;
  try {
    name = JSON.parse(cfg.stdout).name;
  } catch {
    name = null;
  }
  return step('npm ci, gen-env, compose project name', ci.code === 0 && gen.code === 0 && name === PROJECT, [`npm ci ${ci.code}, gen-env ${gen.code}, compose name "${name}"`]);
}

/** Per-test rows from the Playwright JSON report: title, status, duration, first error line. */
function playwrightRows(file) {
  if (!fs.existsSync(file)) return [];
  const out = [];
  const walk = (suite, fileName) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const res = t.results?.at(-1) ?? {};
        const status = t.status === 'expected' ? 'PASS' : t.status === 'skipped' ? 'SKIP' : 'FAIL';
        const errs = (res.errors ?? []).map((e) => String(e.message ?? '').replace(/\u001b\[[0-9;]*m/g, '').split('\n').slice(0, 6).join(' ')).slice(0, 5);
        out.push({ file: fileName, title: spec.title, status, seconds: Math.round((res.duration ?? 0) / 100) / 10, errors: errs, annotations: (t.annotations ?? []).map((a) => `${a.type}: ${a.description ?? ''}`) });
      }
    }
    for (const child of suite.suites ?? []) walk(child, child.file ?? fileName);
  };
  for (const s of JSON.parse(fs.readFileSync(file, 'utf8')).suites ?? []) walk(s, s.file ?? s.title);
  return out;
}

/** Copies the run's artifacts and service logs into ART/<label>, redacted; captured secrets become a masked list. */
function collect(label) {
  const src = path.join(CLONE, 'tests', 'e2e', 'artifacts');
  const dest = path.join(ART, label);
  const secretsFile = path.join(src, 'captured-secrets.jsonl');
  if (fs.existsSync(secretsFile)) {
    const items = fs.readFileSync(secretsFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    for (const s of items) redact.add(s.value);
    save(path.join(label, 'captured-secrets-masked.json'), JSON.stringify(items.map((s) => ({ kind: s.kind, secret: `${s.value.slice(0, 6)}…(${s.value.length})`, where: s.where })), null, 2));
  }
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true, filter: (p) => !p.endsWith('captured-secrets.jsonl') && !p.includes(`${path.sep}runs${path.sep}`) });
  }
  for (const f of walkFiles(path.join(CLONE, 'infra', '.logs'))) save(path.join(label, 'service-logs', path.basename(f)), fs.readFileSync(f, 'utf8'));
  for (const f of walkFiles(dest)) {
    if (!/\.(log|json|txt|jsonl|md)$/.test(f)) continue;
    const text = fs.readFileSync(f, 'utf8');
    const clean = redact.apply(text);
    if (clean !== text) fs.writeFileSync(f, clean);
  }
  return dest;
}

async function e2eRun(i) {
  fs.rmSync(path.join(CLONE, 'tests', 'e2e', 'artifacts'), { recursive: true, force: true });
  const r = await exec(`test-e2e-run${i}`, 'npm', ['run', 'test:e2e', '--', '--yes'], { timeoutMs: 45 * 60_000 });
  addSecretsFromClone();
  const dest = collect(`run${i}`);
  const rows = playwrightRows(path.join(dest, 'playwright-results.json'));
  const reset = /e2e:reset done in (\d+) s/.exec(r.stdout)?.[1];
  const entry = {
    run: i,
    exit: r.code,
    timedOut: r.timedOut,
    seconds: Math.round(r.durationMs / 1000),
    resetSeconds: reset ? Number(reset) : null,
    pass: rows.filter((t) => t.status === 'PASS').length,
    fail: rows.filter((t) => t.status === 'FAIL').length,
    skip: rows.filter((t) => t.status === 'SKIP').length,
    tests: rows,
    log: r.log,
  };
  summary.runs.push(entry);
  save(`run${i}/tests.json`, JSON.stringify(rows, null, 2));
  step(`run ${i}: npm run test:e2e exit ${r.code} in ${entry.seconds} s (e2e:reset ${entry.resetSeconds ?? '?'} s); ${entry.pass} pass, ${entry.fail} fail, ${entry.skip} skip`, r.code === 0 && entry.fail === 0, rows.filter((t) => t.status === 'FAIL').map((t) => `${t.title.slice(0, 90)} :: ${t.errors.join(' | ').slice(0, 600)}`));
  return entry;
}

async function demoPass() {
  fs.rmSync(path.join(CLONE, 'tests', 'e2e', 'artifacts'), { recursive: true, force: true });
  const reset = await exec('demo-e2e-reset', 'npm', ['run', 'e2e:reset', '--', '--yes']);
  const prep = await exec('demo-prepare', 'npm', ['run', 'demo:prepare'], { timeoutMs: 600_000 });
  const check = await exec('demo-check', 'npm', ['run', 'test:e2e', '--', '--yes'], { env: { ...STACK_ENV, E2E_RESET: '0', QA_E2E_DEMO: '1', QA_GREP: 'AC-T7-15' }, timeoutMs: 600_000 });
  const dest = collect('demo');
  const rows = playwrightRows(path.join(dest, 'playwright-results.json'));
  summary.demo = {
    resetExit: reset.code,
    resetSeconds: Math.round(reset.durationMs / 1000),
    prepareExit: prep.code,
    prepareSeconds: Math.round(prep.durationMs / 10) / 100,
    prepareOutput: redact.apply(prep.stdout).split('\n').slice(-30),
    checkExit: check.code,
    tests: rows,
  };
  step(`demo pass (AC-T7-15): e2e:reset ${reset.code}, demo:prepare exit ${prep.code} in ${summary.demo.prepareSeconds} s (≤ 180 s), player check exit ${check.code}`, reset.code === 0 && prep.code === 0 && prep.durationMs <= 180_000 && check.code === 0 && rows.some((t) => t.status === 'PASS'), rows.filter((t) => t.status !== 'PASS').map((t) => `${t.status} ${t.title.slice(0, 80)} :: ${t.errors.join(' | ').slice(0, 400)}`));
}

/** What a reset would change: this project's containers (id, start time), volumes, seed.json, data folders, log files. */
async function stackSnapshot() {
  const containers = (await allContainers())
    .filter((c) => c.Config?.Labels?.['com.docker.compose.project'] === PROJECT)
    .map((c) => `${c.Name}|${c.Id.slice(0, 12)}|${c.State?.StartedAt}`)
    .sort();
  const seed = path.join(CLONE, 'infra', '.secrets', 'seed.json');
  return {
    containers,
    volumes: (await projectResources(PROJECT)).volumes.sort(),
    seedSha256: fs.existsSync(seed) ? sha256File(seed).slice(0, 16) : null,
    dataDirs: ['cogniate-app', 'lti-service'].map((d) => `${d}:${fs.existsSync(path.join(CLONE, 'infra', '.data', d))}`),
    logFiles: walkFiles(path.join(CLONE, 'infra', '.logs')).map((f) => path.basename(f)).sort(),
  };
}

/**
 * B-T7-01: in a terminal (pty from `script`), the command asks for "yes"; QA answers "no". Nothing may be deleted.
 * The answer is sent after 8 s: input that reaches the pty before the prompt can be flushed (QA saw this on macOS).
 */
async function confirmCheck(label, npmArgs) {
  const before = await stackSnapshot();
  const env = { ...STACK_ENV };
  delete env.E2E_CONFIRM;
  const r = await exec(`confirm-no-${label}`, 'sh', ['-c', `(sleep 8; printf 'no\\n'; sleep 3) | script -q /dev/null npm ${npmArgs}`], { env, timeoutMs: 180_000 });
  const after = await stackSnapshot();
  const out = `${r.stdout}\n${r.stderr}`;
  const asked = /Type yes to delete the data/.test(out);
  const stopped = /Stopped\. Nothing was deleted\./.test(out);
  const same = JSON.stringify(before) === JSON.stringify(after);
  summary.confirm = { ...(summary.confirm ?? {}), [label]: { exit: r.code, asked, stopped, unchanged: same, before, after } };
  return step(`B-T7-01 confirm check: "npm ${npmArgs}" in a terminal, answer "no" → asks, stops, nothing deleted`, asked && stopped && same && r.code !== 0, [
    `exit ${r.code}; question shown: ${asked}; "Stopped. Nothing was deleted.": ${stopped}; stack unchanged (containers, volumes, seed.json, data folders, logs): ${same}`,
    `snapshot: ${before.containers.length} containers, ${before.volumes.length} volumes, seed ${before.seedSha256 ?? 'none'}`,
  ]);
}

/** A-T7-04: without a terminal and without --yes / E2E_CONFIRM=1, the command must stop (fail closed) and delete nothing. */
async function noTerminalCheck(label, npmArgs) {
  const before = await stackSnapshot();
  const env = { ...STACK_ENV };
  delete env.E2E_CONFIRM;
  const r = await exec(`no-terminal-${label}`, 'npm', npmArgs.split(' '), { env, timeoutMs: 180_000 });
  const after = await stackSnapshot();
  const out = `${r.stdout}\n${r.stderr}`;
  const refused = /No terminal to ask\. Run it with -- --yes, or E2E_CONFIRM=1\. Nothing was deleted\./.test(out);
  const same = JSON.stringify(before) === JSON.stringify(after);
  summary.confirm = { ...(summary.confirm ?? {}), [`no-terminal ${label}`]: { exit: r.code, refused, unchanged: same } };
  return step(`A-T7-04 fail closed: "npm ${npmArgs}" without a terminal and without --yes → stops, nothing deleted`, r.code !== 0 && refused && same, [
    `exit ${r.code}; "No terminal to ask … Nothing was deleted.": ${refused}; stack unchanged: ${same}`,
  ]);
}

async function images() {
  const ours = (await allContainers()).filter((c) => c.Config?.Labels?.['com.docker.compose.project'] === PROJECT);
  const list = ours.map((c) => ({ service: c.Config.Labels['com.docker.compose.service'], image: c.Config.Image, id: c.Image }));
  save('images.json', JSON.stringify(list, null, 2));
  return list;
}

async function teardown() {
  if (opt.keep) return step('teardown skipped (--keep)', true, [`stack ${PROJECT} is still up`]);
  const down = await exec('stack-down', 'npm', ['run', 'stack:down'], { timeoutMs: 300_000 });
  const res = await projectResources(PROJECT);
  if (res.containers.length) await run('docker', ['rm', '-f', '-v', ...res.containers], { timeoutMs: 180_000 });
  if (res.volumes.length) await run('docker', ['volume', 'rm', '-f', ...res.volumes], { timeoutMs: 180_000 });
  if (res.networks.length) await run('docker', ['network', 'rm', ...res.networks], { timeoutMs: 60_000 });
  const left = await projectResources(PROJECT);
  const n = left.containers.length + left.volumes.length + left.networks.length;
  return step(`teardown: stack ${PROJECT} removed with its volumes and networks`, n === 0, [`stack:down exit ${down.code}; left: ${left.containers.length} containers, ${left.volumes.length} volumes, ${left.networks.length} networks`]);
}

// ---------------------------------------------------------------- main

log(`QA-E2E T7 runner ${RUN_ID}\nsource ${SOURCE}\nclone ${CLONE}\nartifacts ${ART}\n`);
let started = false;
try {
  if (!(await preflight())) summary.abort = 'preflight';
  else if (!(await cloneSha())) summary.abort = 'clone';
  else if (!copyFixtures()) summary.abort = 'fixtures';
  else {
    started = true;
    if (!(await setup())) summary.abort = 'setup';
    else {
      for (let i = 1; i <= RUNS; i++) {
        await e2eRun(i);
        if (i === 1) await images();
      }
      if (opt['check-confirm'] && RUNS > 0) {
        await confirmCheck('e2e-reset', 'run e2e:reset');
        await confirmCheck('test-e2e', 'run test:e2e');
        await noTerminalCheck('e2e-reset', 'run e2e:reset');
        await noTerminalCheck('test-e2e', 'run test:e2e');
      }
      if (opt.demo || opt['demo-only']) await demoPass();
      if (RUNS === 0) await images();
    }
  }
} catch (e) {
  step('runner error', false, [String(e?.stack ?? e)]);
} finally {
  if (started) await teardown().catch((e) => step('teardown', false, [String(e)]));
}
save('summary.json', JSON.stringify(summary, null, 2));
const ok = !summary.abort && summary.steps.every((s) => s.ok);
log(`\n== T7 summary: ${ok ? 'ALL OK' : 'FAILURES'}\nruns: ${summary.runs.map((r) => `#${r.run} exit ${r.exit} ${r.seconds} s (${r.pass}/${r.pass + r.fail + r.skip})`).join(', ') || 'none'}\nartifacts: ${ART}`);
process.exit(ok ? 0 : 1);
