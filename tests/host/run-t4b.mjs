#!/usr/bin/env node
// QA host runner for T4b1 and T4b2 (black-box, from tasks/T4b1.md and tasks/T4b2.md). Node built-ins only.
//
//   COMPOSE_PROJECT_NAME=qa-t4b-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
//   COURSE_FIXTURES_DIR=<repo>/docs/raw/data/courses node tests/host/run-t4b.mjs --sha <commit>
//
// The T4b specs share the state file "T4b" (tests/acceptance/artifacts/state-T4b.json in the clone), so the passes
// after the first keep the artifacts folder.
// 1. setup: npm ci, gen-env, guard, stack:up + seed, H1; course zips into tests/fixtures/courses.
// 2. Pass 1: QA_TASK=T4b1,T4b2, all ACs except AC-T4-18, -21, -32 (they need step 4).
// 3. Knob passes: REF_TTL_SECONDS=20 (cogniate-app) → AC-T4-09 knob test; PICKER_TTL_SECONDS=20 → AC-T4-20 knob test.
// 4. npm run seed:lti-activity (T4b2 scope): an activity under Thanh's tool that points at library B's publication.
// 5. Pass 2: AC-T4-18, then AC-T4-21 and AC-T4-32 over the pages of all passes.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRunner } from './core.mjs';

const r = createRunner({ task: 'T4b', defaultProject: 'qa-t4b-r1' });
const ZIPS = [
  { name: 'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-scorm-v2.zip', sha256: 'a685744e5fd9de21c203c3b2f47916ef1079532196ed870df89a00ab8ee76df7' },
  { name: 'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-html.zip', sha256: '9f04d3abd65f85e362b2dca5207cc4b86ffa286e4b1a73923c157b69321f3f6d' },
];
const T4B1 = ['AC-T4-07', 'AC-T4-08', 'AC-T4-09', 'AC-T4-10', 'AC-T4-30', 'AC-T4-36', 'AC-T4-12', 'AC-T4-14', 'AC-T4-33', 'AC-T4-34'];
const T4B2_PASS1 = ['AC-T4-15', 'AC-T4-16', 'AC-T4-26', 'AC-T4-17', 'AC-T4-24', 'AC-T4-23', 'AC-T4-25', 'AC-T4-27', 'AC-T4-19', 'AC-T4-20', 'AC-T4-31', 'AC-T4-22', 'AC-T4-28', 'AC-T4-29'];
const LATE = ['AC-T4-18', 'AC-T4-21', 'AC-T4-32'];

async function setup() {
  const ci = await r.npm('root-npm-ci', ['ci', '--no-audit', '--no-fund'], { timeoutMs: 900_000 });
  const gen = await r.npm('gen-env', ['run', 'gen-env']);
  r.loadStackFiles();
  await r.composeNameGuard();
  if (r.state.abort) return false;
  const up = await r.npm('stack-up', ['run', 'stack:up'], { timeoutMs: 900_000 });
  const seed = up.code === 0 ? await r.npm('seed', ['run', 'seed'], { timeoutMs: 900_000 }) : null;
  // AC-T4-36 (1) uses the dev seed tool "Cogniate (seed)" (seed.json ltiSeed).
  const lti = seed?.code === 0 ? await r.npm('seed-lti-manual', ['run', 'seed:lti-manual'], { timeoutMs: 600_000 }) : null;
  r.loadStackFiles();
  r.record('SETUP', 'npm ci, gen-env, stack:up, seed, seed:lti-manual', r.pass(ci.code === 0 && gen.code === 0 && up.code === 0 && seed?.code === 0 && lti?.code === 0), [
    `npm ci ${ci.code}, gen-env ${gen.code}, stack:up ${up.code}, seed ${seed?.code ?? 'not run'}, seed:lti-manual ${lti?.code ?? 'not run'}`,
  ], [ci.log, gen.log, up.log, seed?.log, lti?.log].filter(Boolean));
  await r.checkProject();
  if (r.state.abort || seed?.code !== 0) return false;
  const dest = path.join(r.CLONE, 'tests', 'fixtures', 'courses');
  fs.mkdirSync(dest, { recursive: true });
  const sources = [process.env.COURSE_FIXTURES_DIR, path.join(r.SOURCE, 'docs', 'raw', 'data', 'courses')].filter(Boolean);
  for (const z of ZIPS) {
    const src = sources.map((d) => path.join(d, z.name)).find((f) => fs.existsSync(f));
    if (!src || crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex') !== z.sha256) {
      r.record('FIXTURES', 'Course zips copied into the clone', 'FAIL', [`${z.name}: missing or wrong SHA-256`]);
      return false;
    }
    fs.copyFileSync(src, path.join(dest, z.name));
  }
  r.record('FIXTURES', 'Course zips copied into the clone (tests/fixtures/courses, git-ignored), SHA-256 checked', 'PASS');
  return true;
}

async function knobPass(service, knob, task, grep, id) {
  const has = (b) => (b.knobs ?? []).some((k) => (k.name ?? k) === knob);
  const on = await r.npm(`restart-${service}-${knob}`, ['run', 'stack:restart', '--', service, '--env', `${knob}=20`], { timeoutMs: 300_000 });
  const active = await r.waitHealth(r.state.urls.app, has);
  r.record('KNOB', `${service} with ${knob}=20`, r.pass(on.code === 0 && active.ok), [`exit ${on.code}; /healthz ${JSON.stringify(active.last)}`], [on.log]);
  try {
    await r.containerSuite(`knob-${knob}`, { env: { QA_TASK: task, QA_GREP: grep }, expectIds: [id], fresh: false });
  } finally {
    const off = await r.npm(`restart-${service}-default`, ['run', 'stack:restart', '--', service], { timeoutMs: 300_000 });
    const cleared = await r.waitHealth(r.state.urls.app, (b) => Array.isArray(b.knobs) && b.knobs.length === 0);
    r.record('KNOB', `${service} back to knobs: []`, r.pass(off.code === 0 && cleared.ok), [`exit ${off.code}`], [off.log]);
  }
}

async function seedForeignActivity() {
  const file = path.join(r.CLONE, 'tests', 'acceptance', 'artifacts', 'state-T4b.json');
  const st = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  if (!st.thanhTypeId || !st.bHtmlPublicationId || !st.runId) {
    r.record('SEED', 'npm run seed:lti-activity for AC-T4-18', 'FAIL', ['the T4b state has no thanhTypeId, bHtmlPublicationId or runId (pass 1 failed early)']);
    return false;
  }
  const url = `${r.state.urls.lti}/lti/launch/cogniate?resource=${st.bHtmlPublicationId}`;
  const res = await r.npm('seed-lti-activity', ['run', 'seed:lti-activity', '--', '--type', String(st.thanhTypeId), '--course', 'COGNIATE-DEV-101', '--name', 'QA foreign', '--url', url], { timeoutMs: 300_000 });
  r.record('SEED', 'npm run seed:lti-activity: activity "QA foreign" under Thanh\'s tool pointing at library B\'s publication', r.pass(res.code === 0), [`exit ${res.code}`], [res.log]);
  return res.code === 0;
}

await r.main(async () => {
  if (!(await setup())) return;
  const exclude = `^(?!.*(${LATE.join('|')}))`;
  await r.containerSuite('pass1', { env: { QA_TASK: 'T4b1,T4b2', QA_GREP: exclude }, expectIds: [...T4B1, ...T4B2_PASS1] });
  await knobPass('cogniate-app', 'REF_TTL_SECONDS', 'T4b1', 'AC-T4-09.*knob', 'AC-T4-09');
  await knobPass('cogniate-app', 'PICKER_TTL_SECONDS', 'T4b2', 'AC-T4-20.*knob', 'AC-T4-20');
  if (await seedForeignActivity()) {
    await r.containerSuite('pass2', { env: { QA_TASK: 'T4b2', QA_GREP: LATE.join('|') }, expectIds: LATE, fresh: false });
  }
});
