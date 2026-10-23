// HARNESS ONLY self-tests of the M2 accounting (no product call).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { playwrightResults, verifyResults } from '../../acceptance/M1/common/coverage.mjs';
import { M2_REQUIRED, readM2Manifest } from './coverage.mjs';
import './browser-secrets.selftest.mjs';

const testsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const productSha = 'a'.repeat(40), testSha = 'b'.repeat(40);

test('HARNESS ONLY: the M2 manifest covers all 13 criteria and every named variant', () => {
  const rows = readM2Manifest(testsDir);
  assert.equal(Object.keys(M2_REQUIRED).length, 13);
  assert.equal(rows.length, Object.values(M2_REQUIRED).flat().length);
  assert.deepEqual([...new Set(rows.map((r) => r.ac))].sort(), Object.keys(M2_REQUIRED).map((k) => 'AC-' + k).sort());
});
test('HARNESS ONLY: an M2 browser report with a skip, a retry or a missing row is not PASS', () => {
  const rows = readM2Manifest(testsDir);
  const report = (status) => ({ suites: [{ specs: rows.map((r) => ({ title: r.title, tests: [status(r)] })) }] });
  const pass = () => ({ status: 'expected', expectedStatus: 'passed', results: [{ status: 'passed' }] });
  const ok = playwrightResults(report(pass), rows, { productSha, testSha });
  assert.equal(verifyResults(rows, ok, { productSha, testSha }), true);
  const skipped = playwrightResults(report((r) => (r.id === rows[0].id ? { status: 'skipped', results: [] } : pass())), rows, { productSha, testSha });
  assert.throws(() => verifyResults(rows, skipped, { productSha, testSha }), /not PASS/);
  const retried = playwrightResults(report((r) => (r.id === rows[1].id
    ? { status: 'flaky', expectedStatus: 'passed', results: [{ status: 'failed' }, { status: 'passed' }] } : pass())), rows, { productSha, testSha });
  assert.throws(() => verifyResults(rows, retried, { productSha, testSha }), /not PASS/);
  assert.throws(() => verifyResults(rows, ok.slice(1), { productSha, testSha }), /Missing result/);
});
