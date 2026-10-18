#!/usr/bin/env node
// QA host runner for T5a, T5b and T6 (black-box, from tasks/T5a.md, T5b.md, T6.md). Node built-ins only.
// T6 reads the T5 result rows (AC-T6-08, AC-T6-14), so it runs after T5b on the same stack (--tasks T5a,T5b,T6).
//
//   COMPOSE_PROJECT_NAME=qa-t5a-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
//   COURSE_FIXTURES_DIR=<repo>/docs/raw/data/courses node tests/host/run-t5.mjs --sha <commit> [--tasks T5a,T5b]
//
// Steps:
// 1. setup: npm ci, gen-env, compose name guard, stack:up + seed, H1 check; the course zips into the clone (SHA-256).
// 2. T5a pass: QA_TASK=T5a (SETUP-T5a makes the connection, publications and activities).
// 3. Knob pass: stack:restart -- cogniate-app --env PLAY_TTL_SECONDS=20 → the AC-T5-15 knob test; restore.
// 4. T5b pass (if selected): QA_TASK=T5b with the state of step 2 (fresh: false). During this pass the runner answers
//    the host actions that the tests ask for (tests/acceptance/lib/host-control.ts): "docker compose stop moodle",
//    "docker compose start moodle" (AC-T5-14, -30) and "npm run stack:restart -- lti-service" (AC-T5-31). Only these
//    three commands, only for this QA project.
// 5. T6 pass (if selected): QA_TASK=T6 (fresh: false). With T6, setup runs `npm run build` before `stack:up`
//    (tasks/T6.md: "after npm run build && npm run stack:up && npm run seed").
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRunner } from './core.mjs';

const r = createRunner({
  task: 'T5',
  defaultProject: 'qa-t5-r1',
  extraOptions: { tasks: { type: 'string', default: 'T5a,T5b' }, only: { type: 'string', default: '' } },
  extraHelp: '  --tasks <list>               Task folders to run (default T5a,T5b; add T6 for the portal UI).\n',
});
const TASKS = r.opt.tasks.split(',').map((t) => t.trim());
const ZIPS = [
  { name: 'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-scorm-v2.zip', sha256: 'a685744e5fd9de21c203c3b2f47916ef1079532196ed870df89a00ab8ee76df7' },
  { name: 'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-html.zip', sha256: '9f04d3abd65f85e362b2dca5207cc4b86ffa286e4b1a73923c157b69321f3f6d' },
];
const EXPECT = {
  T5a: ['SETUP-T5a', 'AC-T5-01', 'AC-T5-02', 'AC-T5-03', 'AC-T5-04', 'AC-T5-05', 'AC-T5-06', 'AC-T5-21', 'AC-T5-22', 'AC-T5-07', 'AC-T5-34', 'AC-T5-20', 'AC-T5-12',
    'AC-T5-35', 'AC-T5-24', 'AC-T5-08', 'AC-T5-23', 'AC-T5-13', 'AC-T5-37', 'AC-T5-15', 'AC-T5-16', 'AC-T5-17'],
  T5b: ['SETUP-T5b', 'AC-T5-09', 'AC-T5-36', 'AC-T5-10', 'AC-T5-11', 'AC-T5-27', 'AC-T5-28', 'AC-T5-29', 'AC-T5-14', 'AC-T5-30', 'AC-T5-31', 'AC-T5-32', 'AC-T5-33', 'AC-T5-18', 'AC-T5-19'],
  T6: ['SETUP-T6', 'AC-T6-01', 'AC-T6-02', 'AC-T6-03', 'AC-T6-04', 'AC-T6-05', 'AC-T6-06', 'AC-T6-07', 'AC-T6-08', 'AC-T6-09', 'AC-T6-10', 'AC-T6-11', 'AC-T6-12', 'AC-T6-13', 'AC-T6-14'],
};

async function setup() {
  const ci = await r.npm('root-npm-ci', ['ci', '--no-audit', '--no-fund'], { timeoutMs: 900_000 });
  const gen = await r.npm('gen-env', ['run', 'gen-env']);
  r.loadStackFiles();
  await r.composeNameGuard();
  if (r.state.abort) return false;
  const build = TASKS.includes('T6') ? await r.npm('build', ['run', 'build'], { timeoutMs: 900_000 }) : { code: 0 };
  if (build.code !== 0) r.record('BUILD', 'npm run build (T6)', 'FAIL', [`exit ${build.code}`], [build.log]);
  const up = await r.npm('stack-up', ['run', 'stack:up'], { timeoutMs: 900_000 });
  const seed = up.code === 0 ? await r.npm('seed', ['run', 'seed'], { timeoutMs: 900_000 }) : null;
  r.loadStackFiles();
  r.record('SETUP', 'npm ci, gen-env, stack:up, seed', r.pass(ci.code === 0 && gen.code === 0 && up.code === 0 && seed?.code === 0), [
    `npm ci ${ci.code}, gen-env ${gen.code}, stack:up ${up.code}, seed ${seed?.code ?? 'not run'}`,
  ], [ci.log, gen.log, up.log, seed?.log].filter(Boolean));
  await r.checkProject();
  return !r.state.abort && seed?.code === 0;
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

// ---------------------------------------------------------------- host actions for the T5b tests

const ACTIONS = {
  'moodle-stop': () => r.exec('compose-stop-moodle', 'docker', ['compose', '-f', 'infra/compose.yaml', '--env-file', '.env', 'stop', 'moodle'], { timeoutMs: 180_000 }),
  'moodle-start': () => r.exec('compose-start-moodle', 'docker', ['compose', '-f', 'infra/compose.yaml', '--env-file', '.env', 'start', 'moodle'], { timeoutMs: 300_000 }),
  'lti-restart': () => r.npm('restart-lti-service', ['run', 'stack:restart', '--', 'lti-service'], { timeoutMs: 300_000 }),
};

/** Watches the control folder of the clone and answers each request once, in order. Returns a stop function. */
function startHostControl() {
  const dir = path.join(r.CLONE, 'tests', 'acceptance', 'artifacts', 'control');
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
    const res = fn ? await fn() : { code: 2 };
    const answer = { action: req.action, ok: Boolean(fn) && res.code === 0, code: res.code, startedAt, endedAt: Date.now() };
    fs.writeFileSync(path.join(dir, `ack-${req.id}.json`), JSON.stringify(answer));
    log.push(`${new Date(startedAt).toISOString()} ${req.action}: exit ${res.code} in ${answer.endedAt - startedAt} ms`);
    busy = false;
  }, 500);
  return () => {
    clearInterval(timer);
    return log;
  };
}

// ---------------------------------------------------------------- passes

async function knobPass() {
  const knob = (b) => (b.knobs ?? []).some((k) => (k.name ?? k) === 'PLAY_TTL_SECONDS' && String(k.value ?? '') === '20');
  const on = await r.npm('restart-app-knob', ['run', 'stack:restart', '--', 'cogniate-app', '--env', 'PLAY_TTL_SECONDS=20'], { timeoutMs: 300_000 });
  const active = await r.waitHealth(r.state.urls.app, knob);
  r.record('KNOB', 'stack:restart -- cogniate-app --env PLAY_TTL_SECONDS=20 activates the knob', r.pass(on.code === 0 && active.ok), [
    `exit ${on.code}; /healthz ${JSON.stringify(active.last)}`,
  ], [on.log]);
  try {
    if (active.ok) await r.containerSuite('knob-PLAY_TTL_SECONDS', { env: { QA_TASK: 'T5a', QA_GREP: 'AC-T5-15.*knob' }, expectIds: ['AC-T5-15'], fresh: false });
  } finally {
    const off = await r.npm('restart-app-default', ['run', 'stack:restart', '--', 'cogniate-app'], { timeoutMs: 300_000 });
    const cleared = await r.waitHealth(r.state.urls.app, (b) => Array.isArray(b.knobs) && b.knobs.length === 0);
    r.record('KNOB', 'stack:restart -- cogniate-app restores knobs: []', r.pass(off.code === 0 && cleared.ok), [`exit ${off.code}`], [off.log]);
  }
}

async function passT5b() {
  const stop = startHostControl();
  try {
    await r.containerSuite('T5b', { env: { QA_TASK: 'T5b' }, expectIds: EXPECT.T5b, fresh: false });
  } finally {
    const log = stop();
    r.record('HOSTCTL', 'Host actions asked for by the T5b tests (whitelist: compose stop/start moodle, stack:restart lti-service)', 'PASS', log.length ? log : ['none']);
  }
}

await r.main(async () => {
  if (!(await setup())) return;
  if (!copyFixtures()) return;
  if (r.opt.only) {
    // Re-run only what is missing: SETUP-T5a makes the state these ACs need.
    const ids = r.opt.only.split(',').map((t) => t.trim()).filter(Boolean);
    await r.containerSuite('focus', { env: { QA_TASK: 'T5a', QA_GREP: ['SETUP-T5a', ...ids].join('|') }, expectIds: ids });
    return;
  }
  if (TASKS.includes('T5a')) {
    await r.containerSuite('T5a', { env: { QA_TASK: 'T5a' }, expectIds: EXPECT.T5a });
    await knobPass();
  }
  if (TASKS.includes('T5b')) await passT5b();
  if (TASKS.includes('T6')) await r.containerSuite('T6', { env: { QA_TASK: 'T6' }, expectIds: EXPECT.T6, fresh: false });
});
