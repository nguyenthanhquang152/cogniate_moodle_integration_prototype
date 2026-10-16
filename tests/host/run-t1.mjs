#!/usr/bin/env node
// QA host-side runner for T1 (black-box, from docs/architecture/tasks/T1.md + Lead-approved changes).
// Node built-ins only: it runs before `npm ci`. Run it from the QA working copy, not from the clone:
//
//   COMPOSE_PROJECT_NAME=qa-t1-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
//     node tests/host/run-t1.mjs --sha <commit>
//
// Charter §3a: QA clones the SHA into a new folder outside the repo and runs its own stack next to the
// Author's stack. The three env values above make the QA stack separate. The runner removes the QA stack
// (containers, volumes, networks) at the end of every run.
//
// Order: preflight → clone → AC-T1-01 → H8 canary → LC-T1-06 → gen-env (LC-T1-01, LC-T1-02) → AC-T1-02 →
// H1 isolation + AC-T1-09 → AC-T1-05 → AC-T1-13 → H2 login → AC-T1-12 (host) → LC-T1-03/04/05 → H3 →
// in-container suite pass 1 → AC-T1-11 → AC-T1-10 (reset + in-container suite pass 2) → logs → teardown.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  allContainers,
  cidrOverlap,
  COURSE_SHORTNAMES,
  dockerInspect,
  httpsLoopback,
  isSecretCandidate,
  isSecretKeyName,
  MOODLE_USERNAMES,
  moodleWebLogin,
  moodleWs,
  networkSubnets,
  parseEnv,
  portFree,
  projectResources,
  readEnv,
  readSeed,
  readTestReports,
  Redactor,
  run,
  secretsInFile,
  serviceContainer,
  sha256File,
  walkDirsNamed,
  walkFiles,
} from './lib.mjs';

// ---------------------------------------------------------------- options

const { values: opt } = parseArgs({
  options: {
    sha: { type: 'string' },
    source: { type: 'string' },
    workdir: { type: 'string' },
    checkout: { type: 'string' },
    'fixtures-dir': { type: 'string' },
    'tests-from': { type: 'string' },
    'skip-reset': { type: 'boolean', default: false },
    'clean-project': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

const HELP = `Usage: COMPOSE_PROJECT_NAME=qa-t1-r<N> PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \\
  node tests/host/run-t1.mjs --sha <commit> [options]

  --sha <commit>        Commit to verify (from the Lead). Required unless --checkout.
  --source <path>       Repo to clone from (default: the repo that holds this script).
  --workdir <path>      Clone folder (default: ~/cogniate-qa-runs/<project>-<sha8>-<time>).
  --checkout <path>     Use an existing clone. No clean-clone guarantee (AC-T1-01 is then informative).
  --fixtures-dir <path> COURSE_FIXTURES_DIR, when the clone has no course zips.
  --tests-from <path>   tests/ folder to copy into the clone if the SHA has none (default: this tests/).
  --skip-reset          Skip AC-T1-10 (reset and second in-container pass).
  --clean-project       Remove leftover containers, volumes and networks of THIS QA project first.
`;

if (opt.help) {
  process.stdout.write(HELP);
  process.exit(0);
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const QA_TESTS_DIR = path.resolve(HERE, '..');
const SOURCE = path.resolve(opt.source ?? path.join(QA_TESTS_DIR, '..'));
const PROJECT = process.env.COMPOSE_PROJECT_NAME ?? 'qa-t1-r1';
const PUBLIC_PORT = process.env.PUBLIC_PORT ?? '8443';
const STACK_SUBNET = process.env.STACK_SUBNET ?? '172.29.0.0/16';

if (!/^qa-[a-z0-9-]+$/.test(PROJECT)) {
  console.error(`COMPOSE_PROJECT_NAME must start with "qa-" (got "${PROJECT}"). QA never runs on another project.`);
  process.exit(2);
}
if (!opt.sha && !opt.checkout) {
  console.error(`--sha or --checkout is required.\n\n${HELP}`);
  process.exit(2);
}

const RUN_ID = `${PROJECT}-${(opt.sha ?? 'checkout').slice(0, 8)}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const CLONE = path.resolve(opt.checkout ?? opt.workdir ?? path.join(os.homedir(), 'cogniate-qa-runs', RUN_ID));
const ART = path.join(QA_TESTS_DIR, 'host', 'artifacts', RUN_ID);
fs.mkdirSync(path.join(ART, 'cmd'), { recursive: true });

const FIXTURES = [
  { name: 'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-scorm-v2.zip', sha256: 'a685744e5fd9de21c203c3b2f47916ef1079532196ed870df89a00ab8ee76df7' },
  { name: 'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-html.zip', sha256: '9f04d3abd65f85e362b2dca5207cc4b86ffa286e4b1a73923c157b69321f3f6d' },
];
const NODE_SERVICES = ['lti-service', 'cogniate-app'];
const T1_SERVICES = ['proxy', 'postgres', 'moodle', 'lti-service', 'cogniate-app'];
const URL_KEYS = ['PUBLIC_MOODLE_URL', 'PUBLIC_LTI_URL', 'PUBLIC_APP_URL', 'PUBLIC_CONTENT_URL'];
const README_COMMANDS = [
  'demo', 'demo:browser', 'gen-env', 'stack:up', 'stack:down', 'stack:reset', 'stack:logs', 'stack:restart',
  'seed', 'stack:moodle-reach-check', 'fixtures:check', 'test:acceptance', 'test:e2e',
];

// ---------------------------------------------------------------- state and recording

const redact = new Redactor();
const results = [];
const timings = {};
const state = { h1Verified: false, abort: null, env: null, urls: null, ca: null, seed: null, otherBefore: [] };
let cmdSeq = 0;

// Inherited npm_* variables (for example npm_config_prefix) would change nested npm commands.
const BASE_ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('npm_')));
const STACK_ENV = { ...BASE_ENV, COMPOSE_PROJECT_NAME: PROJECT, PUBLIC_PORT, STACK_SUBNET };

function log(line) {
  process.stdout.write(`${redact.apply(line)}\n`);
}

function record(id, title, status, notes = [], evidence = []) {
  const entry = { id, title, status, notes: notes.map((n) => redact.apply(n)), evidence };
  results.push(entry);
  log(`${status.padEnd(6)} ${id.padEnd(9)} ${title}${notes.length ? `\n         ${entry.notes.join('\n         ')}` : ''}`);
}

function saveText(rel, text) {
  const file = path.join(ART, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, redact.apply(text));
  return path.relative(QA_TESTS_DIR, file);
}

async function exec(name, cmd, args, { cwd = CLONE, env = STACK_ENV, timeoutMs = 600_000 } = {}) {
  const r = await run(cmd, args, { cwd, env, timeoutMs });
  const rel = saveText(
    path.join('cmd', `${String(++cmdSeq).padStart(2, '0')}-${name.replace(/[^\w.-]+/g, '_')}.log`),
    `$ ${cmd} ${args.join(' ')}\ncwd: ${cwd}\nexit: ${r.code}${r.timedOut ? ' (TIMEOUT)' : ''}\nduration_ms: ${r.durationMs}\n\n--- stdout\n${r.stdout}\n--- stderr\n${r.stderr}\n`,
  );
  return { ...r, log: rel };
}

const npm = (name, args, o) => exec(name, 'npm', args, o);
const pass = (ok) => (ok ? 'PASS' : 'FAIL');
const tail = (text, n = 6) => String(text).trim().split('\n').slice(-n).join(' | ');

function loadStackFiles() {
  state.env = readEnv(path.join(CLONE, '.env'));
  if (state.env) {
    for (const [k, v] of Object.entries(state.env)) if (isSecretCandidate(k, v)) redact.add(v);
    state.urls = {
      moodle: (state.env.PUBLIC_MOODLE_URL ?? '').replace(/\/+$/, ''),
      lti: (state.env.PUBLIC_LTI_URL ?? '').replace(/\/+$/, ''),
      app: (state.env.PUBLIC_APP_URL ?? '').replace(/\/+$/, ''),
      content: (state.env.PUBLIC_CONTENT_URL ?? '').replace(/\/+$/, ''),
    };
  }
  const caFile = path.join(CLONE, 'infra', '.certs', 'root.crt');
  state.ca = fs.existsSync(caFile) ? fs.readFileSync(caFile, 'utf8') : null;
  const secretsDir = path.join(CLONE, 'infra', '.secrets');
  for (const file of walkFiles(secretsDir)) for (const item of secretsInFile(file).items) redact.add(item.value);
  const seedFile = path.join(secretsDir, 'seed.json');
  state.seed = fs.existsSync(seedFile) ? readSeed(seedFile) : null;
  if (state.seed) {
    for (const u of Object.values(state.seed.users)) redact.add(u.password);
    redact.add(state.seed.productToken, state.seed.oracleToken);
  }
}

// ---------------------------------------------------------------- steps

async function preflight() {
  const notes = [];
  const node = Number(process.versions.node.split('.')[0]);
  const docker = await run('docker', ['version', '--format', '{{.Server.Version}}']);
  const compose = await run('docker', ['compose', 'version', '--short']);
  notes.push(`node ${process.versions.node}, docker ${docker.stdout.trim() || 'n/a'}, compose ${compose.stdout.trim() || 'n/a'}`);
  notes.push(`project ${PROJECT}, PUBLIC_PORT ${PUBLIC_PORT}, STACK_SUBNET ${STACK_SUBNET}`);
  let ok = node >= 22 && docker.code === 0 && compose.code === 0;

  if (opt['clean-project']) await removeProjectResources();
  const left = await projectResources(PROJECT);
  const leftCount = left.containers.length + left.volumes.length + left.networks.length;
  if (leftCount > 0) {
    ok = false;
    notes.push(`project ${PROJECT} already has ${left.containers.length} containers, ${left.volumes.length} volumes, ${left.networks.length} networks (use --clean-project or a new round name)`);
  }
  if (!(await portFree(PUBLIC_PORT))) {
    ok = false;
    notes.push(`127.0.0.1:${PUBLIC_PORT} is busy`);
  }
  const clash = (await networkSubnets()).filter((n) => cidrOverlap(n.subnet, STACK_SUBNET));
  if (clash.length > 0) {
    ok = false;
    notes.push(`STACK_SUBNET overlaps: ${clash.map((n) => `${n.name} ${n.subnet}`).join(', ')}`);
  }
  state.otherBefore = (await allContainers())
    .filter((c) => c.Config?.Labels?.['com.docker.compose.project'] !== PROJECT)
    .map((c) => ({ id: c.Id, name: c.Name, startedAt: c.State?.StartedAt, project: c.Config?.Labels?.['com.docker.compose.project'] ?? '' }));
  notes.push(`other containers on this Docker host: ${state.otherBefore.length} (not touched by QA)`);
  record('PRE', 'Preflight: tools, free port, free subnet, no leftover QA project', pass(ok), notes);
  if (!ok) state.abort = 'preflight failed';
}

async function cloneSha() {
  const notes = [];
  if (opt.checkout) {
    notes.push(`using existing checkout ${CLONE} (no clean-clone guarantee)`);
  } else {
    if (fs.existsSync(CLONE)) {
      record('CLONE', 'Clone the SHA into a new folder', 'FAIL', [`${CLONE} already exists`]);
      state.abort = 'clone folder exists';
      return;
    }
    const c = await exec('git-clone', 'git', ['clone', '--quiet', '--no-hardlinks', SOURCE, CLONE], { cwd: os.tmpdir() });
    let co = await exec('git-checkout', 'git', ['checkout', '--quiet', '--detach', opt.sha]);
    if (co.code !== 0) {
      await exec('git-fetch-sha', 'git', ['fetch', '--quiet', SOURCE, opt.sha]);
      co = await exec('git-checkout-2', 'git', ['checkout', '--quiet', '--detach', opt.sha]);
    }
    if (c.code !== 0 || co.code !== 0) {
      record('CLONE', 'Clone the SHA into a new folder', 'FAIL', [tail(c.stderr + co.stderr)], [c.log, co.log]);
      state.abort = 'clone failed';
      return;
    }
  }
  const head = (await run('git', ['log', '-1', '--format=%H %s'], { cwd: CLONE })).stdout.trim();
  notes.push(`HEAD ${head}`, `clone ${CLONE}`);
  const dirty = ['node_modules', '.env', 'infra/.secrets', 'infra/.certs', 'infra/.logs', 'tests/node_modules'].filter((p) =>
    fs.existsSync(path.join(CLONE, p)),
  );
  if (dirty.length > 0 && !opt.checkout) notes.push(`not clean: ${dirty.join(', ')}`);

  if (!fs.existsSync(path.join(CLONE, 'tests', 'package.json'))) {
    const from = path.resolve(opt['tests-from'] ?? QA_TESTS_DIR);
    fs.cpSync(from, path.join(CLONE, 'tests'), {
      recursive: true,
      filter: (src) => !/(^|[/\\])(node_modules|artifacts|test-results|playwright-report|\.tmp)([/\\]|$)/.test(path.relative(from, src)),
    });
    notes.push(`tests/ is not in the SHA: copied from ${from}`);
  }
  record('CLONE', 'Clone the SHA into a new folder', pass(dirty.length === 0 || Boolean(opt.checkout)), notes);
}

function fixturesDir() {
  const has = (dir) => FIXTURES.every((f) => fs.existsSync(path.join(dir, f.name)));
  const inClone = path.join(CLONE, 'docs', 'raw', 'data', 'courses');
  if (opt['fixtures-dir']) return { dir: path.resolve(opt['fixtures-dir']), override: true };
  if (has(inClone)) return { dir: inClone, override: false };
  return { dir: path.join(SOURCE, 'docs', 'raw', 'data', 'courses'), override: true };
}

async function acT101() {
  const ci = await npm('root-npm-ci', ['ci', '--no-audit', '--no-fund'], { timeoutMs: 900_000 });
  const check = ci.code === 0 ? await npm('root-check', ['run', 'check'], { timeoutMs: 900_000 }) : null;
  const ws = await npm('root-workspaces', ['query', '.workspace']);
  let workspaces = [];
  try {
    workspaces = JSON.parse(ws.stdout).map((w) => w.location);
  } catch {
    // npm query failed; reported below
  }
  record('AC-T1-01', 'Clean clone: npm ci && npm run check exit 0', pass(ci.code === 0 && check?.code === 0), [
    `npm ci exit ${ci.code}, npm run check exit ${check?.code ?? 'not run'}`,
    ...(check && check.code !== 0 ? [tail(check.stdout + check.stderr)] : []),
  ], [ci.log, check?.log].filter(Boolean));
  const inTests = workspaces.filter((l) => l === 'tests' || l.startsWith('tests/'));
  record('H8', 'tests/ is not a root workspace', pass(ws.code === 0 && inTests.length === 0), [`workspaces: ${workspaces.join(', ') || 'none'}`], [ws.log]);
  return ci.code === 0;
}

async function h8Canary() {
  const canary = path.join(CLONE, 'tests', 'acceptance', 'T1', 'zz-qa-canary.test.ts');
  fs.writeFileSync(
    canary,
    "// QA canary (H8): the root `npm run check` must not see tests/**. Lint, typecheck and test all fail on this file.\n" +
      "const notANumber: number = 'canary';\n" +
      "it('qa canary', () => { debugger; throw new Error('QA canary: the root check ran tests/** ' + notANumber); });\n",
  );
  try {
    const r = await npm('root-check-with-canary', ['run', 'check'], { timeoutMs: 900_000 });
    const mentions = /zz-qa-canary/.test(r.stdout + r.stderr);
    record('H8', 'Root npm run check excludes tests/** (a failing canary file in tests/ does not break it)', pass(r.code === 0 && !mentions), [
      `exit ${r.code}${mentions ? ', output mentions the canary' : ''}`,
    ], [r.log]);
  } finally {
    fs.rmSync(canary, { force: true });
  }
}

async function lcT106() {
  const { dir, override } = fixturesDir();
  const notes = [`fixtures dir: ${dir}${override ? ' (COURSE_FIXTURES_DIR set by QA)' : ' (default)'}`];
  if (override) STACK_ENV.COURSE_FIXTURES_DIR = dir;
  const oracleOk = FIXTURES.every((f) => fs.existsSync(path.join(dir, f.name)) && sha256File(path.join(dir, f.name)) === f.sha256);
  notes.push(`QA oracle SHA-256 of both zips: ${oracleOk ? 'match' : 'MISMATCH or missing'}`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-fixtures-'));
  const make = (name, mutate) => {
    const d = path.join(tmp, name);
    fs.mkdirSync(d);
    for (const f of FIXTURES) fs.copyFileSync(path.join(dir, f.name), path.join(d, f.name));
    mutate?.(d);
    return d;
  };
  try {
    const def = await npm('fixtures-check-default', ['run', 'fixtures:check']);
    const good = await npm('fixtures-check-good', ['run', 'fixtures:check'], { env: { ...STACK_ENV, COURSE_FIXTURES_DIR: make('good') } });
    const bad = await npm('fixtures-check-changed', ['run', 'fixtures:check'], {
      env: { ...STACK_ENV, COURSE_FIXTURES_DIR: make('changed', (d) => fs.appendFileSync(path.join(d, FIXTURES[1].name), Buffer.from([0]))) },
    });
    const missing = await npm('fixtures-check-missing', ['run', 'fixtures:check'], {
      env: { ...STACK_ENV, COURSE_FIXTURES_DIR: make('missing', (d) => fs.rmSync(path.join(d, FIXTURES[1].name))) },
    });
    notes.push(`exit codes: default ${def.code}, copy ${good.code}, changed byte ${bad.code}, missing file ${missing.code}`);
    const ok = oracleOk && def.code === 0 && good.code === 0 && bad.code !== 0 && missing.code !== 0;
    record('LC-T1-06', 'npm run fixtures:check: 0 for the real zips, non-zero for a changed or missing zip', pass(ok), notes, [def.log, good.log, bad.log, missing.log]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function genEnv() {
  const r = await npm('gen-env', ['run', 'gen-env']);
  const before = await projectResources(PROJECT);
  loadStackFiles();
  const envFile = path.join(CLONE, '.env');
  const mode = fs.existsSync(envFile) ? (fs.statSync(envFile).mode & 0o777).toString(8) : 'missing';
  record('GEN-ENV', 'npm run gen-env makes .env with mode 600 (T1.md scope)', pass(r.code === 0 && mode === '600'), [`exit ${r.code}, .env mode ${mode}`], [r.log]);

  // LC-T1-02: four public URLs, https, with PUBLIC_PORT
  const urlNotes = [];
  let urlsOk = Boolean(state.env);
  for (const key of URL_KEYS) {
    const value = state.env?.[key];
    let u = null;
    try {
      u = new URL(value);
    } catch {
      // invalid
    }
    const portOk = u && (PUBLIC_PORT === '443' ? u.port === '' : u.port === PUBLIC_PORT);
    if (!u || u.protocol !== 'https:' || !portOk) urlsOk = false;
    urlNotes.push(`${key}=${value ?? 'missing'}`);
  }
  for (const [key, expected] of [['PUBLIC_PORT', PUBLIC_PORT], ['STACK_SUBNET', STACK_SUBNET], ['COMPOSE_PROJECT_NAME', PROJECT]]) {
    if (state.env?.[key] !== undefined && state.env[key] !== expected) {
      urlsOk = false;
      urlNotes.push(`.env ${key}=${state.env[key]} but QA env is ${expected}`);
    }
  }
  record('LC-T1-02', `.env has the four PUBLIC_*_URL values (https, port ${PUBLIC_PORT})`, pass(urlsOk), urlNotes);

  // LC-T1-01: CA + one leaf cert with four SANs, made before any container exists
  const certNotes = [];
  let certOk = false;
  const certsDir = path.join(CLONE, 'infra', '.certs');
  try {
    const root = new crypto.X509Certificate(fs.readFileSync(path.join(certsDir, 'root.crt')));
    const names = Object.values(state.urls ?? {}).map((u) => (u ? new URL(u).hostname : ''));
    const leaves = walkFiles(certsDir)
      .filter((f) => /\.(crt|pem)$/.test(f) && path.basename(f) !== 'root.crt')
      .flatMap((f) => {
        try {
          return [{ file: path.basename(f), cert: new crypto.X509Certificate(fs.readFileSync(f)) }];
        } catch {
          return [];
        }
      })
      .filter((l) => !l.cert.ca);
    const good = leaves.filter(
      (l) => names.every((n) => n && (l.cert.subjectAltName ?? '').includes(`DNS:${n}`)) && l.cert.checkIssued(root) && l.cert.verify(root.publicKey),
    );
    certOk = root.ca && good.length >= 1 && before.containers.length === 0;
    certNotes.push(
      `root.crt CA=${root.ca}; leaf certs: ${leaves.map((l) => l.file).join(', ') || 'none'}; leaf with all 4 SANs signed by root: ${good.map((l) => l.file).join(', ') || 'none'}`,
      `project containers after gen-env: ${before.containers.length} (must be 0: certs come before containers)`,
    );
  } catch (e) {
    certNotes.push(`cannot read certs: ${e.message}`);
  }
  record('LC-T1-01', 'gen-env makes infra/.certs/root.crt (CA) and one leaf cert for the four names before containers start', pass(certOk), certNotes);
}

async function prePull() {
  const r = await exec('compose-pull', 'docker', ['compose', '-f', 'infra/compose.yaml', '--env-file', '.env', '--profile', 'test', 'pull', '--ignore-buildable', '--ignore-pull-failures'], { timeoutMs: 1_800_000 });
  record('PULL', 'Pull images before the timed run (AC-T1-02 rule: images already pulled)', r.code === 0 ? 'INFO' : 'WARN', [`exit ${r.code}, ${Math.round(r.durationMs / 1000)} s`], [r.log]);
}

async function composeNameGuard() {
  const r = await exec('compose-config-name', 'docker', ['compose', '-f', 'infra/compose.yaml', '--env-file', '.env', 'config', '--format', 'json']);
  let name = null;
  try {
    name = JSON.parse(r.stdout).name;
  } catch {
    // reported below
  }
  if (name && name !== PROJECT) {
    record('H1', 'COMPOSE_PROJECT_NAME from env sets the compose project (checked before stack:up)', 'FAIL', [`compose resolves project "${name}", not "${PROJECT}"`], [r.log]);
    state.abort = 'H1: the compose project name does not follow COMPOSE_PROJECT_NAME; no stack command was run';
  } else if (!name) {
    log(`INFO   compose config did not resolve (exit ${r.code}); the post-up H1 check still runs`);
  }
}

async function acT102() {
  const started = Date.now();
  const up = await npm('stack-up', ['run', 'stack:up'], { timeoutMs: 900_000 });
  const seed = up.code === 0 ? await npm('seed-1', ['run', 'seed'], { timeoutMs: Math.max(60_000, 900_000 - (Date.now() - started)) }) : null;
  const seconds = Math.round((Date.now() - started) / 1000);
  timings['AC-T1-02 stack:up + seed'] = seconds;
  loadStackFiles();
  const printed = `${up.stdout}\n${seed?.stdout ?? ''}`;
  const missingUrls = Object.values(state.urls ?? {}).filter((u) => !u || !printed.includes(u));
  const ok = up.code === 0 && seed?.code === 0 && seconds <= 900 && missingUrls.length === 0;
  record('AC-T1-02', 'No stack volumes: npm run stack:up && npm run seed exit 0 in <= 15 min and print the four URLs', pass(ok), [
    `stack:up exit ${up.code}, seed exit ${seed?.code ?? 'not run'}, ${seconds} s`,
    ...(missingUrls.length ? [`URLs not printed: ${missingUrls.join(', ')}`] : []),
    ...(up.code !== 0 ? [tail(up.stdout + up.stderr)] : []),
  ], [up.log, seed?.log].filter(Boolean));
  return up.code === 0;
}

async function isolationAndPorts() {
  const containers = await allContainers();
  const clonePaths = [CLONE, fs.realpathSync(CLONE)];
  const ours = containers.filter((c) => c.Config?.Labels?.['com.docker.compose.project'] === PROJECT);
  const intruders = containers.filter((c) => {
    const labels = c.Config?.Labels ?? {};
    const wd = labels['com.docker.compose.project.working_dir'] ?? '';
    return labels['com.docker.compose.project'] !== PROJECT && wd && clonePaths.some((p) => wd === p || wd.startsWith(`${p}/`));
  });
  const services = [...new Set(ours.map((c) => c.Config.Labels['com.docker.compose.service']))].sort();
  const missingServices = T1_SERVICES.filter((s) => !services.includes(s));
  const subnets = (await networkSubnets()).filter((n) => n.project === PROJECT).map((n) => n.subnet);
  const h1Ok = ours.length > 0 && intruders.length === 0 && missingServices.length === 0 && subnets.includes(STACK_SUBNET);
  state.h1Verified = ours.length > 0 && intruders.length === 0;
  record('H1', 'The stack runs as COMPOSE_PROJECT_NAME on STACK_SUBNET, with the five T1 services', pass(h1Ok), [
    `services: ${services.join(', ') || 'none'}${missingServices.length ? `; missing ${missingServices.join(', ')}` : ''}`,
    `subnets of ${PROJECT}: ${subnets.join(', ') || 'none'} (want ${STACK_SUBNET})`,
    ...(intruders.length ? [`DANGER: containers from this clone run under another project: ${intruders.map((c) => `${c.Name} (${c.Config.Labels['com.docker.compose.project']})`).join(', ')}`] : []),
  ]);
  if (!state.h1Verified) {
    state.abort = 'H1: the stack did not start under the QA project; QA stops before any reset, down or e2e command';
    return;
  }

  const bindings = ours.flatMap((c) =>
    Object.entries(c.NetworkSettings?.Ports ?? {}).flatMap(([port, binds]) =>
      (binds ?? []).map((b) => ({ service: c.Config.Labels['com.docker.compose.service'], port, hostIp: b.HostIp, hostPort: b.HostPort })),
    ),
  );
  const ok = bindings.length === 1 && bindings[0].hostIp === '127.0.0.1' && bindings[0].hostPort === PUBLIC_PORT;
  record('AC-T1-09', `Exactly one published port: 127.0.0.1:${PUBLIC_PORT}; Moodle 8080 and Postgres 5432 are not published`, pass(ok), [
    `bindings: ${bindings.map((b) => `${b.service} ${b.hostIp}:${b.hostPort}->${b.port}`).join(', ') || 'none'}`,
  ]);
  saveText('images.json', JSON.stringify(ours.map((c) => ({ service: c.Config.Labels['com.docker.compose.service'], image: c.Config.Image, id: c.Image })), null, 2));
}

async function acT105() {
  const r = await npm('moodle-reach-check', ['run', 'stack:moodle-reach-check'], { timeoutMs: 180_000 });
  const match = /\{[^{}]*"status"\s*:\s*"ok"[^{}]*\}/.exec(r.stdout);
  let body = null;
  try {
    body = match ? JSON.parse(match[0]) : null;
  } catch {
    // reported below
  }
  record('AC-T1-05', "stack:moodle-reach-check prints the JSON body of Moodle's download_file_content(<lti>/healthz)", pass(r.code === 0 && body?.service === 'lti-service'), [
    `exit ${r.code}; JSON found: ${match ? match[0] : 'none'}`,
  ], [r.log]);
}

async function acT113(label) {
  const notes = [];
  let ok = true;
  const script =
    "fetch(process.argv[1]).then(r=>console.log(JSON.stringify({status:r.status,redirected:r.redirected})))" +
    ".catch(e=>{console.log(JSON.stringify({error:String((e&&e.cause&&(e.cause.code||e.cause.message))||e.message)}));process.exit(3)})";
  for (const service of NODE_SERVICES) {
    const id = await serviceContainer(PROJECT, service);
    if (!id) {
      ok = false;
      notes.push(`${service}: no running container`);
      continue;
    }
    const r = await exec(`fetch-moodle-from-${service}-${label}`, 'docker', ['exec', id, 'node', '-e', script, `${state.urls.moodle}/login/index.php`], { timeoutMs: 60_000 });
    const out = r.stdout.trim().split('\n').pop() ?? '';
    if (!/"status":200\b/.test(out)) ok = false;
    notes.push(`${service}: ${out || tail(r.stderr)}`);
  }
  record('AC-T1-13', `fetch('${state.urls.moodle}/login/index.php') from lti-service and cogniate-app returns 200 (${label})`, pass(ok), notes);
}

async function h2Login(label) {
  const notes = [];
  let ok = Boolean(state.seed) && state.seed.missing.length === 0;
  if (!state.seed) notes.push('seed.json missing');
  else if (state.seed.missing.length) notes.push(`seed.json missing: ${state.seed.missing.join(', ')}`);
  if (ok) {
    for (const name of MOODLE_USERNAMES) {
      const u = state.seed.users[name];
      const r = await moodleWebLogin(state.urls.moodle, u.username, u.password, state.ca).catch((e) => ({ ok: false, detail: e.message }));
      const idOk = r.ok && r.userId === u.id;
      if (!idOk) ok = false;
      notes.push(`${name}: login ${r.ok ? 'ok' : 'failed'} (${r.detail}), testsession id ${r.userId ?? '-'} vs seed id ${u.id}`);
    }
  }
  record('H2', `seed.json passwords sign in at Moodle and the user ids match (${label})`, pass(ok), notes);
  return ok;
}

function seedFingerprint() {
  if (!state.seed) return null;
  return JSON.stringify({
    users: MOODLE_USERNAMES.map((n) => [n, state.seed.users[n]?.id, state.seed.users[n]?.password]),
    courses: COURSE_SHORTNAMES.map((s) => [s, state.seed.courses[s]]),
    tokens: [state.seed.productToken, state.seed.oracleToken],
  });
}

async function acT112Host() {
  const before = seedFingerprint();
  const r = await npm('seed-2', ['run', 'seed'], { timeoutMs: 900_000 });
  loadStackFiles();
  const same = before !== null && before === seedFingerprint();
  record('AC-T1-12', 'npm run seed a second time exits 0; users, course ids, passwords and both tokens stay the same', pass(r.code === 0 && same), [
    `exit ${r.code}; seed.json ${same ? 'unchanged' : 'CHANGED or missing'} (counts of users, services, tokens: in-container suite)`,
  ], [r.log]);
}

async function lcDemo() {
  const before = seedFingerprint();
  const r = await npm('demo', ['run', 'demo'], { timeoutMs: 1_200_000 });
  loadStackFiles();
  const missing = [...Object.values(state.urls ?? {}), ...MOODLE_USERNAMES].filter((s) => !r.stdout.includes(s));
  const same = before === seedFingerprint();
  record('LC-T1-03', 'npm run demo (again, on a running stack) exits 0 and prints the four URLs and the user names', pass(r.code === 0 && missing.length === 0 && same), [
    `exit ${r.code}; not printed: ${missing.join(', ') || 'none'}; seed.json ${same ? 'unchanged' : 'CHANGED'}`,
  ], [r.log]);

  const list = await npm('npm-run-list', ['run']);
  const listed = /(^|\s)demo:browser(\s|$)/m.test(list.stdout);
  record('LC-T1-04', 'npm run demo:browser exists (opens a throwaway Chrome profile under .tmp/)', listed ? 'MANUAL' : 'FAIL', [
    listed
      ? `MANUAL: in ${CLONE} run "npm run demo:browser"; expect Chrome with a profile under .tmp/ that opens ${state.urls?.moodle} with no certificate warning; attach a screenshot to qa.md`
      : 'script demo:browser is not listed by npm run',
  ], [list.log]);
}

function lcReadme() {
  const file = path.join(CLONE, 'infra', 'README.md');
  if (!fs.existsSync(file)) {
    record('LC-T1-05', 'infra/README.md has one command table', 'FAIL', ['infra/README.md missing']);
    return;
  }
  const tables = [];
  let current = null;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (line.trim().startsWith('|')) {
      current ??= [];
      current.push(line);
    } else if (current) {
      tables.push(current.join('\n'));
      current = null;
    }
  }
  if (current) tables.push(current.join('\n'));
  const has = (table, cmd) => new RegExp(`npm run ${cmd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w:-])`).test(table);
  const best = tables.map((t) => ({ t, missing: README_COMMANDS.filter((c) => !has(t, c)) })).sort((a, b) => a.missing.length - b.missing.length)[0];
  record('LC-T1-05', 'infra/README.md has one command table with every stack command', pass(Boolean(best) && best.missing.length === 0), [
    `tables: ${tables.length}; missing in the best table: ${best?.missing.join(', ') || (best ? 'none' : 'no table')}`,
  ]);
}

async function waitHealth(url, predicate, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let last = 'no answer';
  while (Date.now() < deadline) {
    try {
      const r = await httpsLoopback(`${url}/healthz`, { ca: state.ca, timeoutMs: 5_000 });
      last = `HTTP ${r.status} ${r.body.slice(0, 200)}`;
      if (r.status === 200 && predicate(JSON.parse(r.body))) return { ok: true, last };
    } catch (e) {
      last = e.message;
    }
    await new Promise((res) => setTimeout(res, 2_000));
  }
  return { ok: false, last };
}

async function h3Knobs() {
  const cases = [
    { service: 'lti-service', url: state.urls.lti, knob: 'LTIK_TTL_SECONDS', other: state.urls.app },
    { service: 'cogniate-app', url: state.urls.app, knob: 'REF_TTL_SECONDS', other: state.urls.lti },
  ];
  for (const c of cases) {
    const notes = [];
    const t0 = Date.now() - 2_000;
    const on = await npm(`restart-${c.service}-knob`, ['run', 'stack:restart', '--', c.service, '--env', `${c.knob}=600`], { timeoutMs: 300_000 });
    const active = await waitHealth(c.url, (b) => JSON.stringify(b.knobs ?? []).includes(c.knob));
    const otherClean = await waitHealth(c.other, (b) => Array.isArray(b.knobs) && b.knobs.length === 0, 20_000);
    const logFile = path.join(CLONE, 'infra', '.logs', `${c.service}.jsonl`);
    const logged = fs.existsSync(logFile) && fs.readFileSync(logFile, 'utf8').split('\n').some((line) => {
      try {
        const e = JSON.parse(line);
        return e.event === 'test_knob_active' && Date.parse(e.ts) >= t0 && line.includes(c.knob);
      } catch {
        return false;
      }
    });
    const off = await npm(`restart-${c.service}-default`, ['run', 'stack:restart', '--', c.service], { timeoutMs: 300_000 });
    const cleared = await waitHealth(c.url, (b) => Array.isArray(b.knobs) && b.knobs.length === 0);
    notes.push(
      `restart with ${c.knob}=600: exit ${on.code}; /healthz knobs has it: ${active.ok} (${active.last})`,
      `log event test_knob_active with ${c.knob}: ${logged}; other service still knobs []: ${otherClean.ok}`,
      `restart without --env: exit ${off.code}; knobs [] again: ${cleared.ok}`,
    );
    const ok = on.code === 0 && active.ok && logged && otherClean.ok && off.code === 0 && cleared.ok;
    record('H3', `${c.service}: stack:restart --env sets a knob (healthz + test_knob_active log); no --env restores defaults`, pass(ok), notes, [on.log, off.log]);
  }
}

async function containerSuite(label) {
  const artifacts = path.join(CLONE, 'tests', 'acceptance', 'artifacts');
  fs.rmSync(artifacts, { recursive: true, force: true });
  const r = await npm(`test-acceptance-${label}`, ['run', 'test:acceptance'], { timeoutMs: 1_800_000 });
  const dest = path.join(ART, `container-${label}`);
  if (fs.existsSync(artifacts)) fs.cpSync(artifacts, dest, { recursive: true });
  const tests = fs.existsSync(dest) ? readTestReports(dest) : [];
  record('SUITE', `In-container suite (npm run test:acceptance, ${label}): exit 0`, pass(r.code === 0 && tests.length > 0), [
    `exit ${r.code}; tests reported: ${tests.length}; failed: ${tests.filter((t) => t.status === 'FAIL').length}`,
  ], [r.log, path.relative(QA_TESTS_DIR, dest)]);
  for (const t of tests) record(t.id, `[${label}] ${t.title}`, t.status, [], [path.relative(QA_TESTS_DIR, dest)]);
  return r.code === 0;
}

async function acT111() {
  const notes = [];
  const findings = [];
  const candidates = [];
  const relClone = (f) => path.relative(CLONE, f);
  const example = readEnv(path.join(CLONE, '.env.example')) ?? {};

  // Sources in the clone: every .env* (not .env.example), infra/.secrets/**, **/.data/**, private keys in infra/.certs.
  const envFiles = walkFiles(CLONE).filter((f) => /^\.env(\..+)?$/.test(path.basename(f)) && path.basename(f) !== '.env.example');
  for (const f of envFiles) {
    for (const [key, value] of Object.entries(parseEnv(fs.readFileSync(f, 'utf8')))) {
      if (!isSecretCandidate(key, value)) continue;
      if (!isSecretKeyName(key) && example[key] === value) continue; // tracked non-secret default
      candidates.push({ source: relClone(f), key, value });
    }
  }
  const dataFiles = walkDirsNamed(CLONE, '.data').flatMap((d) => walkFiles(d));
  const certKeys = walkFiles(path.join(CLONE, 'infra', '.certs')).filter((f) => /\.key$/.test(f));
  for (const f of [...walkFiles(path.join(CLONE, 'infra', '.secrets')), ...dataFiles, ...certKeys]) {
    for (const item of secretsInFile(f).items) candidates.push({ source: relClone(f), key: item.key, value: item.value });
  }
  // Values from the source workspace too (Q-T0-11): a committed file can hold the Author's own dev values.
  const sourceEnvFiles = walkFiles(SOURCE, { skipDirs: ['node_modules', '.git', '.research_cache', 'raw', 'tests'] }).filter(
    (f) => /^\.env(\..+)?$/.test(path.basename(f)) && path.basename(f) !== '.env.example',
  );
  for (const f of sourceEnvFiles) {
    for (const [key, value] of Object.entries(parseEnv(fs.readFileSync(f, 'utf8')))) {
      if (isSecretCandidate(key, value) && isSecretKeyName(key)) candidates.push({ source: `source:${path.relative(SOURCE, f)}`, key, value });
    }
  }
  for (const c of candidates) redact.add(c.value);

  const unique = [...new Map(candidates.map((c) => [c.value, c])).values()];
  for (const c of unique) {
    const r = await run('git', ['grep', '-l', '-F', '-e', c.value, 'HEAD', '--'], { cwd: CLONE });
    if (r.code === 0) findings.push(`${c.source} ${c.key} → ${r.stdout.trim().split('\n').map((l) => l.replace(/^HEAD:/, '')).join(', ')}`);
    else if (r.code !== 1) findings.push(`${c.source} ${c.key} → git grep error ${r.code}`);
  }
  notes.push(`secret values checked: ${unique.length} (from ${envFiles.length} env files, ${dataFiles.length} .data files, infra/.secrets, ${certKeys.length} key files, ${sourceEnvFiles.length} source env files)`);

  const ignoredPaths = ['.env', 'infra/.certs/root.crt', 'infra/.secrets/seed.json', 'infra/.logs/x.jsonl'];
  const notIgnored = [];
  for (const p of ignoredPaths) if ((await run('git', ['check-ignore', '-q', p], { cwd: CLONE })).code !== 0) notIgnored.push(p);
  const tracked = (await run('git', ['ls-files'], { cwd: CLONE })).stdout.split('\n').filter(
    (f) => /(^|\/)\.env(\.|$)/.test(f) && !f.endsWith('.env.example') || /^infra\/\.(certs|secrets|logs)\//.test(f) || /(^|\/)\.data\//.test(f),
  );
  const exampleSecrets = Object.entries(example).filter(([k, v]) => isSecretKeyName(k) && v !== '').map(([k]) => k);
  const envFile = path.join(CLONE, '.env');
  const mode = fs.existsSync(envFile) ? (fs.statSync(envFile).mode & 0o777).toString(8) : 'missing';

  // gen-env must make random values: compare with the source workspace .env (same keys).
  const sourceEnv = readEnv(path.join(SOURCE, '.env')) ?? {};
  const sameAsSource = Object.entries(state.env ?? {}).filter(([k, v]) => isSecretKeyName(k) && isSecretCandidate(k, v) && sourceEnv[k] === v).map(([k]) => k);

  notes.push(
    `values found in tracked files: ${findings.length ? findings.join('; ') : 'none'}`,
    `not git-ignored: ${notIgnored.join(', ') || 'none'}; tracked secret paths: ${tracked.join(', ') || 'none'}`,
    `.env.example secret keys with a value: ${exampleSecrets.join(', ') || 'none'}; .env mode ${mode}`,
    `secret keys equal to the source workspace .env (not random): ${sameAsSource.join(', ') || 'none'}`,
  );
  const ok = findings.length === 0 && notIgnored.length === 0 && tracked.length === 0 && exampleSecrets.length === 0 && mode === '600' && sameAsSource.length === 0;
  record('AC-T1-11', 'No secret value from .env*, infra/.secrets/**, **/.data/** is in tracked files; secret paths are ignored', pass(ok), notes);
}

async function acT110() {
  const notes = [];
  if (!state.seed?.productToken || !state.seed?.oracleToken) {
    record('AC-T1-10', 'Reset gives a fresh site', 'FAIL', ['seed.json has no product or oracle token; the marker test cannot run']);
    return false;
  }
  const marker = `QA-MARKER-${crypto.randomBytes(4).toString('hex')}`;
  let markerMade = false;
  try {
    await moodleWs(state.urls.moodle, state.seed.productToken, 'core_course_create_courses', {
      courses: [{ fullname: 'QA reset marker', shortname: marker, categoryid: 1 }],
    }, state.ca);
    const found = await moodleWs(state.urls.moodle, state.seed.oracleToken, 'core_course_get_courses_by_field', { field: 'shortname', value: marker }, state.ca);
    markerMade = found.courses?.length === 1;
  } catch (e) {
    notes.push(`marker course not made: ${e.message}`);
  }
  const rootBefore = sha256File(path.join(CLONE, 'infra', '.certs', 'root.crt'));
  const envBefore = sha256File(path.join(CLONE, '.env'));
  const passwordsBefore = JSON.stringify(MOODLE_USERNAMES.map((n) => state.seed.users[n].password));

  const started = Date.now();
  const reset = await npm('stack-reset', ['run', 'stack:reset'], { timeoutMs: 600_000 });
  const afterReset = await projectResources(PROJECT);
  const up = reset.code === 0 ? await npm('stack-up-after-reset', ['run', 'stack:up'], { timeoutMs: 900_000 }) : null;
  const seed = up?.code === 0 ? await npm('seed-after-reset', ['run', 'seed'], { timeoutMs: 900_000 }) : null;
  timings['AC-T1-10 reset + up + seed'] = Math.round((Date.now() - started) / 1000);
  loadStackFiles();

  let markerGone = false;
  let courseSet = [];
  try {
    const found = await moodleWs(state.urls.moodle, state.seed.oracleToken, 'core_course_get_courses_by_field', { field: 'shortname', value: marker }, state.ca);
    markerGone = (found.courses ?? []).length === 0;
    const all = await moodleWs(state.urls.moodle, state.seed.oracleToken, 'core_course_get_courses_by_field', {}, state.ca);
    courseSet = (all.courses ?? []).filter((c) => c.format !== 'site').map((c) => c.shortname).sort();
  } catch (e) {
    notes.push(`after reset, WS check failed: ${e.message}`);
  }
  const rootSame = rootBefore === sha256File(path.join(CLONE, 'infra', '.certs', 'root.crt'));
  const envSame = envBefore === sha256File(path.join(CLONE, '.env'));
  const passwordsSame = Boolean(state.seed) && passwordsBefore === JSON.stringify(MOODLE_USERNAMES.map((n) => state.seed.users[n]?.password));
  const loginOk = await h2Login('after reset');
  notes.push(
    `reset exit ${reset.code}, up exit ${up?.code ?? 'not run'}, seed exit ${seed?.code ?? 'not run'}, ${timings['AC-T1-10 reset + up + seed']} s`,
    `volumes of ${PROJECT} right after reset: ${afterReset.volumes.length}`,
    `marker course made before: ${markerMade}; gone after: ${markerGone}; non-site courses: ${courseSet.join(', ') || 'none'}`,
    `root.crt kept: ${rootSame} (LC-T1-01); .env kept: ${envSame}; seed passwords same: ${passwordsSame}; logins work: ${loginOk}`,
  );
  const ok = reset.code === 0 && up?.code === 0 && seed?.code === 0 && markerMade && markerGone &&
    JSON.stringify(courseSet) === JSON.stringify([...COURSE_SHORTNAMES].sort()) && rootSame && envSame && passwordsSame && loginOk;
  record('AC-T1-10', 'stack:reset && stack:up && seed gives a fresh site (marker gone, two courses) and the .env passwords still work', pass(ok), notes, [reset.log, up?.log, seed?.log].filter(Boolean));
  record('LC-T1-01', 'stack:reset keeps infra/.certs/root.crt', pass(rootSame));
  return up?.code === 0 && seed?.code === 0;
}

async function collectLogs() {
  const { containers } = await projectResources(PROJECT);
  for (const c of await dockerInspect(containers)) {
    const service = c.Config?.Labels?.['com.docker.compose.service'] ?? c.Name.replace(/^\//, '');
    const r = await run('docker', ['logs', '--timestamps', c.Id], { timeoutMs: 60_000 });
    saveText(path.join('docker-logs', `${service}-${c.Id.slice(0, 8)}.log`), `${r.stdout}\n--- stderr\n${r.stderr}`);
  }
  for (const f of walkFiles(path.join(CLONE, 'infra', '.logs'))) saveText(path.join('service-logs', path.basename(f)), fs.readFileSync(f, 'utf8'));
}

async function removeProjectResources() {
  const res = await projectResources(PROJECT);
  if (res.containers.length) await run('docker', ['rm', '-f', '-v', ...res.containers], { timeoutMs: 180_000 });
  if (res.volumes.length) await run('docker', ['volume', 'rm', '-f', ...res.volumes], { timeoutMs: 180_000 });
  if (res.networks.length) await run('docker', ['network', 'rm', ...res.networks], { timeoutMs: 60_000 });
}

async function teardown() {
  const notes = [];
  if (state.h1Verified) {
    const down = await npm('stack-down', ['run', 'stack:down'], { timeoutMs: 300_000 });
    notes.push(`npm run stack:down exit ${down.code}`);
  }
  await removeProjectResources(); // only resources labelled with the QA project
  const left = await projectResources(PROJECT);
  const leftCount = left.containers.length + left.volumes.length + left.networks.length;
  notes.push(`left after cleanup: ${left.containers.length} containers, ${left.volumes.length} volumes, ${left.networks.length} networks`);

  const after = await allContainers();
  const changed = state.otherBefore.filter((b) => {
    const now = after.find((c) => c.Id === b.id);
    return !now || now.State?.StartedAt !== b.startedAt;
  });
  notes.push(`other projects' containers that stopped or restarted during the run: ${changed.length ? changed.map((c) => `${c.name} (${c.project || 'no project'})`).join(', ') : 'none'} (information: the Author may restart its own stack)`);
  record('TEARDOWN', `QA stack ${PROJECT} removed with its volumes and networks`, pass(leftCount === 0), notes);
}

function summarize() {
  const order = ['PASS', 'MANUAL', 'INFO', 'WARN', 'SKIP', 'FAIL'];
  const byId = new Map();
  for (const r of results) {
    if (['INFO', 'WARN'].includes(r.status)) continue;
    const prev = byId.get(r.id);
    const status = !prev ? r.status : order.indexOf(r.status) > order.indexOf(prev) ? r.status : prev;
    byId.set(r.id, status);
  }
  const summary = { runId: RUN_ID, sha: opt.sha ?? null, clone: CLONE, project: PROJECT, publicPort: PUBLIC_PORT, stackSubnet: STACK_SUBNET, abort: state.abort, timings, aggregate: Object.fromEntries(byId), results };
  saveText('summary.json', JSON.stringify(summary, null, 2));
  log('\n== T1 summary (per id; worst result wins)');
  for (const [id, status] of [...byId.entries()].sort()) log(`${status.padEnd(6)} ${id}`);
  if (state.abort) log(`\nABORTED: ${state.abort}`);
  log(`\nArtifacts: ${ART}\nClone: ${CLONE}`);
  return [...byId.values()].every((s) => s === 'PASS' || s === 'MANUAL') && !state.abort;
}

function finalRedaction() {
  for (const f of walkFiles(ART)) {
    if (!/\.(log|json|txt|jsonl|md|html)$/.test(f)) continue;
    const text = fs.readFileSync(f, 'utf8');
    const clean = redact.apply(text);
    if (clean !== text) fs.writeFileSync(f, clean);
  }
}

// ---------------------------------------------------------------- main

async function main() {
  log(`QA T1 host runner ${RUN_ID}\nproject ${PROJECT}, PUBLIC_PORT ${PUBLIC_PORT}, STACK_SUBNET ${STACK_SUBNET}\nsource ${SOURCE}\nclone ${CLONE}\n`);
  await preflight();
  if (state.abort) return;
  await cloneSha();
  if (state.abort) return;
  try {
    const installed = await acT101();
    if (installed) await h8Canary();
    await lcT106();
    await genEnv();
    await prePull();
    await composeNameGuard();
    if (state.abort) return;
    const up = await acT102();
    await isolationAndPorts();
    if (!state.abort && (!state.urls?.moodle || !state.ca)) state.abort = 'no PUBLIC_*_URL in .env or no infra/.certs/root.crt';
    if (state.abort || !up) {
      state.abort ??= 'stack:up failed';
      return;
    }
    await acT105();
    await acT113('first run');
    await h2Login('first run');
    await acT112Host();
    await lcDemo();
    lcReadme();
    await h3Knobs();
    await containerSuite('pass1');
    await acT111();
    if (opt['skip-reset']) record('AC-T1-10', 'Reset gives a fresh site', 'SKIP', ['--skip-reset']);
    else if (await acT110()) {
      await acT113('after reset');
      await containerSuite('pass2');
    }
  } catch (e) {
    record('ERROR', 'Runner error', 'FAIL', [e.stack ?? String(e)]);
  } finally {
    await collectLogs().catch((e) => log(`log collection failed: ${e.message}`));
    await teardown().catch((e) => record('TEARDOWN', 'QA stack removed', 'FAIL', [e.message]));
  }
}

await main();
const ok = summarize();
finalRedaction();
process.exit(ok ? 0 : 1);
