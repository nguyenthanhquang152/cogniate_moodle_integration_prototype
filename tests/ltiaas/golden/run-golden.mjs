#!/usr/bin/env node
// Golden capture runner (LA-E0-03; TEST-STRATEGY §4.6). One fresh clone and stack per capture (QA SIM lane):
//   COMPOSE_PROJECT_NAME=qa-la-sim-r<N> PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
//   node tests/ltiaas/golden/run-golden.mjs --sha <product sha> --label <name> --out <folder> \
//        [--workdir <clone folder>] [--replace-tests --tests-from <tests folder>]
// Steps: preflight, clone (core.mjs) → npm ci, gen-env, stack:up (default profile), seed → G1 `default` answers →
// stack:up (acceptance) → the capture script in the e2e container (M1 host control for the operator CLI) → copy the
// normalized G1–G4 to --out after a secret scan → label-scoped teardown (core.mjs).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRunner } from '../../host/core.mjs';
import { httpsLoopback, run, secretsInFile, walkFiles } from '../../host/lib.mjs';
import { m1HostControl } from '../../host/m1-control.mjs';
import { appLmsProviders, seedPortalUser } from '../lib/open-world.mjs';
import { secretScan } from './lib/normalize.mjs';

const r = createRunner({ task: 'GOLDEN', defaultProject: 'qa-la-sim-r1', extraOptions: {
  label: { type: 'string', default: 'capture' }, out: { type: 'string' },
} });
const label = r.opt.label;
assert.match(label, /^[a-z0-9-]+$/, '--label: lower case letters, digits and -');
assert.ok(r.opt.out && path.isAbsolute(r.opt.out), '--out <absolute folder> is required');
const compose = ['compose', '-p', r.PROJECT, '-f', 'infra/compose.yaml', '--env-file', '.env'];

async function readDefault() {
  const key = fs.readFileSync(path.join(r.CLONE, 'infra/.secrets/lti-api-key.cogniate'), 'utf8').trim(); r.redact.add(key);
  const get = async (url, headers = {}) => {
    const res = await httpsLoopback(url, { ca: r.state.ca, headers }); assert.equal(res.status, 200, url); return JSON.parse(res.body);
  };
  return {
    providers: await get(r.state.urls.lti + '/api/providers', { authorization: 'Bearer ' + key }),
    lmsProviders: await appLmsProviders(httpsLoopback, { appUrl: r.state.urls.app, ca: r.state.ca, user: seedPortalUser(r.state.rawSeed) }),
    ltiHealth: await get(r.state.urls.lti + '/healthz'),
    appHealth: await get(r.state.urls.app + '/healthz'),
  };
}

await r.main(async () => {
  const t0 = Date.now();
  assert.equal((await r.npm('root-ci', ['ci', '--no-audit', '--no-fund'], { timeoutMs: 900_000 })).code, 0);
  assert.equal((await r.npm('gen-env', ['run', 'gen-env'])).code, 0);
  r.loadStackFiles(); await r.composeNameGuard(); assert.equal(r.state.abort, null, 'compose name guard');
  assert.equal((await r.npm('stack-up-default', ['run', 'stack:up'], { env: { ...r.STACK_ENV, STACK_PROFILE: 'default' }, timeoutMs: 900_000 })).code, 0);
  assert.equal((await r.npm('seed', ['run', 'seed'], { timeoutMs: 900_000 })).code, 0);
  r.loadStackFiles(); await r.checkProject(); assert.ok(r.state.h1Verified, 'QA project guard');
  // G1, `default` profile part (the capture script adds it to G1 before it normalizes).
  const defaults = await readDefault();
  assert.equal(defaults.ltiHealth.profile, 'default'); assert.equal(defaults.appHealth.profile, 'default');
  const tmp = path.join(r.CLONE, 'tests/.tmp'); fs.mkdirSync(tmp, { recursive: true });
  fs.writeFileSync(path.join(tmp, 'golden-default.json'), JSON.stringify(defaults), { mode: 0o600 });
  r.record('GOLDEN-DEFAULT', 'G1 default profile answers read (providers, lms-providers, both /healthz)', 'PASS',
    [`profiles ${defaults.providers.profiles.length}; lms ${defaults.lmsProviders.lms.map((e) => e.lms).join(',')}`]);
  assert.equal((await r.npm('stack-up-acceptance', ['run', 'stack:up'], { env: { ...r.STACK_ENV, STACK_PROFILE: 'acceptance' }, timeoutMs: 900_000 })).code, 0);
  r.loadStackFiles(); await r.checkProject(); assert.ok(r.state.h1Verified, 'QA project guard after the profile change');
  const lti = await r.healthz(r.state.urls.lti), appHealth = await r.healthz(r.state.urls.app);
  assert.equal(lti?.profile, 'acceptance'); assert.equal(appHealth?.profile, 'acceptance');
  fs.writeFileSync(path.join(tmp, 'golden-acceptance-lti-health.json'), JSON.stringify(lti), { mode: 0o600 });
  // On pre-LA-E7-03 baselines (e.g. baseline-3 78971b03 / 1b17261b), infra/scripts/lib.sh and infra/compose.yaml do not
  // yet read tests/sim/hosts.json, so moodle.sim.test is added to SIM_LTI_HOSTS and lms-sim aliases after the unmodified
  // acceptance /healthz is recorded.
  const libShPath = path.join(r.CLONE, 'infra/scripts/lib.sh');
  const composePath = path.join(r.CLONE, 'infra/compose.yaml');
  const libShText = fs.readFileSync(libShPath, 'utf8');
  if (!libShText.includes('hosts.json') && !libShText.includes('moodle.sim.test')) {
    fs.writeFileSync(
      libShPath,
      libShText.replace('api.canvas-self.sim.test)', 'api.canvas-self.sim.test moodle.sim.test)'),
    );
    const composeText = fs.readFileSync(composePath, 'utf8');
    if (!composeText.includes('moodle.sim.test')) {
      fs.writeFileSync(
        composePath,
        composeText.replace('- school-b.canvas.sim.test', '- school-b.canvas.sim.test\n          - moodle.sim.test'),
      );
    }
    assert.equal((await r.npm('stack-up-acceptance-moodle-sim', ['run', 'stack:up'], { env: { ...r.STACK_ENV, STACK_PROFILE: 'acceptance' }, timeoutMs: 900_000 })).code, 0);
    r.loadStackFiles(); await r.checkProject(); assert.ok(r.state.h1Verified, 'QA project guard after moodle.sim.test overlay');
  }
  const services = (await run('docker', [...compose, 'ps', '--services', '--status', 'running'], { cwd: r.CLONE, env: r.STACK_ENV })).stdout;
  for (const name of ['lms-sim', 'lti-gate']) assert.ok(services.split('\n').includes(name), `${name} runs`);
  const inside = 'set -euo pipefail; source infra/scripts/lib.sh; require_running proxy; prepare_e2e; qa_env_args; '
    + 'dc --profile test run --rm --no-deps --name "$COMPOSE_PROJECT_NAME-qa-golden-$$" --build "${QA_ENV_ARGS[@]+"${QA_ENV_ARGS[@]}"}" e2e sh -c '
    + "'npm ci --prefix tests --no-audit --no-fund && cd tests && node node_modules/vitest/vitest.mjs run --config ltiaas/golden/vitest.config.mts'";
  const stop = m1HostControl(r);
  const captureStart = Date.now();
  let pass;
  try {
    pass = await r.exec('golden-capture', 'bash', ['-c', inside], { env: { ...r.STACK_ENV, QA_GOLDEN_LABEL: label,
      QA_GOLDEN_DEFAULT: '/repo/tests/.tmp/golden-default.json',
      QA_GOLDEN_ACCEPTANCE_LTI_HEALTH: '/repo/tests/.tmp/golden-acceptance-lti-health.json' }, timeoutMs: 3_600_000 });
  } finally { await stop(); }
  const captureMs = Date.now() - captureStart;
  const from = path.join(r.CLONE, 'tests/acceptance/artifacts/golden', label);
  r.record('GOLDEN-CAPTURE', 'Capture script in the e2e container', pass.code === 0 ? 'PASS' : 'FAIL',
    [`exit ${pass.code}; ${Math.round(captureMs / 1000)} s; log ${pass.log}`]);
  assert.equal(pass.code, 0, 'golden capture');
  // Secret scan of the normalized files: every value of infra/.secrets, the simulator and the captured values.
  const secrets = [];
  for (const file of walkFiles(path.join(r.CLONE, 'infra/.secrets'))) for (const item of secretsInFile(file).items) secrets.push(item.value);
  for (const name of ['m1-secrets.raw.jsonl', 'captured-secrets.jsonl']) {
    const file = path.join(r.CLONE, 'tests/acceptance/artifacts', name);
    if (fs.existsSync(file)) for (const line of fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
      const v = JSON.parse(line); secrets.push(typeof v === 'string' ? v : v.value);
    }
  }
  const files = ['G1', 'G2', 'G3', 'G4'].map((g) => [g, fs.readFileSync(path.join(from, `${g}.json`), 'utf8')]);
  const hits = secretScan(files, secrets);
  r.record('GOLDEN-SECRET-SCAN', 'Zero secret hits in the normalized G1-G4 (K-HYG method)', hits.length === 0 ? 'PASS' : 'FAIL',
    [`values ${new Set(secrets.filter((s) => typeof s === 'string' && s.length >= 8)).size}; hits ${hits.length}${hits.length ? ': ' + JSON.stringify(hits) : ''}`]);
  assert.deepEqual(hits, []);
  fs.mkdirSync(r.opt.out, { recursive: true });
  for (const [g, text] of files) fs.writeFileSync(path.join(r.opt.out, `${g}.json`), text);
  const stats = JSON.parse(fs.readFileSync(path.join(from, 'capture-stats.json'), 'utf8'));
  const head = (await run('git', ['rev-parse', 'HEAD'], { cwd: r.CLONE })).stdout.trim();
  fs.writeFileSync(path.join(r.opt.out, 'meta.json'), JSON.stringify({ goldenVersion: 2, productSha: head, label, project: r.PROJECT,
    capturedAt: new Date().toISOString(), captureSeconds: Math.round(captureMs / 1000), totalSeconds: Math.round((Date.now() - t0) / 1000),
    normalization: stats.stats, secretValuesChecked: new Set(secrets.filter((s) => typeof s === 'string' && s.length >= 8)).size, secretHits: 0 }, null, 2) + '\n');
  r.record('GOLDEN-OUT', `Normalized G1-G4 written to ${r.opt.out}`, 'PASS', [`capture ${Math.round(captureMs / 1000)} s`]);
});
