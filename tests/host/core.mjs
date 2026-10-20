// Shared core of the QA host runners (T2 onward). Node built-ins only.
// The parts are the ones that run-t1.mjs proved in T1 rounds 1 and 2: preflight, clone, the H1 safety guard,
// in-container suite runs, label-scoped teardown, redaction and the summary. run-t1.mjs keeps its own copy for now.
//
// Charter §3a: QA clones the SHA into a new folder outside the repo and runs its own stack next to the Author's.
// COMPOSE_PROJECT_NAME (must start with "qa-"), PUBLIC_PORT and STACK_SUBNET come from env. The stack is removed
// (containers, volumes, networks with the QA project label) at the end of every run.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  allContainers,
  cidrOverlap,
  dockerInspect,
  httpsLoopback,
  isSecretCandidate,
  networkSubnets,
  portFree,
  projectResources,
  readEnv,
  readSeed,
  readTestReports,
  Redactor,
  run,
  secretsInFile,
  walkFiles,
} from './lib.mjs';

const T1_SERVICES = ['proxy', 'postgres', 'moodle', 'lti-service', 'cogniate-app'];

export function createRunner({ task, defaultProject, extraOptions = {}, extraHelp = '' }) {
  const { values: opt } = parseArgs({
    options: {
      sha: { type: 'string' },
      source: { type: 'string' },
      workdir: { type: 'string' },
      checkout: { type: 'string' },
      'tests-from': { type: 'string' },
      'replace-tests': { type: 'boolean', default: false },
      'only-task-folders': { type: 'string' },
      'clean-project': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
      ...extraOptions,
    },
  });
  const help = `Usage: COMPOSE_PROJECT_NAME=qa-${task.toLowerCase()}-r<N> PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \\
  node tests/host/run-${task.toLowerCase()}.mjs --sha <commit> [options]

  --sha <commit>               Commit to verify (from the Lead). Required unless --checkout.
  --source <path>              Repo to clone from (default: the repo that holds this script).
  --workdir <path>             Clone folder (default: ~/cogniate-qa-runs/<project>-<sha8>-<time>).
  --checkout <path>            Use an existing clone (no clean-clone guarantee).
  --tests-from <path>          tests/ folder to copy into the clone (default: this tests/).
  --replace-tests              Replace the clone's tests/ with --tests-from (QA test fixes after the SHA).
  --only-task-folders <list>   Keep only these tests/acceptance task folders in the clone (for example T2a,T2b).
  --clean-project              Remove leftover containers, volumes and networks of THIS QA project first.
${extraHelp}`;
  if (opt.help) {
    process.stdout.write(help);
    process.exit(0);
  }

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const QA_TESTS_DIR = path.resolve(HERE, '..');
  const SOURCE = path.resolve(opt.source ?? path.join(QA_TESTS_DIR, '..'));
  const PROJECT = process.env.COMPOSE_PROJECT_NAME ?? defaultProject;
  const PUBLIC_PORT = process.env.PUBLIC_PORT ?? '8443';
  const STACK_SUBNET = process.env.STACK_SUBNET ?? '172.29.0.0/16';
  if (!/^qa-[a-z0-9-]+$/.test(PROJECT)) {
    console.error(`COMPOSE_PROJECT_NAME must start with "qa-" (got "${PROJECT}"). QA never runs on another project.`);
    process.exit(2);
  }
  if (!opt.sha && !opt.checkout) {
    console.error(`--sha or --checkout is required.\n\n${help}`);
    process.exit(2);
  }
  const RUN_ID = `${PROJECT}-${(opt.sha ?? 'checkout').slice(0, 8)}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const CLONE = path.resolve(opt.checkout ?? opt.workdir ?? path.join(os.homedir(), 'cogniate-qa-runs', RUN_ID));
  const ART = path.join(QA_TESTS_DIR, 'host', 'artifacts', RUN_ID);
  fs.mkdirSync(path.join(ART, 'cmd'), { recursive: true });

  const redact = new Redactor();
  const results = [];
  const timings = {};
  const state = { h1Verified: false, abort: null, env: null, urls: null, ca: null, seed: null, rawSeed: null, otherBefore: [] };
  let cmdSeq = 0;
  // Inherited npm_* variables (for example npm_config_prefix) would change nested npm commands.
  const BASE_ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('npm_')));
  const STACK_ENV = { ...BASE_ENV, COMPOSE_PROJECT_NAME: PROJECT, PUBLIC_PORT, STACK_SUBNET };

  const log = (line) => process.stdout.write(`${redact.apply(line)}\n`);
  const pass = (ok) => (ok ? 'PASS' : 'FAIL');
  const tail = (text, n = 6) => String(text).trim().split('\n').slice(-n).join(' | ');

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

  function loadStackFiles() {
    state.env = readEnv(path.join(CLONE, '.env'));
    if (state.env) {
      for (const [k, v] of Object.entries(state.env)) if (isSecretCandidate(k, v)) redact.add(v);
      const u = (k) => (state.env[k] ?? '').replace(/\/+$/, '');
      state.urls = { moodle: u('PUBLIC_MOODLE_URL'), lti: u('PUBLIC_LTI_URL'), app: u('PUBLIC_APP_URL'), content: u('PUBLIC_CONTENT_URL') };
    }
    const caFile = path.join(CLONE, 'infra', '.certs', 'root.crt');
    state.ca = fs.existsSync(caFile) ? fs.readFileSync(caFile, 'utf8') : null;
    const secretsDir = path.join(CLONE, 'infra', '.secrets');
    for (const file of walkFiles(secretsDir)) for (const item of secretsInFile(file).items) redact.add(item.value);
    const seedFile = path.join(secretsDir, 'seed.json');
    state.seed = fs.existsSync(seedFile) ? readSeed(seedFile) : null;
    state.rawSeed = fs.existsSync(seedFile) ? JSON.parse(fs.readFileSync(seedFile, 'utf8')) : null;
    if (state.seed) {
      for (const user of Object.values(state.seed.users)) redact.add(user.password);
      redact.add(state.seed.productToken, state.seed.oracleToken);
    }
  }

  async function removeProjectResources() {
    const res = await projectResources(PROJECT);
    if (res.containers.length) await run('docker', ['rm', '-f', '-v', ...res.containers], { timeoutMs: 180_000 });
    if (res.volumes.length) await run('docker', ['volume', 'rm', '-f', ...res.volumes], { timeoutMs: 180_000 });
    if (res.networks.length) await run('docker', ['network', 'rm', ...res.networks], { timeoutMs: 60_000 });
  }

  async function preflight() {
    const notes = [];
    const node = Number(process.versions.node.split('.')[0]);
    const docker = await run('docker', ['version', '--format', '{{.Server.Version}}']);
    const compose = await run('docker', ['compose', 'version', '--short']);
    notes.push(`node ${process.versions.node}, docker ${docker.stdout.trim() || 'n/a'}, compose ${compose.stdout.trim() || 'n/a'}`, `project ${PROJECT}, PUBLIC_PORT ${PUBLIC_PORT}, STACK_SUBNET ${STACK_SUBNET}`);
    let ok = node >= 22 && docker.code === 0 && compose.code === 0;
    if (opt['clean-project']) await removeProjectResources();
    const left = await projectResources(PROJECT);
    if (left.containers.length + left.volumes.length + left.networks.length > 0) {
      ok = false;
      notes.push(`project ${PROJECT} already has ${left.containers.length} containers, ${left.volumes.length} volumes, ${left.networks.length} networks`);
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
    if (task === 'M1' || process.env.QA_M1_LEGACY_GUARD === '1') {
      state.otherVolumesBefore = await protectedVolumes();
      saveText('protected-volumes-before.json', JSON.stringify(state.otherVolumesBefore, null, 2));
    }
    notes.push(`other containers on this Docker host: ${state.otherBefore.length} (not touched by QA)`);
    record('PRE', 'Preflight: tools, free port, free subnet, no leftover QA project', pass(ok), notes);
    if (!ok) state.abort = 'preflight failed';
  }

  async function protectedVolumes() {
    const listed = await run('docker', ['volume', 'ls', '-q']);
    if (listed.code !== 0) throw new Error('Cannot inventory protected Docker volumes');
    const names = listed.stdout.trim().split('\n').filter(Boolean);
    if (!names.length) return [];
    const inspected = await run('docker', ['volume', 'inspect', ...names]);
    if (inspected.code !== 0) throw new Error('Cannot inspect protected Docker volumes');
    return JSON.parse(inspected.stdout)
      .filter((v) => v.Labels?.['com.docker.compose.project'] !== PROJECT)
      .sort((a, b) => a.Name.localeCompare(b.Name));
  }

  async function cloneSha() {
    const notes = [];
    if (!opt.checkout) {
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
    } else notes.push(`using existing checkout ${CLONE} (no clean-clone guarantee)`);
    notes.push(`HEAD ${(await run('git', ['log', '-1', '--format=%H %s'], { cwd: CLONE })).stdout.trim()}`, `clone ${CLONE}`);
    const testsMissing = !fs.existsSync(path.join(CLONE, 'tests', 'package.json'));
    if (testsMissing || opt['replace-tests']) {
      const from = path.resolve(opt['tests-from'] ?? QA_TESTS_DIR);
      const diff = await run('git', ['diff', '--stat', opt.sha ?? 'HEAD', '--', '.'], { cwd: from });
      if (!testsMissing) fs.rmSync(path.join(CLONE, 'tests'), { recursive: true, force: true });
      fs.cpSync(from, path.join(CLONE, 'tests'), {
        recursive: true,
        filter: (src) => !/(^|[/\\])(node_modules|artifacts|test-results|playwright-report|\.tmp)([/\\]|$)/.test(path.relative(from, src)),
      });
      // git diff does not show new (untracked) files, so list them too.
      const untracked = (await run('git', ['ls-files', '--others', '--exclude-standard', '--', '.'], { cwd: from })).stdout
        .split('\n')
        .filter((f) => f && !/(^|\/)(artifacts|node_modules|test-results|playwright-report)\//.test(f));
      notes.push(
        `${testsMissing ? 'tests/ is not in the SHA' : 'tests/ replaced (--replace-tests)'}: copied from ${from}; diff vs SHA: ${diff.stdout.trim().split('\n').pop() || 'none'}; new files not in the SHA: ${untracked.length ? untracked.join(', ') : 'none'}`,
      );
      saveText(
        'tests-diff-vs-sha.txt',
        `${(await run('git', ['diff', opt.sha ?? 'HEAD', '--', '.'], { cwd: from })).stdout}\n# New files (not in the SHA, copied as they are):\n${untracked.map((f) => `#   ${f}`).join('\n') || '#   none'}\n`,
      );
    }
    if (opt['only-task-folders']) {
      const keep = new Set(opt['only-task-folders'].split(',').map((t) => t.trim()));
      const acc = path.join(CLONE, 'tests', 'acceptance');
      const removed = fs.readdirSync(acc, { withFileTypes: true }).filter((d) => d.isDirectory() && /^T\d/.test(d.name) && !keep.has(d.name)).map((d) => d.name);
      for (const d of removed) fs.rmSync(path.join(acc, d), { recursive: true, force: true });
      notes.push(`task folders kept: ${[...keep].join(', ')}; removed: ${removed.join(', ') || 'none'}`);
    }
    record('CLONE', 'Clone the SHA into a new folder', 'PASS', notes);
  }

  /** H1 guard before any stack command: compose must resolve the QA project name. */
  async function composeNameGuard() {
    const r = await exec('compose-config-name', 'docker', ['compose', '-f', 'infra/compose.yaml', '--env-file', '.env', 'config', '--format', 'json']);
    let name = null;
    try {
      name = JSON.parse(r.stdout).name;
    } catch {
      // the post-up check still runs
    }
    if (name && name !== PROJECT) {
      record('H1', 'COMPOSE_PROJECT_NAME sets the compose project (before stack:up)', 'FAIL', [`compose resolves "${name}", not "${PROJECT}"`], [r.log]);
      state.abort = 'H1: the compose project name does not follow COMPOSE_PROJECT_NAME; no stack command was run';
    }
  }

  /** H1 guard after stack:up: the stack runs under the QA project, and no container from this clone has another label. */
  async function checkProject() {
    const containers = await allContainers();
    const clonePaths = [CLONE, fs.realpathSync(CLONE)];
    const ours = containers.filter((c) => c.Config?.Labels?.['com.docker.compose.project'] === PROJECT);
    const intruders = containers.filter((c) => {
      const labels = c.Config?.Labels ?? {};
      const wd = labels['com.docker.compose.project.working_dir'] ?? '';
      return labels['com.docker.compose.project'] !== PROJECT && wd && clonePaths.some((p) => wd === p || wd.startsWith(`${p}/`));
    });
    const services = [...new Set(ours.map((c) => c.Config.Labels['com.docker.compose.service']))].sort();
    const missing = T1_SERVICES.filter((s) => !services.includes(s));
    state.h1Verified = ours.length > 0 && intruders.length === 0;
    record('H1', `The stack runs as ${PROJECT} with the T1 services`, pass(state.h1Verified && missing.length === 0), [
      `services: ${services.join(', ') || 'none'}${missing.length ? `; missing ${missing.join(', ')}` : ''}`,
      ...(intruders.length ? [`DANGER: containers from this clone under another project: ${intruders.map((c) => c.Name).join(', ')}`] : []),
    ]);
    if (!state.h1Verified) state.abort = 'H1: the stack did not start under the QA project; QA stops before any reset, down or e2e command';
    saveText('images.json', JSON.stringify(ours.map((c) => ({ service: c.Config.Labels['com.docker.compose.service'], image: c.Config.Image, id: c.Image })), null, 2));
  }

  async function healthz(url) {
    try {
      const r = await httpsLoopback(`${url}/healthz`, { ca: state.ca, timeoutMs: 5_000 });
      return r.status === 200 ? JSON.parse(r.body) : null;
    } catch {
      return null;
    }
  }

  async function waitHealth(url, predicate, timeoutMs = 120_000) {
    const deadline = Date.now() + timeoutMs;
    let last = null;
    while (Date.now() < deadline) {
      last = await healthz(url);
      if (last && predicate(last)) return { ok: true, last };
      await new Promise((r) => setTimeout(r, 2_000));
    }
    return { ok: false, last };
  }

  /**
   * One in-container run: `npm run test:acceptance` with QA_* env (H14). `expectIds` = AC ids that must have run
   * (a skipped or missing one is a FAIL "not run", for example a knob test whose knob was lost).
   */
  async function containerSuite(label, { env = {}, expectIds = [], fresh = true } = {}) {
    const artifacts = path.join(CLONE, 'tests', 'acceptance', 'artifacts');
    // fresh: false keeps the state files of earlier passes (tasks whose specs share state across passes, e.g. T4b).
    if (fresh) fs.rmSync(artifacts, { recursive: true, force: true });
    const r = await npm(`test-acceptance-${label}`, ['run', 'test:acceptance'], { env: { ...STACK_ENV, ...env }, timeoutMs: 2_400_000 });
    const dest = path.join(ART, `container-${label}`);
    if (process.env.QA_M1_LEGACY_GUARD === '1') {
      // Preserve legacy assertions. Only the evidence transport changes: raw
      // tokens and browser traces stay in the private clone, never shared.
      for (const f of walkFiles(artifacts).filter((f) => /captured-secrets\.jsonl$/.test(f))) {
        for (const line of fs.readFileSync(f, 'utf8').split('\n').filter(Boolean)) redact.add(JSON.parse(line).value);
      }
      for (const f of walkFiles(artifacts)) {
        const rel = path.relative(artifacts, f);
        if (/^(control|state-)|captured-secrets|\.raw\./.test(rel) || !/\.(json|jsonl|log|txt)$/.test(f)) continue;
        saveText(path.join(`container-${label}`, rel), fs.readFileSync(f, 'utf8'));
      }
    } else if (fs.existsSync(artifacts)) fs.cpSync(artifacts, dest, { recursive: true });
    for (const f of walkFiles(path.join(CLONE, 'infra', '.logs'))) saveText(path.join(`container-${label}`, 'service-logs', path.basename(f)), fs.readFileSync(f, 'utf8'));
    const tests = fs.existsSync(dest) ? readTestReports(dest) : [];
    const ran = new Set(tests.filter((t) => t.status !== 'SKIP').map((t) => t.id));
    const notRun = expectIds.filter((id) => !ran.has(id));
    record('SUITE', `In-container suite ${label} (${Object.entries(env).map(([k, v]) => `${k}=${v}`).join(' ') || 'all'}): exit 0, expected ACs ran`, pass(r.code === 0 && tests.length > 0 && notRun.length === 0), [
      `exit ${r.code}; tests reported: ${tests.length}; failed: ${tests.filter((t) => t.status === 'FAIL').length}; skipped: ${tests.filter((t) => t.status === 'SKIP').length}`,
      ...(notRun.length ? [`expected but not run: ${notRun.join(', ')}`] : []),
    ], [r.log, path.relative(QA_TESTS_DIR, dest)]);
    for (const t of tests) if (t.status !== 'SKIP') record(t.id, `[${label}] ${t.title}`, t.status, [], [path.relative(QA_TESTS_DIR, dest)]);
    for (const id of notRun) record(id, `[${label}] expected to run but did not run`, 'FAIL', [], [path.relative(QA_TESTS_DIR, dest)]);
    return { ok: r.code === 0, tests };
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

  async function teardown() {
    const notes = [];
    if (state.h1Verified) notes.push(`npm run stack:down exit ${(await npm('stack-down', ['run', 'stack:down'], { timeoutMs: 300_000 })).code}`);
    await removeProjectResources();
    const left = await projectResources(PROJECT);
    const leftCount = left.containers.length + left.volumes.length + left.networks.length;
    notes.push(`left after cleanup: ${left.containers.length} containers, ${left.volumes.length} volumes, ${left.networks.length} networks`);
    const after = await allContainers();
    const changed = state.otherBefore.filter((b) => {
      const now = after.find((c) => c.Id === b.id);
      return !now || now.State?.StartedAt !== b.startedAt;
    });
    if (state.otherVolumesBefore) {
      const afterVolumes = await protectedVolumes();
      const changedVolumes = state.otherVolumesBefore.filter((before) =>
        JSON.stringify(afterVolumes.find((v) => v.Name === before.Name)) !== JSON.stringify(before));
      saveText('protected-volumes-after.json', JSON.stringify(afterVolumes, null, 2));
      record('M3-ISOLATION', 'Existing non-QA-run containers and volumes remain unchanged',
        pass(changed.length === 0 && changedVolumes.length === 0),
        [`containers changed: ${changed.length}; volumes changed: ${changedVolumes.map((v) => v.Name).join(', ') || 'none'}`]);
    }
    notes.push(`other projects' containers that stopped or restarted: ${changed.length ? changed.map((c) => c.name).join(', ') : 'none'} (information)`);
    record('TEARDOWN', `QA stack ${PROJECT} removed with its volumes and networks`, pass(leftCount === 0), notes);
  }

  function summarize() {
    const order = ['PASS', 'MANUAL', 'INFO', 'WARN', 'SKIP', 'FAIL'];
    const byId = new Map();
    for (const r of results) {
      if (['INFO', 'WARN'].includes(r.status)) continue;
      const prev = byId.get(r.id);
      byId.set(r.id, !prev || order.indexOf(r.status) > order.indexOf(prev) ? r.status : prev);
    }
    saveText('summary.json', JSON.stringify({ runId: RUN_ID, task, sha: opt.sha ?? null, clone: CLONE, project: PROJECT, publicPort: PUBLIC_PORT, stackSubnet: STACK_SUBNET, abort: state.abort, timings, aggregate: Object.fromEntries(byId), results }, null, 2));
    log(`\n== ${task} summary (per id; worst result wins)`);
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

  /** Runs preflight and clone, then `steps` with logs and teardown in finally, then exits. */
  async function main(steps) {
    log(`QA ${task} host runner ${RUN_ID}\nproject ${PROJECT}, PUBLIC_PORT ${PUBLIC_PORT}, STACK_SUBNET ${STACK_SUBNET}\nsource ${SOURCE}\nclone ${CLONE}\n`);
    await preflight();
    if (!state.abort) await cloneSha();
    if (!state.abort) {
      try {
        await steps();
        if (process.env.QA_M1_LEGACY_GUARD === '1') {
          const health = await Promise.all([state.urls.lti, state.urls.app].map(healthz));
          const ok = health.every((h) => h?.profile === 'default' && Array.isArray(h.knobs) && h.knobs.length === 0)
            && Array.isArray(health[0]?.simulation_profiles) && health[0].simulation_profiles.length === 0;
          record('M3-LEGACY-DEFAULT', 'Legacy runner returns both services to default with no knobs or simulation profiles',
            pass(ok), health.map((h) => JSON.stringify(h)));
        }
      } catch (e) {
        record('ERROR', 'Runner error', 'FAIL', [e.stack ?? String(e)]);
      } finally {
        await collectLogs().catch((e) => log(`log collection failed: ${e.message}`));
        await teardown().catch((e) => record('TEARDOWN', 'QA stack removed', 'FAIL', [e.message]));
      }
    }
    const ok = summarize();
    finalRedaction();
    process.exit(ok ? 0 : 1);
  }

  return {
    opt, PROJECT, PUBLIC_PORT, STACK_SUBNET, CLONE, ART, SOURCE, QA_TESTS_DIR, STACK_ENV, state, timings, redact,
    log, record, pass, tail, saveText, exec, npm, loadStackFiles, composeNameGuard, checkProject, healthz, waitHealth, containerSuite, main,
  };
}
