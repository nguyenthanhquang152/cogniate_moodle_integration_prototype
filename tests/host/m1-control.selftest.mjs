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

test('HARNESS ONLY: with the storage-compat marker the host control refuses m1-restart and m1-profile before any command', async (t) => {
  const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-m1-marker-'));
  const dir = path.join(clone, 'tests/acceptance/artifacts/control');
  fs.mkdirSync(dir, { recursive: true }); fs.mkdirSync(path.join(clone, '.tmp'));
  const knobs = path.join(clone, '.tmp/compose.knobs.yaml');
  fs.writeFileSync(knobs, JSON.stringify({ 'x-cogniate-storage-compat': { formatVersion: 1 } }));
  const calls = [];
  const r = {
    CLONE: clone, PROJECT: 'qa-marker-selfcheck', state: { h1Verified: true },
    STACK_ENV: { COMPOSE_PROJECT_NAME: 'qa-marker-selfcheck' }, redact: { add: () => {} }, saveText: () => {},
    record: (...args) => assert.fail(JSON.stringify(args)),
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
  for (const req of [{ id: 'm1-d1', action: 'm1-restart', service: 'lti-service' }, { id: 'm1-d2', action: 'm1-profile', profile: 'default', simulation: 'off' }]) {
    const refused = await invoke(req);
    assert.equal(refused.code, 2); assert.match(refused.stderr, /storage-compat marker present/);
  }
  assert.equal(calls.length, 0, 'No command runs while the marker is present');
  assert.equal((await invoke({ id: 'm1-d3', action: 'm1-cli', script: 'app:grant', args: ['list'] })).code, 0, 'CLI exec is not a restart');
  assert.equal(calls.length, 1);
  // A knobs file without the marker (ordinary test knobs) does not block restarts.
  fs.writeFileSync(knobs, JSON.stringify({ services: { 'lti-service': { environment: { STACK_PROFILE: 'default' } } } }));
  assert.equal((await invoke({ id: 'm1-d4', action: 'm1-restart', service: 'lti-service' })).code, 0);
  assert.equal(calls.length, 2);
});

// M1-38: run-m1 suite() starts a new controller for each stage on the same clone, and request files stay.
// Synthetic grant store (App contract §4.8): an issue revokes the older unredeemed grants of the same connection
// and purpose; an initial issue for a bound connection exits 1 and stores nothing. No container and no product.
test('HARNESS ONLY: a new controller on the same folder never repeats an answered request (M1-38 seed, then upgrade)', async (t) => {
  const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-m1-restart-'));
  const dir = path.join(clone, 'tests/acceptance/artifacts/control');
  fs.mkdirSync(dir, { recursive: true });
  const grants = [], bound = new Set(), runs = new Map(), saves = new Map();
  let hold, release;
  async function runCommand(command, args) {
    const [verb, ...rest] = args.slice(args.indexOf('--') + 1), opt = {};
    for (let i = 0; i < rest.length; i += 2) opt[rest[i].slice(2)] = rest[i + 1];
    runs.set(opt.note, (runs.get(opt.note) ?? 0) + 1);
    if (hold?.note === opt.note) { hold.entered(); await hold.released; }
    if (verb === 'list') return { code: 0, stdout: `${grants.length} grants`, stderr: '', durationMs: 1 };
    if (opt.purpose === 'initial' && bound.has(opt.connection)) return { code: 1, stdout: '', stderr: 'connection is bound', durationMs: 1 };
    for (const g of grants) if (g.connection === opt.connection && g.purpose === opt.purpose && g.status === 'issued') g.status = 'revoked';
    grants.push({ id: `grt_${grants.length + 1}`, connection: opt.connection, purpose: opt.purpose, status: 'issued' });
    return { code: 0, stdout: grants.at(-1).id, stderr: '', durationMs: 1 };
  }
  // The product call that redeems a grant (outside the host control).
  function redeem(id) {
    const grant = grants.find((g) => g.id === id);
    if (grant.status !== 'issued') return grant.status;
    grant.status = 'redeemed'; if (grant.purpose === 'initial') bound.add(grant.connection);
    return grant.status;
  }
  const r = {
    CLONE: clone, PROJECT: 'qa-restart-selfcheck', state: { h1Verified: true },
    STACK_ENV: { COMPOSE_PROJECT_NAME: 'qa-restart-selfcheck' }, redact: { add: () => {} },
    saveText: (name, text) => saves.set(name, [...(saves.get(name) ?? []), JSON.parse(text)]),
    record: (...args) => assert.fail(JSON.stringify(args)),
  };
  let stop = m1HostControl(r, runCommand);
  t.after(async () => { release?.(); await stop(); fs.rmSync(clone, { recursive: true, force: true }); });
  function write(req) {
    const file = path.join(dir, `req-${req.id}.json`);
    fs.writeFileSync(file + '.tmp', JSON.stringify(req)); fs.renameSync(file + '.tmp', file);
  }
  async function answer(id) {
    const ackPath = path.join(dir, `ack-${id}.json`), limit = Date.now() + 3000;
    while (!fs.existsSync(ackPath) && Date.now() < limit) await delay(10);
    assert.ok(fs.existsSync(ackPath), `Host control answered ${id}`);
    return JSON.parse(fs.readFileSync(path.join(dir, JSON.parse(fs.readFileSync(ackPath, 'utf8')).out), 'utf8'));
  }
  const invoke = async (req) => { write(req); return answer(req.id); };
  const grantCli = (id, args) => ({ id, action: 'm1-cli', script: 'app:grant', args: [...args, '--note', id] });

  // Stage 1 (snapshot-seed): success, a non-zero command, and two requests refused before any command.
  assert.equal((await invoke(grantCli('m1-b1', ['issue', '--connection', 'con_a', '--purpose', 'initial']))).code, 0);
  assert.equal(redeem('grt_1'), 'redeemed');
  assert.equal((await invoke(grantCli('m1-b2', ['issue', '--connection', 'con_a', '--purpose', 'add_deployment']))).stdout, 'grt_2');
  assert.equal((await invoke(grantCli('m1-b3', ['issue', '--connection', 'con_a', '--purpose', 'initial']))).code, 1);
  assert.equal((await invoke({ id: 'm1-b4', action: 'm1-cli', script: 'arbitrary', args: [] })).stderr, 'CLI whitelist');
  assert.equal((await invoke({ id: 'm1-b5', action: 'm1-reset' })).stderr, 'Unknown M1 host action');
  // stop() while a command runs: it waits, so the ack exists before the next controller starts.
  const entered = new Promise((resolve) => { hold = { note: 'm1-b6', entered: resolve, released: new Promise((go) => { release = go; }) }; });
  write(grantCli('m1-b6', ['list', '--connection', 'con_a']));
  await entered;
  let stopped = false;
  const stopping = stop().then(() => { stopped = true; });
  await delay(100);
  assert.equal(stopped, false, 'stop() waits for the running command');
  release(); await stopping;
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'ack-m1-b6.json'), 'utf8')).code, 0, 'The running command has its ack');
  // A request that no controller took stays queued for the next controller.
  write(grantCli('m1-b7', ['list', '--connection', 'con_a']));
  await delay(100);
  assert.equal(runs.has('m1-b7'), false, 'No controller runs between the stages');
  const stage1 = Object.fromEntries(fs.readdirSync(dir).map((name) => [name, fs.readFileSync(path.join(dir, name), 'utf8')]));

  // Stage 2 (snapshot-upgrade): a new controller on the same folder and the same runner object.
  stop = m1HostControl(r, runCommand);
  assert.equal((await answer('m1-b7')).code, 0, 'The queued request is answered');
  assert.equal((await invoke(grantCli('m1-b8', ['issue', '--connection', 'con_b', '--purpose', 'initial']))).code, 0, 'A new request runs');
  // M1-38 h4: the seeded add_deployment grant is still valid; then a fresh grant is issued and redeemed.
  assert.equal(redeem('grt_2'), 'redeemed', 'No repeated issue revoked the seeded grant');
  assert.equal(redeem((await invoke(grantCli('m1-b9', ['issue', '--connection', 'con_a', '--purpose', 'add_deployment']))).stdout), 'redeemed');
  await stop();

  const executed = ['m1-b1', 'm1-b2', 'm1-b3', 'm1-b6', 'm1-b7', 'm1-b8', 'm1-b9'];
  assert.deepEqual([...runs.keys()].sort(), executed, 'Refused requests ran no command');
  for (const id of executed) assert.equal(runs.get(id), 1, `${id} ran once`);
  assert.deepEqual(grants.map((g) => g.status), ['redeemed', 'redeemed', 'issued', 'redeemed']);
  for (const [name, text] of Object.entries(stage1)) assert.equal(fs.readFileSync(path.join(dir, name), 'utf8'), text, `${name} is unchanged`);
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) assert.equal(saves.get(`host-actions/m1-b${n}.json`)?.length, 1, `One host-actions record for m1-b${n}`);
});

test('HARNESS ONLY: requests queued before the first controller run once; a request id must equal its file name', async (t) => {
  const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-m1-queued-'));
  const dir = path.join(clone, 'tests/acceptance/artifacts/control');
  fs.mkdirSync(dir, { recursive: true });
  const notes = [], records = [];
  const r = {
    CLONE: clone, PROJECT: 'qa-queued-selfcheck', state: { h1Verified: true },
    STACK_ENV: { COMPOSE_PROJECT_NAME: 'qa-queued-selfcheck' }, redact: { add: () => {} }, saveText: () => {},
    record: (...args) => records.push(args),
  };
  const runCommand = async (command, args) => { notes.push(args.at(-1)); return { code: 0, stdout: 'ok', stderr: '', durationMs: 1 }; };
  const request = (name, id) => fs.writeFileSync(path.join(dir, `req-${name}.json`),
    JSON.stringify({ id, action: 'm1-cli', script: 'app:grant', args: ['list', '--note', name] }));
  async function until(what, predicate) {
    const limit = Date.now() + 3000;
    while (!predicate() && Date.now() < limit) await delay(10);
    assert.ok(predicate(), what);
  }
  // A fresh control folder can hold requests before the controller starts.
  request('m1-e1', 'm1-e1'); request('m1-e2', 'm1-e2');
  let stop = m1HostControl(r, runCommand);
  t.after(async () => { await stop(); fs.rmSync(clone, { recursive: true, force: true }); });
  await until('Both queued requests are answered', () => ['m1-e1', 'm1-e2'].every((id) => fs.existsSync(path.join(dir, `ack-${id}.json`))));
  const ack = fs.readFileSync(path.join(dir, 'ack-m1-e1.json'), 'utf8');
  // The ack and output names come from the id. A file with another id must not run or overwrite that answer.
  request('m1-e3', 'm1-e1');
  await until('The mismatched request is refused', () => records.length === 1);
  await stop();
  // A refused request has no ack, so the next controller refuses it again. It never runs a command.
  stop = m1HostControl(r, runCommand);
  await until('The next controller refuses it again', () => records.length === 2);
  await stop();
  for (const record of records) assert.deepEqual(record, ['HOST-CONTROL', 'M1 host request was rejected', 'FAIL', ['Request id']]);
  assert.deepEqual(notes, ['m1-e1', 'm1-e2'], 'Each queued request ran once; the mismatched request ran no command');
  assert.equal(fs.readFileSync(path.join(dir, 'ack-m1-e1.json'), 'utf8'), ack);
  assert.equal(fs.existsSync(path.join(dir, 'ack-m1-e3.json')), false);
});

test('HARNESS ONLY: AC-M1-37 kill-mode m1-restart runs SIGKILL then guarded restart and enforces service, mode, marker and QA guards', async (t) => {
  const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-m1-kill-'));
  const dir = path.join(clone, 'tests/acceptance/artifacts/control');
  fs.mkdirSync(dir, { recursive: true }); fs.mkdirSync(path.join(clone, '.tmp'));
  const knobs = path.join(clone, '.tmp/compose.knobs.yaml');
  const calls = [], saved = new Map();
  let scripted = [];
  const r = {
    CLONE: clone, PROJECT: 'qa-kill-selfcheck', state: { h1Verified: true },
    STACK_ENV: { COMPOSE_PROJECT_NAME: 'qa-kill-selfcheck', STACK_PROFILE: 'default' },
    redact: { add: () => {} },
    saveText: (name, text) => saved.set(name, JSON.parse(text)),
    record: (...args) => assert.fail(JSON.stringify(args)),
  };
  let stop = m1HostControl(r, async (...args) => {
    calls.push(args);
    return scripted.shift() ?? { code: 0, stdout: 'ok', stderr: '', durationMs: 1 };
  });
  t.after(async () => { await stop(); fs.rmSync(clone, { recursive: true, force: true }); });
  async function invoke(req) {
    fs.writeFileSync(path.join(dir, `req-${req.id}.json`), JSON.stringify(req));
    const ackPath = path.join(dir, `ack-${req.id}.json`), limit = Date.now() + 3000;
    while (!fs.existsSync(ackPath) && Date.now() < limit) await delay(10);
    assert.ok(fs.existsSync(ackPath), `Host control completed ${req.id}`);
    const ack = JSON.parse(fs.readFileSync(ackPath, 'utf8'));
    return { ack, result: JSON.parse(fs.readFileSync(path.join(dir, ack.out), 'utf8')) };
  }

  // 1. Sequence and env: SIGKILL cogniate-app first, then guarded stack:restart -- cogniate-app.
  scripted = [
    { code: 0, stdout: '', stderr: 'Killing cogniate-app', durationMs: 17 },
    { code: 0, stdout: 'Restoring defaults for cogniate-app\ncogniate-app is healthy.', stderr: '', durationMs: 240 },
  ];
  const ok = await invoke({ id: 'm1-f1', action: 'm1-restart', service: 'cogniate-app', mode: 'kill' });
  assert.equal(ok.ack.ok, true);
  assert.equal(ok.result.code, 0);
  assert.equal(ok.result.durationMs, 257);
  assert.equal(ok.result.stderr, 'Killing cogniate-app');
  const lines = ok.result.stdout.split('\n');
  assert.match(lines[0], /^kill: exit 0, \d{4}-\d{2}-\d{2}T[^\s–]+Z–\d{4}-\d{2}-\d{2}T[^\s–]+Z$/);
  assert.deepEqual(lines.slice(1), ['Restoring defaults for cogniate-app', 'cogniate-app is healthy.']);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], ['docker', [
    'compose', '-f', 'infra/compose.yaml', '--env-file', '.env',
    'kill', '-s', 'SIGKILL', 'cogniate-app',
  ], { cwd: clone, env: r.STACK_ENV, timeoutMs: 30_000 }]);
  assert.deepEqual(calls[1], ['npm', ['run', 'stack:restart', '--', 'cogniate-app'], {
    cwd: clone, env: { ...r.STACK_ENV, STACK_PROFILE: 'acceptance' }, timeoutMs: 180_000,
  }]);
  assert.equal(saved.get('host-actions/m1-f1.json').durationMs, 257);

  // 2. Failed kill runs no restart.
  calls.length = 0;
  scripted = [{ code: 1, stdout: 'kill-out', stderr: 'no such container', durationMs: 19 }];
  const failedKill = await invoke({ id: 'm1-f2', action: 'm1-restart', service: 'cogniate-app', mode: 'kill' });
  assert.equal(failedKill.ack.ok, false);
  assert.equal(failedKill.result.code, 1);
  assert.equal(failedKill.result.durationMs, 19);
  assert.equal(failedKill.result.stderr, 'no such container');
  assert.match(failedKill.result.stdout, /^kill: exit 1, \d{4}-\d{2}-\d{2}T[^\s–]+Z–\d{4}-\d{2}-\d{2}T[^\s–]+Z\nkill-out$/);
  assert.equal(calls.length, 1, 'Failed kill must not run stack:restart');

  // 3. Invalid service with mode or unknown mode returns code 2 and runs no command.
  calls.length = 0;
  for (const [id, payload] of [
    ['m1-f3', { service: 'lti-service', mode: 'kill' }],
    ['m1-f4', { service: 'cogniate-app', mode: 'graceful' }],
    ['m1-f5', { service: 'cogniate-app', mode: '' }],
    ['m1-f6', { service: 'cogniate-app', mode: null }],
  ]) {
    const bad = await invoke({ id, action: 'm1-restart', ...payload });
    assert.equal(bad.result.code, 2);
    assert.equal(bad.result.stderr, 'Unknown M1 host action');
  }
  assert.equal(calls.length, 0, 'Invalid mode or service runs no command');

  // 4. Storage-compat marker refuses kill-mode m1-restart with no command.
  fs.writeFileSync(knobs, JSON.stringify({ 'x-cogniate-storage-compat': { formatVersion: 1 } }));
  const markerRefused = await invoke({ id: 'm1-f7', action: 'm1-restart', service: 'cogniate-app', mode: 'kill' });
  assert.equal(markerRefused.result.code, 2);
  assert.match(markerRefused.result.stderr, /storage-compat marker present/);
  assert.equal(calls.length, 0, 'Compat marker refuses before any command');
  fs.rmSync(knobs, { force: true });

  // 5. Non-QA project refuses kill-mode m1-restart with no command.
  await stop();
  r.PROJECT = 'dev-local';
  stop = m1HostControl(r, async (...args) => { calls.push(args); return { code: 0, stdout: '', stderr: '', durationMs: 1 }; });
  const nonQaRefused = await invoke({ id: 'm1-f8', action: 'm1-restart', service: 'cogniate-app', mode: 'kill' });
  assert.equal(nonQaRefused.result.code, 2);
  assert.equal(nonQaRefused.result.stderr, 'QA project guard');
  assert.equal(calls.length, 0, 'Non-QA project runs no command');
});
