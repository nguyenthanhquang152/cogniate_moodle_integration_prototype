// node --test tests/ltiaas/tasks-ops/LA-E5-01/cli-output.selftest.mjs (no Docker). The values are invented.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initResult } from './cli-output.mjs';

const KEY = `ltio_${'A'.repeat(20)}-_${'b9'.repeat(10)}c`; // 5 + 43 characters
const BANNER = '\n> @cogniate/lti-service@0.0.0 lti:operator\n> node src/cli/operator.ts init --name qa\n\n';
const NPM_FAIL = 'npm error Lifecycle script `lti:operator` failed with error:\nnpm error code 1\nnpm error path /repo/services/lti-service\n';
const NODE_WARN = '(node:41) ExperimentalWarning: Type Stripping is an experimental feature\n(Use `node --trace-warnings ...` to show where the warning was created)\n';

test('refusal: one CLI line between npm and Node lines; no key', () => {
  const r = initResult('plain', { code: 1, stdout: BANNER, stderr: `${NODE_WARN}an active operator key exists\n${NPM_FAIL}` });
  assert.deepEqual(r.cliLines, ['an active operator key exists']);
  assert.equal(r.keyCount, 0);
  assert.equal(r.cliCode, 1);
});

test('--if-none: the exact line is kept', () => {
  assert.deepEqual(initResult('if-none', { code: 0, stdout: `${BANNER}operator key exists\n`, stderr: '' }).cliLines, ['operator key exists']);
});

test('--replace: one key, counted once, masked in the lines, kept in keys', () => {
  const r = initResult('replace', { code: 0, stdout: `${BANNER}${KEY}\nkey of qa: ${KEY}\n`, stderr: '' });
  assert.equal(KEY.length, 48);
  assert.equal(r.keyCount, 1);
  assert.deepEqual(r.keys, [KEY]);
  assert.deepEqual(r.cliLines, ['<operator-key>', 'key of qa: <operator-key>']);
  assert.equal(JSON.stringify(r.cliLines).includes(KEY), false);
});

test('a longer token is not an operator key; two keys count as two', () => {
  assert.equal(initResult('replace', { code: 0, stdout: `${KEY}x\n`, stderr: '' }).keyCount, 0);
  const other = KEY.replace('A', 'B');
  assert.equal(initResult('replace', { code: 0, stdout: `${KEY}\n${other}\n`, stderr: '' }).keyCount, 2);
});
