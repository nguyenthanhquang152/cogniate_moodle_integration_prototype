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
