import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyResults, playwrightResults, vitestResults } from './coverage.mjs';
const productSha = '1'.repeat(40), testSha = '2'.repeat(40);
const expected = [{ id: 'M1-37.blackboard.a', environment: 'SIM' }, { id: 'M1-37.canvas.c', environment: 'SIM' }];
const good = expected.map((row) => ({ ...row, productSha, testSha, status: 'PASS' }));
test('HARNESS ONLY: complete same-SHA evidence is accepted', () => {
  assert.equal(verifyResults(expected, good, { productSha, testSha }), true);
});
for (const [name, rows] of [
  ['missing provider', good.slice(0, 1)],
  ['empty selection', []],
  ['skipped case', [good[0], { ...good[1], status: 'SKIP' }]],
  ['mixed product SHA', [good[0], { ...good[1], productSha: '3'.repeat(40) }]],
  ['mixed test SHA', [good[0], { ...good[1], testSha: '3'.repeat(40) }]],
  ['wrong evidence label', [good[0], { ...good[1], environment: 'CANVAS-HOSTED' }]],
  ['duplicate result', [...good, good[0]]],
  ['unselected executed case', [...good, { ...good[0], id: 'M1-37.blackboard.y2' }]],
]) test('HARNESS ONLY: evidence gate rejects ' + name, () => {
  assert.throws(() => verifyResults(expected, rows, { productSha, testSha }));
});
test('HARNESS ONLY: phased accounting ignores only unselected skipped cases', () => {
  const report = (status) => ({ testResults: [{ assertionResults: [
    { fullName: '{case:M1-37.blackboard.a}', status: 'passed' },
    { fullName: '{case:M1-37.blackboard.y2}', status },
  ] }] });
  assert.equal(vitestResults(report('skipped'), expected, { productSha, testSha }, { partial: true }).length, 1);
  assert.throws(() => vitestResults(report('passed'), expected, { productSha, testSha }, { partial: true }), /Unmanifested/);
  assert.throws(() => vitestResults(report('skipped'), expected, { productSha, testSha }), /Unmanifested/);
});
test('HARNESS ONLY: an empty expected inventory is an error', () => {
  assert.throws(() => verifyResults([], [], { productSha, testSha }), /Empty expected/);
});
test('HARNESS ONLY: expected browser failures and retries are not acceptance PASS', () => {
  const browser = (result) => ({ suites: [{ specs: [{ title: '{case:M1-37.canvas.c}', tests: [result] }] }] });
  for (const result of [
    { status: 'expected', expectedStatus: 'failed', results: [{ status: 'failed' }] },
    { status: 'expected', expectedStatus: 'passed', results: [{ status: 'failed' }, { status: 'passed' }] },
  ]) assert.equal(playwrightResults(browser(result), expected, { productSha, testSha })[0].status, 'FAIL');
});
