#!/usr/bin/env node
// QA host runner for T8 (black-box, from tasks/T8.md, app contract §11, security §10a). Node built-ins only.
//
//   COMPOSE_PROJECT_NAME=qa-t8-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
//   COURSE_FIXTURES_DIR=<repo>/docs/raw/data/courses node tests/host/run-t8.mjs --sha <commit> [--replace-tests]
//
// Steps:
// 1. setup: npm run stack:doctor (Lead: first), npm ci, gen-env, compose name guard, npm run build (portal, AC-T8-07
//    and AC-T8-10), stack:up (starts the Build Runner), seed; the course zips into the clone (SHA-256).
// 2. Main pass: QA_TASK=T5a,T8 with QA_GREP for SETUP-T5a (Thanh's connection and the SCORM course) and the T8 ACs
//    without a knob (AC-T8-02, -04, -05, -06, -08, -09, -10).
// 3. Knob pass BUILD_RUNNER_HOLD=1 (stack:restart -- cogniate-app --env …): AC-T8-03; restore.
// 4. Knob pass BUILD_RUNNER_FAIL_AT=backup: AC-T8-07; restore (knobs: []).
// During every pass the runner answers the T8 host actions of the tests (tests/acceptance/lib/host-control.ts), only
// these, only for this QA project (build items are found by the label org.cogniate.stack=<project>):
//   build-inspect   AC-T8-03: docker network inspect of this stack's build network, the networks of its containers,
//                   and DNS for moodle.test inside the build Moodle (php gethostbyname; read-only, named by the AC).
//   build-release   AC-T8-03: removes the hold flag file that the build_hold log event names (inside infra/.data).
//   build-leftovers AC-T8-03, -07: docker ps -a, volume ls, network ls for cogniate-build-* of this stack.
//   moodle-restore  AC-T8-05: docker cp of QA's downloaded .mbz into the stack Moodle, then
//                   admin/cli/restore_backup.php --file=<mbz> --categoryid=1 (the step that the AC names).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRunner } from './core.mjs';

const r = createRunner({ task: 'T8', defaultProject: 'qa-t8-r1' });
const ZIPS = [
  { name: 'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-scorm-v2.zip', sha256: 'a685744e5fd9de21c203c3b2f47916ef1079532196ed870df89a00ab8ee76df7' },
  { name: 'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-html.zip', sha256: '9f04d3abd65f85e362b2dca5207cc4b86ffa286e4b1a73923c157b69321f3f6d' },
];
const MAIN = ['SETUP-T8', 'AC-T8-02', 'AC-T8-04', 'AC-T8-05', 'AC-T8-06', 'AC-T8-08', 'AC-T8-09', 'AC-T8-10'];
const CONTROL = () => path.join(r.CLONE, 'tests', 'acceptance', 'artifacts', 'control');
const COMPOSE = ['compose', '-f', 'infra/compose.yaml', '--env-file', '.env'];
const LABEL = () => `label=org.cogniate.stack=${r.PROJECT}`;

async function setup() {
  const ci = await r.npm('root-npm-ci', ['ci', '--no-audit', '--no-fund'], { timeoutMs: 900_000 });
  const gen = await r.npm('gen-env', ['run', 'gen-env']);
  r.loadStackFiles();
  await r.composeNameGuard();
  if (r.state.abort) return false;
  const doctor = await r.npm('stack-doctor', ['run', 'stack:doctor'], { timeoutMs: 300_000 });
  r.record('DOCTOR', 'npm run stack:doctor (before the stack starts)', r.pass(doctor.code === 0), [`exit ${doctor.code}; ${r.tail(doctor.stdout, 12)}`], [doctor.log]);
  const build = await r.npm('build', ['run', 'build'], { timeoutMs: 900_000 });
  const up = build.code === 0 ? await r.npm('stack-up', ['run', 'stack:up'], { timeoutMs: 900_000 }) : null;
  const seed = up?.code === 0 ? await r.npm('seed', ['run', 'seed'], { timeoutMs: 900_000 }) : null;
  r.loadStackFiles();
  const ok = ci.code === 0 && gen.code === 0 && build.code === 0 && up?.code === 0 && seed?.code === 0;
  r.record('SETUP', 'npm ci, gen-env, build, stack:up, seed', r.pass(ok), [
    `npm ci ${ci.code}, gen-env ${gen.code}, build ${build.code}, stack:up ${up?.code ?? 'not run'}, seed ${seed?.code ?? 'not run'}`,
  ], [ci.log, gen.log, build.log, up?.log, seed?.log].filter(Boolean));
  await r.checkProject();
  return !r.state.abort && ok;
}

function copyFixtures() {
  const sources = [process.env.COURSE_FIXTURES_DIR, path.join(r.SOURCE, 'docs', 'raw', 'data', 'courses')].filter(Boolean);
  const dest = path.join(r.CLONE, 'tests', 'fixtures', 'courses');
  fs.mkdirSync(dest, { recursive: true });
  const notes = [];
  let ok = true;
  for (const z of ZIPS) {
    const src = sources.map((d) => path.join(d, z.name)).find((f) => fs.existsSync(f));
    const sha = src ? crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex') : null;
    if (!src || sha !== z.sha256) {
      ok = false;
      notes.push(`${z.name}: ${src ? `SHA-256 ${sha}` : 'not found'}`);
      continue;
    }
    fs.copyFileSync(src, path.join(dest, z.name));
    notes.push(`${z.name}: copied from ${path.dirname(src)}`);
  }
  r.record('FIXTURES', 'Course zips copied into the clone (tests/fixtures/courses, git-ignored), SHA-256 checked', r.pass(ok), notes);
  return ok;
}

// ---------------------------------------------------------------- host actions

const lines = (s) => String(s).split('\n').map((x) => x.trim()).filter(Boolean);
const docker = (name, args, timeoutMs = 120_000) => r.exec(name, 'docker', args, { timeoutMs });

function writeOut(name, data) {
  fs.writeFileSync(path.join(CONTROL(), name), JSON.stringify(data, null, 2));
  return name;
}

/** This stack's cogniate-build-* items of one kind (container, volume, network). */
async function buildItems(kind) {
  const args = kind === 'container' ? ['ps', '-a'] : [kind, 'ls'];
  const fmt = kind === 'container' ? '{{.Names}}' : '{{.Name}}';
  const labelled = lines((await docker(`build-${kind}s`, [...args, '--filter', LABEL(), '--format', fmt])).stdout);
  const byName = lines((await docker(`build-${kind}s-any`, [...args, '--filter', 'name=cogniate-build-', '--format', fmt])).stdout);
  return { labelled, cogniateBuildAny: byName };
}

const ACTIONS = {
  'build-inspect': async (req) => {
    const nets = [];
    const names = lines((await docker('build-net-names', ['network', 'ls', '--filter', 'name=cogniate-build-', '--format', '{{.Name}}'])).stdout);
    let moodle = '';
    for (const n of names) {
      const insp = JSON.parse((await docker('build-net-inspect', ['network', 'inspect', n])).stdout || '[]')[0] ?? {};
      const containers = [];
      let ours = (insp.Labels ?? {})['org.cogniate.stack'] === r.PROJECT;
      for (const c of Object.values(insp.Containers ?? {})) {
        const ci = JSON.parse((await docker('build-container-inspect', ['inspect', c.Name])).stdout || '[]')[0] ?? {};
        if ((ci.Config?.Labels ?? {})['org.cogniate.stack'] === r.PROJECT) ours = true;
        containers.push({ name: c.Name, networks: Object.keys(ci.NetworkSettings?.Networks ?? {}) });
        if (/moodle/i.test(c.Name) && !/postgres|db/i.test(c.Name)) moodle = moodle || c.Name;
      }
      if (ours) nets.push({ name: n, internal: insp.Internal === true, containers });
    }
    let dns = null;
    if (moodle) {
      const res = await docker('build-dns', ['exec', moodle, 'php', '-r', 'echo gethostbyname("moodle.test"), "|", gethostbyname("example.com");']);
      dns = { container: moodle, code: res.code, stdout: res.stdout.trim(), stderr: r.tail(res.stderr, 3) };
    }
    return { code: 0, out: writeOut(`t8-inspect-${req.id}.json`, { project: r.PROJECT, networks: nets, dns }) };
  },
  'build-release': async (req) => {
    const target = path.resolve(String(req.holdFile ?? ''));
    const allowed = [path.join(r.CLONE, 'infra', '.data'), path.join(fs.realpathSync(r.CLONE), 'infra', '.data')];
    let real = target;
    try {
      real = fs.realpathSync(target);
    } catch {
      return { code: 4, out: writeOut(`t8-release-${req.id}.json`, { holdFile: target, removed: false, reason: 'not found' }) };
    }
    if (!allowed.some((a) => real.startsWith(`${a}${path.sep}`))) return { code: 5, out: writeOut(`t8-release-${req.id}.json`, { holdFile: target, removed: false, reason: 'outside infra/.data' }) };
    fs.rmSync(real, { force: true });
    return { code: 0, out: writeOut(`t8-release-${req.id}.json`, { holdFile: target, removed: !fs.existsSync(real) }) };
  },
  'build-leftovers': async (req) => {
    const data = { project: r.PROJECT, containers: await buildItems('container'), volumes: await buildItems('volume'), networks: await buildItems('network') };
    return { code: 0, out: writeOut(`t8-leftovers-${req.id}.json`, data) };
  },
  'moodle-restore': async (req) => {
    const name = String(req.mbz ?? '');
    if (!/^qa-t8-[\w-]+\.mbz$/.test(name)) return { code: 2 };
    const file = path.join(CONTROL(), name);
    if (!fs.existsSync(file)) return { code: 2 };
    const id = lines((await r.exec('moodle-container', 'docker', [...COMPOSE, 'ps', '-q', 'moodle'])).stdout)[0] ?? '';
    if (!id) return { code: 3 };
    const cp = await docker('restore-copy', ['cp', file, `${id}:/tmp/${name}`]);
    const res = cp.code === 0 ? await docker('restore-backup', ['exec', id, 'php', '/var/www/html/admin/cli/restore_backup.php', `--file=/tmp/${name}`, '--categoryid=1'], 900_000) : null;
    const data = { copy: cp.code, restore: res?.code ?? null, stdout: r.tail(res?.stdout ?? '', 40), stderr: r.tail(res?.stderr ?? cp.stderr, 10) };
    return { code: res?.code ?? cp.code, out: writeOut(`t8-restore-${req.id}.json`, data) };
  },
};

/** Watches the control folder of the clone and answers each request once, in order. Returns a stop function. */
function startHostControl() {
  const dir = CONTROL();
  const done = new Set();
  const log = [];
  let busy = false;
  const timer = setInterval(async () => {
    if (busy || !fs.existsSync(dir)) return;
    const next = fs.readdirSync(dir).filter((f) => /^req-[\w-]+\.json$/.test(f)).sort().find((f) => !done.has(f));
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
    const answer = { action: req.action, ok: Boolean(fn) && res.code === 0, code: res.code, startedAt, endedAt: Date.now(), ...(res.out ? { out: res.out } : {}) };
    fs.writeFileSync(path.join(dir, `ack-${req.id}.json`), JSON.stringify(answer));
    log.push(`${new Date(startedAt).toISOString()} ${req.action}: exit ${res.code} in ${answer.endedAt - startedAt} ms${res.error ? ` (${res.error})` : ''}`);
    busy = false;
  }, 500);
  return () => {
    clearInterval(timer);
    return log;
  };
}

// ---------------------------------------------------------------- passes

async function withHostControl(label, fn) {
  const stop = startHostControl();
  try {
    await fn();
  } finally {
    const log = stop();
    r.record('HOSTCTL', `Host actions asked for by the ${label} tests (whitelist: build-inspect, build-release, build-leftovers, moodle-restore)`, 'PASS', log.length ? log : ['none']);
  }
}

async function knobPass(name, value, ac) {
  const has = (b) => (b.knobs ?? []).some((k) => (k.name ?? k) === name && String(k.value ?? '') === value);
  const on = await r.npm(`restart-app-${name}`, ['run', 'stack:restart', '--', 'cogniate-app', '--env', `${name}=${value}`], { timeoutMs: 300_000 });
  const active = await r.waitHealth(r.state.urls.app, has);
  r.record('KNOB', `stack:restart -- cogniate-app --env ${name}=${value} activates the knob`, r.pass(on.code === 0 && active.ok), [`exit ${on.code}; /healthz ${JSON.stringify(active.last)}`], [on.log]);
  try {
    if (active.ok) await withHostControl(`knob ${name}`, () => r.containerSuite(`knob-${name}`, { env: { QA_TASK: 'T8', QA_GREP: `${ac}.*knob` }, expectIds: [ac], fresh: false }));
  } finally {
    const off = await r.npm(`restart-app-default-${name}`, ['run', 'stack:restart', '--', 'cogniate-app'], { timeoutMs: 300_000 });
    const cleared = await r.waitHealth(r.state.urls.app, (b) => Array.isArray(b.knobs) && b.knobs.length === 0);
    r.record('KNOB', 'stack:restart -- cogniate-app restores knobs: []', r.pass(off.code === 0 && cleared.ok), [`exit ${off.code}`], [off.log]);
  }
}

await r.main(async () => {
  if (!(await setup())) return;
  if (!copyFixtures()) return;
  await withHostControl('T8 main', () =>
    r.containerSuite('T8', { env: { QA_TASK: 'T5a,T8', QA_GREP: `SETUP-T5a|${MAIN.join('|')}` }, expectIds: MAIN.filter((x) => x.startsWith('AC-')) }),
  );
  await knobPass('BUILD_RUNNER_HOLD', '1', 'AC-T8-03');
  await knobPass('BUILD_RUNNER_FAIL_AT', 'backup', 'AC-T8-07');
});
