// HARNESS ONLY: actual file-control handler, with subprocess execution captured.
// This proves command construction and result handling, not container execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { m1HostControl } from './m1-control.mjs';

test('HARNESS ONLY: app and LTI CLI use the mounted repo root, preserving arguments and errors', async (t) => {
  const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-m1-cli-'));
  const dir = path.join(clone, 'tests/acceptance/artifacts/control');
  fs.mkdirSync(dir, { recursive: true });
  const calls = [], evidence = new Map(), secrets = [];
  const outputs = [
    { code: 0, stdout: 'grant fixture ' + 'g'.repeat(43), stderr: '', durationMs: 11 },
    { code: 1, stdout: 'operator diagnostic', stderr: 'shared platform conflict', durationMs: 12 },
    { code: 0, stdout: 'absent', stderr: '', durationMs: 13 },
  ];
  const r = {
    CLONE: clone, PROJECT: 'qa-cli-selfcheck', state: { h1Verified: true },
    STACK_ENV: { COMPOSE_PROJECT_NAME: 'qa-cli-selfcheck' },
    redact: { add: (value) => secrets.push(value) },
    saveText: (name, text) => evidence.set(name, JSON.parse(text)),
    record: (...args) => assert.fail(JSON.stringify(args)),
  };
  const stop = m1HostControl(r, async (...args) => {
    calls.push(args); return outputs[calls.length - 1];
  });
  t.after(async () => { await stop(); fs.rmSync(clone, { recursive: true, force: true }); });
  async function invoke(req) {
    fs.writeFileSync(path.join(dir, `req-${req.id}.json`), JSON.stringify(req));
    const ackPath = path.join(dir, `ack-${req.id}.json`), limit = Date.now() + 3000;
    while (!fs.existsSync(ackPath) && Date.now() < limit) await delay(10);
    assert.ok(fs.existsSync(ackPath), 'Host control completed the request');
    const ack = JSON.parse(fs.readFileSync(ackPath, 'utf8'));
    return { ack, result: JSON.parse(fs.readFileSync(path.join(dir, ack.out), 'utf8')) };
  }
  const inputs = [
    { id: 'm1-a1', script: 'app:grant', args: ['issue', '--connection', 'con_fixture', '--note', 'QA spaces $(literal)'] },
    { id: 'm1-a2', script: 'lti:shared-platform', args: ['--account', 'cogniate', '--profile', 'blackboard-sim', '--client-id', 'other'] },
    { id: 'm1-a3', script: 'app:binding', args: ['suspend', '--connection', 'con_fixture', '--note', 'fixture'] },
  ];
  // Confirm the selected root and default cwd against the actual Compose layout.
  const compose = fs.readFileSync(new URL('../../infra/compose.yaml', import.meta.url), 'utf8');
  for (const service of ['cogniate-app', 'lti-service']) {
    const block = compose.split(`\n  ${service}:\n`)[1]?.split(/\n  [\w-]+:\n/)[0];
    assert.ok(block);
    assert.ok(block.includes(`working_dir: /repo/services/${service}`));
    assert.ok(block.includes('../package.json:/repo/package.json:ro'));
  }
  for (const [index, input] of inputs.entries()) {
    const { ack, result } = await invoke({ ...input, action: 'm1-cli' });
    assert.deepEqual(result, outputs[index]);
    assert.equal(ack.ok, outputs[index].code === 0);
    const service = index === 1 ? 'lti-service' : 'cogniate-app';
    assert.deepEqual(calls[index], ['docker', [
      'compose', '-f', 'infra/compose.yaml', '--env-file', '.env',
      'exec', '-T', '--workdir', '/repo', service, 'npm', 'run', input.script,
      '-w', `services/${service}`, '--', ...input.args,
    ], { cwd: clone, env: r.STACK_ENV, timeoutMs: 30_000 }]);
    const saved = evidence.get(`host-actions/${input.id}.json`);
    for (const key of ['code', 'stdout', 'stderr', 'durationMs']) assert.equal(saved[key], outputs[index][key]);
  }
  assert.ok(secrets.includes('g'.repeat(43)), 'Once-only CLI code remains registered before evidence saving');
  const rejected = await invoke({ id: 'm1-a4', action: 'm1-cli', script: 'arbitrary', args: [] });
  assert.equal(rejected.result.code, 2);
  assert.equal(rejected.result.stderr, 'CLI whitelist');
  assert.equal(calls.length, 3, 'No subprocess for an unapproved command');
});

test('HARNESS ONLY: AC-M1-35 profile restarts use the documented --env overrides and restore without overrides', async (t) => {
  const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-m1-profile-'));
  const dir = path.join(clone, 'tests/acceptance/artifacts/control');
  fs.mkdirSync(dir, { recursive: true });
  const calls = [];
  const r = {
    CLONE: clone, PROJECT: 'qa-profile-selfcheck', state: { h1Verified: true },
    STACK_ENV: { COMPOSE_PROJECT_NAME: 'qa-profile-selfcheck', STACK_PROFILE: 'default' },
    redact: { add: () => {} }, saveText: () => {}, record: (...args) => assert.fail(JSON.stringify(args)),
  };
  const stop = m1HostControl(r, async (...args) => { calls.push(args); return { code: 0, stdout: 'ok', stderr: '', durationMs: 1 }; });
  t.after(async () => { await stop(); fs.rmSync(clone, { recursive: true, force: true }); });
  async function invoke(req) {
    fs.writeFileSync(path.join(dir, `req-${req.id}.json`), JSON.stringify(req));
    const ackPath = path.join(dir, `ack-${req.id}.json`), limit = Date.now() + 3000;
    while (!fs.existsSync(ackPath) && Date.now() < limit) await delay(10);
    assert.ok(fs.existsSync(ackPath), 'Host control completed the request');
    const ack = JSON.parse(fs.readFileSync(ackPath, 'utf8'));
    return JSON.parse(fs.readFileSync(path.join(dir, ack.out), 'utf8'));
  }
  // The facts that the command construction relies on, read from the actual infrastructure files.
  const restart = fs.readFileSync(new URL('../../infra/scripts/stack-restart.sh', import.meta.url), 'utf8');
  const gate = restart.match(/GATE_VARS = svc === 'lti-service' \? \[([^\]]*)\]/);
  assert.ok(gate, 'stack:restart declares the LTI service gate variables');
  assert.deepEqual(gate[1].split(',').map((s) => s.trim().replace(/'/g, '')).sort(), ['LTI_PROVIDER_SIMULATION', 'STACK_PROFILE']);
  assert.equal(/PROFILE_FILE|REQUESTED_PROFILE/.test(restart), false, 'stack:restart never changes the saved stack profile');
  const compose = fs.readFileSync(new URL('../../infra/compose.yaml', import.meta.url), 'utf8');
  const lti = compose.split('\n  lti-service:\n')[1]?.split(/\n  [\w-]+:\n/)[0];
  assert.ok(lti?.includes('STACK_PROFILE: ${ACTIVE_STACK_PROFILE:-default}'), 'The base service profile comes from the saved profile');
  const restartCall = (overrides) => ['npm', ['run', 'stack:restart', '--', 'lti-service', ...overrides],
    { cwd: clone, env: { ...r.STACK_ENV, STACK_PROFILE: 'acceptance' }, timeoutMs: 180_000 }];
  const cases = [
    ['m1-c1', { profile: 'default', simulation: 'off' }, ['--env', 'STACK_PROFILE=default', '--env', 'LTI_PROVIDER_SIMULATION=off']],
    ['m1-c2', { profile: 'default', simulation: 'on' }, ['--env', 'STACK_PROFILE=default', '--env', 'LTI_PROVIDER_SIMULATION=on']],
    ['m1-c3', { profile: 'acceptance', simulation: 'off' }, ['--env', 'STACK_PROFILE=acceptance', '--env', 'LTI_PROVIDER_SIMULATION=off']],
    ['m1-c4', { profile: 'acceptance', simulation: 'on' }, []],
  ];
  for (const [index, [id, payload, overrides]] of cases.entries()) {
    assert.equal((await invoke({ id, action: 'm1-profile', ...payload })).code, 0);
    assert.deepEqual(calls[index], restartCall(overrides), `m1-profile ${payload.profile}/${payload.simulation}`);
  }
  assert.equal((await invoke({ id: 'm1-c5', action: 'm1-restart', service: 'lti-service' })).code, 0);
  assert.deepEqual(calls[4], restartCall([]), 'm1-restart is unchanged');
  for (const [id, payload] of [['m1-c6', { profile: 'production', simulation: 'on' }], ['m1-c7', { profile: 'default', simulation: 'yes' }]]) {
    const refused = await invoke({ id, action: 'm1-profile', ...payload });
    assert.equal(refused.code, 2); assert.equal(refused.stderr, 'Unknown M1 host action');
  }
  assert.equal(calls.length, 5, 'No subprocess for a refused profile');
});
