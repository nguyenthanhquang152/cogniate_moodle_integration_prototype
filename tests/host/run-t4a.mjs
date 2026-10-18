#!/usr/bin/env node
// QA host runner for T4a (black-box, from tasks/T4a.md). Node built-ins only.
//
//   COMPOSE_PROJECT_NAME=qa-t4a-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
//   COURSE_FIXTURES_DIR=<repo>/docs/raw/data/courses node tests/host/run-t4a.mjs --sha <commit>
//
// Steps:
// 1. setup: npm ci, gen-env, compose name guard, stack:up + seed, H1 check.
// 2. Copy the two course zips (not in git) into the clone's tests/fixtures/courses/ (git-ignored), SHA-256 checked,
//    so that the e2e container can read them.
// 3. Pass A: QA_TASK=T4a, every AC except AC-T4-05 and AC-T4-35.
// 4. AC-T4-05: count the package store folders (docker exec, read-only), run only AC-T4-05, count again, and run
//    `find / -name evil.html -o -name abs.html` in the cogniate-app container. Both are named by the AC.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRunner } from './core.mjs';
import { serviceContainer } from './lib.mjs';

const r = createRunner({ task: 'T4a', defaultProject: 'qa-t4a-r1' });
const ZIPS = [
  { name: 'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-scorm-v2.zip', sha256: 'a685744e5fd9de21c203c3b2f47916ef1079532196ed870df89a00ab8ee76df7' },
  { name: 'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-html.zip', sha256: '9f04d3abd65f85e362b2dca5207cc4b86ffa286e4b1a73923c157b69321f3f6d' },
];

async function setup() {
  const ci = await r.npm('root-npm-ci', ['ci', '--no-audit', '--no-fund'], { timeoutMs: 900_000 });
  const gen = await r.npm('gen-env', ['run', 'gen-env']);
  r.loadStackFiles();
  await r.composeNameGuard();
  if (r.state.abort) return false;
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

// The package store is /data/packages in the cogniate-app container (AC-T4-05 text since 2254792). `test -d` first:
// in a pipe, a failed `ls` would still exit 0 and count 0 before and after (a false "same count").
const STORE = '/data/packages';
async function packageFolders(app) {
  const res = await r.exec('package-store-count', 'docker', ['exec', app, 'sh', '-c', `test -d ${STORE} && find ${STORE} -mindepth 1 -maxdepth 1 -type d | wc -l`]);
  return { code: res.code, count: Number(res.stdout.trim()), log: res.log };
}

async function ac05() {
  const app = await serviceContainer(r.PROJECT, 'cogniate-app');
  if (!app) {
    r.record('AC-T4-05', 'Package store unchanged and no evil.html / abs.html after the rejects', 'FAIL', ['no cogniate-app container']);
    return;
  }
  const before = await packageFolders(app);
  // AC-T4-35 (4da1f95) runs in the same pass: it reads the details.action of the AC-T4-05 answers, and the store count
  // around this pass covers its rejects too ("nothing stored").
  await r.containerSuite('rejects', { env: { QA_TASK: 'T4a', QA_GREP: 'AC-T4-05|AC-T4-35' }, expectIds: ['AC-T4-05', 'AC-T4-35'] });
  // `npm run test:acceptance` switches the acceptance profile on and off (T2b), which recreates the cogniate-app
  // container: look it up again (a container id from before the pass is gone).
  const appAfter = (await serviceContainer(r.PROJECT, 'cogniate-app')) ?? app;
  const after = await packageFolders(appAfter);
  const find = await r.exec('find-evil-files', 'docker', [
    'exec', appAfter, 'sh', '-c',
    'find / -path /proc -prune -o -path /sys -prune -o \\( -name evil.html -o -name abs.html \\) -print 2>/dev/null',
  ], { timeoutMs: 300_000 });
  const found = find.stdout.split('\n').filter(Boolean);
  const ok = before.code === 0 && after.code === 0 && before.count === after.count && found.length === 0;
  r.record('AC-T4-05', 'After the crafted zips: the package store folder count is the same, and no evil.html or abs.html exists in the container', r.pass(ok), [
    `folders in ${STORE}: before ${before.count} (exit ${before.code}), after ${after.count} (exit ${after.code})`,
    `find: ${found.length ? found.join(', ') : 'nothing'}`,
  ], [before.log, after.log, find.log]);
  r.record('AC-T4-35', 'After the identifier rejects (same pass): the package store folder count is the same', r.pass(before.code === 0 && after.code === 0 && before.count === after.count), [
    `folders in ${STORE}: before ${before.count}, after ${after.count}`,
  ]);
}

await r.main(async () => {
  if (!(await setup())) return;
  if (!copyFixtures()) return;
  await r.containerSuite('passA', {
    env: { QA_TASK: 'T4a', QA_GREP: '^(?!.*(AC-T4-05|AC-T4-35))' },
    expectIds: ['AC-T4-01', 'AC-T4-02', 'AC-T4-03', 'AC-T4-04', 'AC-T4-06'],
  });
  await ac05();
});
