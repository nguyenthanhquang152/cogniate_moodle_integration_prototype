// Host-only wrapper tests: lib.sh is a fake transport. No Docker executable is invoked.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dirs = [];
afterEach(() => { for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lti bootstrap unit ')); dirs.push(dir);
  const infra = path.join(dir, 'infra'); const scripts = path.join(infra, 'scripts');
  fs.mkdirSync(scripts, { recursive: true });
  fs.copyFileSync(path.join(here, 'lti-bootstrap.sh'), path.join(scripts, 'lti-bootstrap.sh'));
  fs.writeFileSync(path.join(scripts, 'lib.sh'), `set -euo pipefail
INFRA_DIR="$TEST_INFRA"
require_env() { :; }
require_running() { :; }
dc() {
  printf '%s\\n' "$*" >> "$TEST_INFRA/calls"
  case "$*" in
    *src/cli/operator.ts*) cat "$TEST_INFRA/init-output" ;;
    *src/cli/bootstrap.ts*)
      [[ -s "$TEST_INFRA/.secrets/lti/lti-operator-key" ]] || return 91
      cat "$TEST_INFRA/bootstrap-output" ;;
    *) return 92 ;;
  esac
}
`);
  const key = `ltio_${'x'.repeat(43)}`; const apiKey = `ltis_${'y'.repeat(43)}`;
  fs.writeFileSync(path.join(infra, 'init-output'), `${key}\n`);
  fs.writeFileSync(path.join(infra, 'bootstrap-output'), JSON.stringify({ account: 'unit-tool', created: true, kid: 'kid-one', apiKey }));
  const original = path.join(infra, '.secrets/lti-operator-key');
  const copy = path.join(infra, '.secrets/lti/lti-operator-key');
  const run = (...args) => spawnSync('bash', [path.join(scripts, 'lti-bootstrap.sh'), '--account', 'unit-tool', ...args], {
    env: { PATH: process.env.PATH, TEST_INFRA: infra, OPERATOR_NAME: 'unit' }, encoding: 'utf8', timeout: 10_000,
  });
  return { infra, key, apiKey, original, copy, run, calls: () => fs.readFileSync(path.join(infra, 'calls'), 'utf8') };
}

it('initializes before bootstrap and publishes a private key copy without exposing it in command arguments', () => {
  const h = fixture(); const result = h.run('--ensure-key-file', '--quiet');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(h.original, 'utf8'), `${h.key}\n`);
  assert.equal(fs.readFileSync(h.copy, 'utf8'), `${h.key}\n`);
  assert.equal(fs.statSync(h.copy).mode & 0o777, 0o600);
  assert.equal(fs.existsSync(`${h.copy}.tmp`), false);
  assert.match(h.calls().split('\n')[0], /operator.ts init --if-none --name unit/);
  assert.match(h.calls(), /bootstrap.ts --account unit-tool --rotate-api-key/);
  assert.equal(h.calls().includes(h.key), false);
  assert.equal(result.stdout.includes(h.key), false);
  assert.equal(result.stdout.includes(h.apiKey), false);
  assert.equal(fs.readFileSync(path.join(h.infra, '.secrets/lti-api-key.unit-tool'), 'utf8'), `${h.apiKey}\n`);
});

it('a second run keeps API keys and refreshes the mounted operator copy from the original', () => {
  const h = fixture(); assert.equal(h.run('--quiet').status, 0);
  fs.writeFileSync(path.join(h.infra, 'init-output'), 'operator key exists\n');
  fs.writeFileSync(path.join(h.infra, 'bootstrap-output'), JSON.stringify({ account: 'unit-tool', created: false, kid: 'kid-one', apiKey: null }));
  const replacement = `ltio_${'z'.repeat(43)}`; fs.writeFileSync(h.original, replacement);
  fs.chmodSync(h.copy, 0o644);
  const result = h.run('--ensure-key-file', '--quiet');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(h.copy, 'utf8'), replacement);
  assert.equal(fs.statSync(h.copy).mode & 0o777, 0o600);
  assert.equal(h.calls().trim().split('\n').at(-1).includes('--rotate-api-key'), false);
  assert.match(result.stdout, /API key unchanged/);
});

it('a missing original stops bootstrap and deletes a stale mounted operator copy', () => {
  const h = fixture(); assert.equal(h.run('--quiet').status, 0);
  fs.rmSync(h.original); fs.writeFileSync(path.join(h.infra, 'init-output'), 'operator key exists\n');
  const before = h.calls().split('src/cli/bootstrap.ts').length;
  const result = h.run('--quiet');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /infra\/\.secrets\/lti-operator-key is missing/);
  assert.equal(fs.existsSync(h.copy), false);
  assert.equal(h.calls().split('src/cli/bootstrap.ts').length, before);
});
