#!/usr/bin/env node
// QA host runner for T2a, T2b and T3a (black-box, from tasks/T2a.md, T2b.md, T3a.md). Node built-ins only.
// T3a runs in the same pass A: its setup is the T2b setup (acceptance profile, seed:lti-manual).
//
//   COMPOSE_PROJECT_NAME=qa-t2-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
//     node tests/host/run-t2.mjs --sha <commit> [--tasks T2a,T2b] [--replace-tests --only-task-folders T2a,T2b]
//
// Steps:
// 1. setup: npm ci, gen-env, compose name guard, stack:up + seed, H1 check.
// 2. AC-T2-31 (host part 1): seed:lti-manual twice → the same ltiSeed values.
// 3. In-container pass A: QA_TASK=<tasks> npm run test:acceptance (H14). Every T2a/T2b AC except AC-T2-07 must run.
//    Then the host checks that /healthz shows "profile": "default" again (AC-T2-30, last part; T2b only).
// 4. Knob pass (AC-T2-07): stack:restart -- lti-service --env LTIK_TTL_SECONDS=20; QA_GREP=AC-T2-07 run; restore.
//    The knob guard in the tests skips AC-T2-07 if the knob is not active; then this pass FAILs as "not run".
// 5. AC-T2-31 (host part 2): stack:reset, stack:up, seed, seed:lti-manual; pass C runs AC-T2-03 and AC-T2-31 again.
import { createRunner } from './core.mjs';

const r = createRunner({
  task: 'T2',
  defaultProject: 'qa-t2-r1',
  extraOptions: { tasks: { type: 'string', default: 'T2a,T2b' } },
  extraHelp: '  --tasks <list>               Task folders to run (default T2a,T2b; T3a may be added).\n',
});
const TASKS = r.opt.tasks.split(',').map((t) => t.trim());
const EXPECT = {
  T2a: ['AC-T2-01', 'AC-T2-02', 'AC-T2-03', 'AC-T2-04', 'AC-T2-05', 'AC-T2-06', 'AC-T2-08', 'AC-T2-12', 'AC-T2-13', 'AC-T2-14', 'AC-T2-15', 'AC-T2-16', 'AC-T2-18', 'AC-T2-19', 'AC-T2-29', 'AC-T2-31'],
  T2b: ['AC-T2-09', 'AC-T2-10', 'AC-T2-11', 'AC-T2-20', 'AC-T2-21', 'AC-T2-22', 'AC-T2-23', 'AC-T2-24', 'AC-T2-25', 'AC-T2-26', 'AC-T2-27', 'AC-T2-28', 'AC-T2-30', 'AC-T2-32'],
  T3a: ['AC-T3-06', 'AC-T3-07', 'AC-T3-08', 'AC-T3-10', 'AC-T3-11', 'AC-T3-12', 'AC-T3-13', 'AC-T3-14', 'AC-T3-16', 'AC-T3-17', 'AC-T3-18', 'AC-T3-22', 'AC-T3-23', 'AC-T3-24'],
};

function ltiSeedOf() {
  return r.state.rawSeed?.ltiSeed ?? null;
}

async function seedLtiManual(label) {
  const res = await r.npm(`seed-lti-manual-${label}`, ['run', 'seed:lti-manual'], { timeoutMs: 600_000 });
  r.loadStackFiles();
  return { code: res.code, log: res.log, ltiSeed: ltiSeedOf() };
}

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
  if (!r.state.abort && (!r.state.urls?.lti || !r.state.ca)) r.state.abort = 'no PUBLIC_*_URL in .env or no root.crt';
  return !r.state.abort && up.code === 0 && seed?.code === 0;
}

async function ac31First() {
  const a = await seedLtiManual('1');
  const b = await seedLtiManual('2');
  const same = a.ltiSeed !== null && JSON.stringify(a.ltiSeed) === JSON.stringify(b.ltiSeed);
  r.record('AC-T2-31', 'seed:lti-manual twice gives the same ltiSeed values', r.pass(a.code === 0 && b.code === 0 && same), [
    `exit ${a.code} and ${b.code}; ltiSeed ${a.ltiSeed ? JSON.stringify(a.ltiSeed) : 'missing'}; second run ${same ? 'equal' : 'DIFFERENT'}`,
  ], [a.log, b.log]);
  return a.code === 0 && a.ltiSeed !== null;
}

async function passA() {
  const { tests } = await r.containerSuite('passA', { env: { QA_TASK: TASKS.join(',') }, expectIds: TASKS.flatMap((t) => EXPECT[t] ?? []) });
  // H14 (T2a scope): npm run test:acceptance forwards the caller's QA_* env, so only the selected task folders ran.
  // In scope: the AC ids of the selected tasks (AC-T2-*, AC-T3-*), SETUP-* tests, and T2b's control test H6.
  const prefixes = [...new Set(TASKS.map((t) => t.match(/^T(\d+)/)?.[1]).filter(Boolean))];
  const inScope = new RegExp(`^(AC-T(${prefixes.join('|')})-|SETUP-)`);
  const others = tests.filter((t) => !inScope.test(t.id) && !(TASKS.includes('T2b') && t.id === 'H6'));
  r.record('H14', `npm run test:acceptance forwards QA_TASK=${TASKS.join(',')} into the e2e container (only those tests ran)`, r.pass(tests.length > 0 && others.length === 0), [
    `tests reported: ${tests.length}; outside ${TASKS.join(',')}: ${others.length}${others.length ? ` (${others.slice(0, 5).map((t) => t.id).join(', ')}…)` : ''}`,
  ]);
  if (TASKS.includes('T2b')) {
    const lti = await r.healthz(r.state.urls.lti);
    const app = await r.healthz(r.state.urls.app);
    const ok = lti?.profile === 'default' && app?.profile === 'default';
    r.record('AC-T2-30', '/healthz shows "profile": "default" after npm run test:acceptance ends', r.pass(ok), [
      `lti-service profile ${lti?.profile ?? 'n/a'}, cogniate-app profile ${app?.profile ?? 'n/a'}`,
    ]);
  }
}

async function knobPass() {
  if (!TASKS.includes('T2a')) return;
  const knob = (b) => (b.knobs ?? []).some((k) => (k.name ?? k) === 'LTIK_TTL_SECONDS' && String(k.value ?? '') === '20');
  const on = await r.npm('restart-lti-knob', ['run', 'stack:restart', '--', 'lti-service', '--env', 'LTIK_TTL_SECONDS=20'], { timeoutMs: 300_000 });
  const active = await r.waitHealth(r.state.urls.lti, knob);
  r.record('KNOB', 'stack:restart -- lti-service --env LTIK_TTL_SECONDS=20 activates the knob', r.pass(on.code === 0 && active.ok), [
    `exit ${on.code}; /healthz ${JSON.stringify(active.last)}`,
  ], [on.log]);
  try {
    const { tests } = await r.containerSuite('knob', { env: { QA_TASK: 'T2a', QA_GREP: 'AC-T2-07' }, expectIds: ['AC-T2-07'] });
    const ran = tests.filter((t) => t.status !== 'SKIP').map((t) => t.id);
    r.record('H14', 'QA_GREP=AC-T2-07 is forwarded (the knob pass ran only AC-T2-07)', r.pass(ran.length > 0 && ran.every((id) => id === 'AC-T2-07')), [`ran: ${ran.join(', ') || 'none'}`]);
  } finally {
    const off = await r.npm('restart-lti-default', ['run', 'stack:restart', '--', 'lti-service'], { timeoutMs: 300_000 });
    const cleared = await r.waitHealth(r.state.urls.lti, (b) => Array.isArray(b.knobs) && b.knobs.length === 0);
    r.record('KNOB', 'stack:restart -- lti-service restores knobs: []', r.pass(off.code === 0 && cleared.ok), [`exit ${off.code}`], [off.log]);
  }
}

async function ac31AfterReset() {
  if (!TASKS.includes('T2a')) return;
  const before = ltiSeedOf();
  const reset = await r.npm('stack-reset', ['run', 'stack:reset'], { timeoutMs: 600_000 });
  const up = reset.code === 0 ? await r.npm('stack-up-after-reset', ['run', 'stack:up'], { timeoutMs: 900_000 }) : null;
  const seed = up?.code === 0 ? await r.npm('seed-after-reset', ['run', 'seed'], { timeoutMs: 900_000 }) : null;
  const lti = seed?.code === 0 ? await seedLtiManual('after-reset') : null;
  r.record('AC-T2-31', 'After stack:reset, stack:up, seed, seed:lti-manual: seed.json has ltiSeed again', r.pass(lti?.code === 0 && lti.ltiSeed !== null), [
    `reset ${reset.code}, up ${up?.code ?? '-'}, seed ${seed?.code ?? '-'}, seed:lti-manual ${lti?.code ?? '-'}`,
    `ltiSeed before ${JSON.stringify(before)}; after ${JSON.stringify(lti?.ltiSeed ?? null)} (the in-container test proves the values match the new stack)`,
  ], [reset.log, up?.log, seed?.log, lti?.log].filter(Boolean));
  if (lti?.code === 0) await r.containerSuite('passC', { env: { QA_TASK: 'T2a', QA_GREP: 'AC-T2-03|AC-T2-31' }, expectIds: ['AC-T2-03', 'AC-T2-31'] });
}

await r.main(async () => {
  if (!(await setup())) return;
  if (TASKS.includes('T2a') || TASKS.includes('T2b') || TASKS.includes('T3a')) {
    if (!(await ac31First())) return;
  }
  await passA();
  await knobPass();
  await ac31AfterReset();
});
