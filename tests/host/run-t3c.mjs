#!/usr/bin/env node
// QA host runner for T3c (black-box, from tasks/T3c.md). Node built-ins only.
// T3c uses the T3a state (activity "QA DL", ltiSeed), so one in-container pass runs QA_TASK=T3a,T3c (acceptance
// profile through npm run test:acceptance; file order puts T3a first and T3c/9-delete-platform last, as AC-T3-19 asks).
//
//   COMPOSE_PROJECT_NAME=qa-t3c-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
//     node tests/host/run-t3c.mjs --sha <commit> [--replace-tests]
//
// Steps:
// 1. setup: npm ci, gen-env, compose name guard, stack:up + seed, seed:lti-manual, H1 check.
// 2. In-container pass: QA_TASK=T3a,T3c. During the pass the runner answers the host actions of the tests
//    (tests/acceptance/lib/host-control.ts), only these two, only for this QA project:
//    - compat-run (AC-T3-27): `npm run test:compat` with COMPAT_INPUT_FILE = the QA input file in the control folder
//      (infra/README.md "Compat runner"), and the same values as QA_COMPAT_* env (the runner passes QA_* by name).
//      The captured ltiks are added to the redaction list first; the output (redacted) goes back to the test.
//    - seed-lti-manual (AC-T3-19): `npm run seed:lti-manual`.
import fs from 'node:fs';
import path from 'node:path';
import { createRunner } from './core.mjs';

const r = createRunner({ task: 'T3c', defaultProject: 'qa-t3c-r1' });
const EXPECT = {
  T3a: ['AC-T3-06', 'AC-T3-07', 'AC-T3-08', 'AC-T3-10', 'AC-T3-11', 'AC-T3-12', 'AC-T3-13', 'AC-T3-14', 'AC-T3-16', 'AC-T3-17', 'AC-T3-18', 'AC-T3-22', 'AC-T3-23', 'AC-T3-24'],
  T3c: ['AC-T3-09', 'AC-T3-15', 'AC-T3-20', 'AC-T3-21', 'AC-T3-31', 'AC-T3-27', 'AC-T3-19'],
};
const CONTROL = () => path.join(r.CLONE, 'tests', 'acceptance', 'artifacts', 'control');

async function setup() {
  const ci = await r.npm('root-npm-ci', ['ci', '--no-audit', '--no-fund'], { timeoutMs: 900_000 });
  const gen = await r.npm('gen-env', ['run', 'gen-env']);
  r.loadStackFiles();
  await r.composeNameGuard();
  if (r.state.abort) return false;
  const up = await r.npm('stack-up', ['run', 'stack:up'], { timeoutMs: 900_000 });
  const seed = up.code === 0 ? await r.npm('seed', ['run', 'seed'], { timeoutMs: 900_000 }) : null;
  const lti = seed?.code === 0 ? await r.npm('seed-lti-manual', ['run', 'seed:lti-manual'], { timeoutMs: 600_000 }) : null;
  r.loadStackFiles();
  const ok = ci.code === 0 && gen.code === 0 && up.code === 0 && seed?.code === 0 && lti?.code === 0;
  r.record('SETUP', 'npm ci, gen-env, stack:up, seed, seed:lti-manual', r.pass(ok), [
    `npm ci ${ci.code}, gen-env ${gen.code}, stack:up ${up.code}, seed ${seed?.code ?? 'not run'}, seed:lti-manual ${lti?.code ?? 'not run'}`,
  ], [ci.log, gen.log, up.log, seed?.log, lti?.log].filter(Boolean));
  await r.checkProject();
  if (!r.state.abort && (!r.state.urls?.lti || !r.state.ca)) r.state.abort = 'no PUBLIC_*_URL in .env or no root.crt';
  return !r.state.abort && ok;
}

const ACTIONS = {
  'seed-lti-manual': async () => {
    const res = await r.npm('seed-lti-manual-again', ['run', 'seed:lti-manual'], { timeoutMs: 600_000 });
    r.loadStackFiles();
    return { code: res.code };
  },
  'compat-run': async (req) => {
    const name = String(req.input ?? '');
    if (!/^compat-input-[\w-]+\.json$/.test(name)) return { code: 2 };
    const file = path.join(CONTROL(), name);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return { code: 2 };
    }
    for (const v of [data.studentLtik, data.deepLinkLtik]) if (typeof v === 'string' && v) r.redact.add(v);
    const env = {
      ...r.STACK_ENV,
      COMPAT_INPUT_FILE: file,
      QA_COMPAT_STUDENT_LTIK: String(data.studentLtik ?? ''),
      QA_COMPAT_DEEPLINK_LTIK: String(data.deepLinkLtik ?? ''),
      QA_COMPAT_RUN_ID: String(data.runId ?? ''),
      QA_COMPAT_EXPECT: JSON.stringify(data.expect ?? {}),
    };
    const res = await r.npm('test-compat', ['run', 'test:compat'], { env, timeoutMs: 780_000 });
    const out = name.replace(/^compat-input-/, 'compat-out-').replace(/\.json$/, '.txt');
    fs.writeFileSync(path.join(CONTROL(), out), r.redact.apply(`${res.stdout}\n--- stderr\n${res.stderr}`));
    return { code: res.code, out };
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

await r.main(async () => {
  if (!(await setup())) return;
  const stop = startHostControl();
  try {
    await r.containerSuite('T3c', { env: { QA_TASK: 'T3a,T3c' }, expectIds: [...EXPECT.T3a, ...EXPECT.T3c] });
  } finally {
    const log = stop();
    r.record('HOSTCTL', 'Host actions asked for by the T3c tests (whitelist: npm run test:compat with the QA input file, npm run seed:lti-manual)', 'PASS', log.length ? log : ['none']);
  }
});
