// Runner unit tests use a fake npm in temporary git repositories. No network or stack is used.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const apiKey = ['ltis', '_', 'planted'.repeat(7)].join('');
const privateKey = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ');
const masterKey = 'c7'.repeat(32);
const secretName = ['LTI', 'MASTER', 'KEY'].join('_');
const publicName = ['PUBLIC', 'PORT'].join('_');
const example = `# --- secrets (generated) ---\n${secretName}=\n# --- public config ---\n${publicName}=\n`;
const auditReport = { vulnerabilities: {}, metadata: { vulnerabilities: { high: 0, critical: 0 } } };
const sbomReport = { bomFormat: 'CycloneDX', specVersion: '1.6', components: [] };
const fakeNpm = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const step = args[0] === 'ci' ? (path.basename(process.cwd()) === 'tests' ? 'install-tests' : 'install-root') : args[0];
fs.appendFileSync(process.env.CALLS, JSON.stringify({ step, args, offline: process.env.npm_config_offline, audit: process.env.npm_config_audit }) + '\\n');
const scenario = JSON.parse(process.env.SCENARIO || '{}');
const response = scenario[step] || {};
if (response.stderr) process.stderr.write(response.stderr);
if (response.stdout !== undefined) process.stdout.write(response.stdout);
else if (step === 'audit') process.stdout.write(JSON.stringify(${JSON.stringify(auditReport)}));
else if (step === 'sbom') process.stdout.write(JSON.stringify(${JSON.stringify(sbomReport)}));
else process.stdout.write('private child output must not reach the summary\\n');
process.exit(response.code || 0);
`;

function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ci local '));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const root = path.join(base, 'repo');
  const bin = path.join(base, 'bin');
  fs.mkdirSync(path.join(root, 'infra/scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'tests'));
  fs.mkdirSync(bin);
  fs.copyFileSync(path.join(HERE, 'ci-local.sh'), path.join(root, 'infra/scripts/ci-local.sh'));
  fs.writeFileSync(path.join(bin, 'npm'), fakeNpm, { mode: 0o755 });
  // A fail-fast guard also protects against an accidental future stack command.
  fs.writeFileSync(path.join(bin, 'docker'), '#!/bin/sh\nexit 99\n', { mode: 0o755 });
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
  const git = (...args) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8' });
  git('init', '-q');
  const put = (file, text, track = true) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
    if (track) git('add', '--', file);
  };
  put('.env.example', example);
  put('package.json', '{}\n');
  git('add', 'infra/scripts/ci-local.sh');
  const run = (scenario = {}) => {
    const calls = path.join(base, 'calls');
    fs.writeFileSync(calls, '');
    const result = spawnSync('bash', [path.join(root, 'infra/scripts/ci-local.sh')], {
      cwd: base, env: { ...env, CALLS: calls, SCENARIO: JSON.stringify(scenario) }, encoding: 'utf8', timeout: 15_000,
    });
    assert.ifError(result.error);
    assert.equal(result.stderr, '');
    const lines = result.stdout.trim().split('\n').map((line) => JSON.parse(line));
    assert.deepEqual(lines.map((line) => line.name), ['install', 'check', 'audit', 'sbom', 'secrets']);
    lines.forEach((line, i) => { assert.equal(line.step, i + 1); assert.ok(line.seconds >= 0); });
    return { ...result, lines, calls: fs.readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)) };
  };
  return { root, put, run, git };
}

test('runs the five steps in order and keeps only install and audit online', (t) => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.status, 0);
  assert.deepEqual(result.lines.map((line) => line.result), Array(5).fill('pass'));
  assert.deepEqual(result.calls.map((call) => call.args), [
    ['ci', '--ignore-scripts'], ['ci', '--ignore-scripts'], ['run', 'check'],
    ['audit', '--omit=dev', '--audit-level=high', '--json'], ['sbom', '--sbom-format', 'cyclonedx', '--omit', 'dev'],
  ]);
  assert.deepEqual(result.calls.map((call) => call.offline), ['false', 'false', 'true', 'false', 'true']);
  assert.ok(result.calls.every((call) => call.audit === 'false'));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.root, '.tmp/ci/sbom.cdx.json'), 'utf8')), sbomReport);
  assert.ok(!result.stdout.includes('private child output'));
});

for (const step of ['install-root', 'install-tests', 'audit']) {
  test(`classifies a registry failure in ${step} and skips later steps`, (t) => {
    const f = fixture(t);
    f.put('.tmp/ci/sbom.cdx.json', 'stale', false);
    const result = f.run({ [step]: { code: 1, stderr: `npm error code ECONNREFUSED ${apiKey}` } });
    assert.equal(result.status, 2);
    const failed = step === 'audit' ? 2 : 0;
    assert.equal(result.lines[failed].result, 'network_unavailable');
    assert.ok(result.lines.slice(failed + 1).every((line) => line.result === 'skip'));
    assert.equal(result.calls.at(-1).step, step);
    assert.ok(!result.stdout.includes(apiKey));
    assert.equal(fs.existsSync(path.join(f.root, '.tmp/ci/sbom.cdx.json')), false);
  });
}

test('keeps a failed check as a failure while running the remaining independent checks', (t) => {
  const f = fixture(t);
  const result = f.run({ run: { code: 1, stderr: apiKey } });
  assert.equal(result.status, 1);
  assert.deepEqual(result.lines.map((line) => line.result), ['pass', 'fail', 'pass', 'pass', 'pass']);
  assert.ok(!result.stdout.includes(apiKey));
});

test('an install error is not treated as a network failure or a successful check', (t) => {
  const result = fixture(t).run({ 'install-root': { code: 1, stderr: 'npm error code EUSAGE' } });
  assert.equal(result.status, 1);
  assert.deepEqual(result.lines.map((line) => line.result), ['fail', 'skip', 'pass', 'skip', 'pass']);
  assert.equal(result.lines[0].code, 'EUSAGE');
});

test('audit findings name advisory ids and do not block the SBOM or secret scan', (t) => {
  const report = { vulnerabilities: { demo: { via: [{ source: 12345, url: 'https://github.com/advisories/GHSA-2345-6789-cfgh', title: apiKey }] } }, metadata: { vulnerabilities: { high: 1, critical: 0 } } };
  const result = fixture(t).run({ audit: { code: 1, stdout: JSON.stringify(report) } });
  assert.equal(result.status, 1);
  assert.deepEqual(result.lines[2].advisoryIds, ['12345', 'GHSA-2345-6789-cfgh']);
  assert.equal(result.lines[3].result, 'pass');
  assert.equal(result.lines[4].result, 'pass');
  assert.ok(!result.stdout.includes(apiKey));
});

test('invalid audit and SBOM documents fail and leave no stale artifact', (t) => {
  const f = fixture(t);
  f.put('.tmp/ci/sbom.cdx.json', 'stale', false);
  const result = f.run({ audit: { stdout: '{}' }, sbom: { stdout: 'not JSON' } });
  assert.equal(result.status, 1);
  assert.equal(result.lines[2].result, 'fail');
  assert.equal(result.lines[3].result, 'fail');
  assert.equal(fs.existsSync(path.join(f.root, '.tmp/ci/sbom.cdx.json')), false);
});

test('scans tracked text, binary data and unusual names, and reports locations without values', (t) => {
  const f = fixture(t);
  f.put('probe file\nname.bin', Buffer.from(`safe\n\0${apiKey}\n${privateKey}\n${masterKey}\n`));
  f.put('untracked.txt', apiKey, false);
  const result = f.run();
  assert.equal(result.status, 1);
  assert.deepEqual(result.lines[4].findings, [
    { file: 'probe file\nname.bin', line: 2, rule: 'api_key' },
    { file: 'probe file\nname.bin', line: 3, rule: 'private_key' },
    { file: 'probe file\nname.bin', line: 4, rule: 'master_key' },
  ]);
  for (const value of [apiKey, privateKey, masterKey]) assert.ok(!result.stdout.includes(value));
});

test('documentation excludes only the 64-hex rule', (t) => {
  const f = fixture(t);
  f.put('docs/probe.md', `${masterKey}\n${apiKey}\n${privateKey}\n${secretName}=bad\n`);
  const result = f.run();
  assert.equal(result.status, 1);
  assert.deepEqual(result.lines[4].findings.map((hit) => hit.rule), ['api_key', 'private_key', 'secret_assignment']);
});

test('discovers secret names and catches shell, YAML, JSON and export assignments', (t) => {
  const f = fixture(t);
  const custom = 'CUSTOM_PASSWORD';
  f.put('.env.example', example.replace(`${secretName}=`, `${custom}=\n${secretName}=`));
  f.put('probe.txt', `${custom}=alpha\n${secretName}: bravo\n"${secretName}": "charlie"\nexport ${secretName}='delta'\n${publicName}=8443\n`);
  const result = f.run();
  assert.equal(result.status, 1);
  assert.deepEqual(result.lines[4].findings.map((hit) => [hit.line, hit.rule]), [1, 2, 3, 4].map((line) => [line, 'secret_assignment']));
});

test('ignores empty values and placeholders outside the names-only example', (t) => {
  const f = fixture(t);
  const values = ['', '""', "''", '$VALUE', '${VALUE:?required}', '<value>', '"${VALUE}"'];
  f.put('probe.txt', values.map((value) => `${secretName}=${value}\n`).join(''));
  assert.equal(f.run().status, 0);
  f.put('.env.example', example.replace(`${publicName}=`, `${publicName}=8443`));
  assert.deepEqual(f.run().lines[4].findings, [{ file: '.env.example', line: 4, rule: 'example_value' }]);
});

test('code files check quoted literals but not identifiers or other expressions', (t) => {
  const f = fixture(t);
  const extensions = ['ts', 'tsx', 'mts', 'cts', 'js', 'mjs', 'cjs'];
  const expressions = ['LEGACY', 'keys.LEGACY', 'hex(LEGACY)', '42', '{ value: "example" }', '`${VALUE}`'];
  for (const extension of extensions) {
    f.put(`probe.${extension}`, expressions.map((value) => `${secretName}: ${value},`).join('\n'));
  }
  assert.equal(f.run().status, 0);
  for (const extension of extensions) {
    f.put(`probe.${extension}`, ['"alpha"', "'bravo'", '`charlie`', '"delta" + suffix'].map((value) => `${secretName}: ${value},`).join('\n'));
  }
  const result = f.run();
  assert.equal(result.status, 1);
  for (const extension of extensions) {
    assert.deepEqual(result.lines[4].findings.filter((hit) => hit.file === `probe.${extension}`),
      [1, 2, 3, 4].map((line) => ({ file: `probe.${extension}`, line, rule: 'secret_assignment' })));
  }
  for (const value of ['alpha', 'bravo', 'charlie', 'delta']) assert.ok(!result.stdout.includes(value));
});

test('non-code files still check bare tokens as values', (t) => {
  const f = fixture(t);
  for (const extension of ['json', 'yaml', 'sh']) f.put(`probe.${extension}`, `${secretName}: LEGACY`);
  const result = f.run();
  assert.equal(result.status, 1);
  assert.deepEqual(result.lines[4].findings.map((hit) => hit.file), ['probe.json', 'probe.sh', 'probe.yaml']);
});

test('fails closed when the secrets section or a tracked file is missing', (t) => {
  const f = fixture(t);
  f.put('.env.example', `${secretName}=\n`);
  assert.equal(f.run().lines[4].reason, 'secret_names_unavailable');
  f.put('.env.example', example);
  f.put('missing.txt', 'safe');
  fs.unlinkSync(path.join(f.root, 'missing.txt'));
  assert.deepEqual(f.run().lines[4].findings, [{ file: 'missing.txt', line: 1, rule: 'unreadable_file' }]);
});

test('an exact file and value exception permits the known fake, and rejects a new value', (t) => {
  const f = fixture(t);
  const allowed = 'packages/shared/src/logger.test.ts';
  const fakeKey = ['ltis', '_0123456789abcdef'].join('');
  f.put(allowed, `moved to a new line\n${fakeKey}\n`);
  const clean = f.run();
  assert.equal(clean.status, 0);
  assert.ok(clean.lines[4].notes.some((note) => note.note === 'stale_allow_list_entry'));
  f.put(allowed, `${fakeKey}\n${apiKey}\n`);
  assert.deepEqual(f.run().lines[4].findings, [{ file: allowed, line: 2, rule: 'api_key' }]);
  f.put('copied.txt', fakeKey);
  assert.ok(f.run().lines[4].findings.some((hit) => hit.file === 'copied.txt'));
});

test('a complete private-key block cannot use an exception for a header search string', (t) => {
  const f = fixture(t);
  const allowed = 'tests/acceptance/M1/common/99-logs.test.ts';
  f.put(allowed, privateKey);
  assert.equal(f.run().status, 0);
  const block = `${privateKey}\nZmFrZS1rZXktZm9yLXRoZS11bml0LXRlc3Q=\n${privateKey.replace('BEGIN', 'END')}`;
  f.put(allowed, `safe\n${block}\n`);
  const result = f.run();
  assert.equal(result.status, 1);
  assert.deepEqual(result.lines[4].findings, [{ file: allowed, line: 2, rule: 'private_key' }]);
  assert.ok(!result.stdout.includes('ZmFrZS1rZXktZm9yLXRoZS11bml0LXRlc3Q='));
});
