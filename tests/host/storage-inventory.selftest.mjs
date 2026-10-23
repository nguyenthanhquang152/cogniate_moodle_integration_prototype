// HARNESS ONLY: the M1 inventory with the 72 AC-M1-41 rows (ADR-012 revision 3.3 §13, §14). No Docker.
// Positive control on the real manifests; negative controls on edited copies.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readManifests } from '../acceptance/M1/common/coverage.mjs';
import {
  CONDITIONAL_ID, STORAGE_GROUPS, STORAGE_MANIFEST, checkConditional, countResults, joinInventory, readStorageManifest,
  sameConditionalInBothRounds, splitConditional,
} from './storage-inventory.mjs';

const testsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('HARNESS ONLY: 416 original rows unchanged by owner, kind and phase; plus 72 storage rows = 488 per round', () => {
  const original = readManifests(testsDir);
  assert.equal(original.length, 416);
  const by = (key) => original.reduce((m, r) => ({ ...m, [r[key] ?? '-']: (m[r[key] ?? '-'] ?? 0) + 1 }), {});
  assert.deepEqual(by('kind'), { api: 392, host: 17, browser: 7 });
  assert.equal(original.filter((r) => r.id.includes('.common.')).length, 42);
  assert.equal(original.filter((r) => r.id.includes('.blackboard.')).length, 141);
  assert.equal(original.filter((r) => r.id.includes('.canvas.')).length, 233);
  const storage = readStorageManifest(testsDir);
  assert.equal(storage.length, 72);
  assert.deepEqual(Object.fromEntries(Object.entries(STORAGE_GROUPS).map(([g, ids]) => [g, ids.length])),
    { a: 10, b: 3, c: 2, d: 7, e: 13, f: 6, g: 20, h: 7, i: 2, j: 2 });
  const joined = joinInventory(original, storage);
  assert.equal(joined.length, 488);
  assert.deepEqual(storage.filter((r) => r.conditional).map((r) => r.id), [CONDITIONAL_ID]);
  assert.deepEqual(storage.filter((r) => r.phase !== 'storage').map((r) => [r.id, r.phase]),
    [['M1-41.common.j-migration', 'migration'], ['M1-41.common.j-snapshot', 'snapshot-upgrade']]);
});

function copyWith(edit) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-inventory-'));
  fs.mkdirSync(path.join(dir, 'host'));
  for (const f of ['storage-rows.mjs', 'storage-compat-route.mjs']) fs.writeFileSync(path.join(dir, 'host', f), '');
  const rows = JSON.parse(fs.readFileSync(path.join(testsDir, STORAGE_MANIFEST), 'utf8'));
  fs.writeFileSync(path.join(dir, STORAGE_MANIFEST), JSON.stringify(edit(rows)));
  return dir;
}
test('HARNESS ONLY: negative controls — a missing, duplicate, unknown, mis-phased or second conditional row fails closed', () => {
  const cases = {
    missing: (rows) => rows.slice(1),
    duplicate: (rows) => [...rows.slice(0, -1), rows[0]],
    unknown: (rows) => [...rows.slice(0, -1), { ...rows.at(-1), id: 'M1-41.common.z-extra' }],
    phase: (rows) => rows.map((r) => r.id.endsWith('a-fresh') ? { ...r, phase: 'sim' } : r),
    conditional: (rows) => rows.map((r) => r.id.endsWith('c-selftest') ? { ...r, conditional: true } : r),
    label: (rows) => rows.map((r) => r.id.endsWith('d-owner') ? { ...r, environment: 'DOC' } : r),
    group: (rows) => rows.map((r) => r.id.endsWith('g-tamper') ? { ...r, group: 'h' } : r),
  };
  for (const [name, edit] of Object.entries(cases)) {
    const dir = copyWith(edit);
    try { assert.throws(() => readStorageManifest(dir), `Negative control: ${name}`); }
    finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  const original = readManifests(testsDir), storage = readStorageManifest(testsDir);
  assert.throws(() => joinInventory(original, [...storage.slice(1), { ...storage[0], id: original[0].id }]), /collides|Storage rows per round/);
  assert.throws(() => joinInventory([...original, { ...original[0], id: 'M1-41.common.z-hidden', ac: 'AC-M1-41' }], storage), /must not hold AC-M1-41/);
  assert.throws(() => joinInventory(original.slice(1), storage), /Original rows per round/);
});

test('HARNESS ONLY: c-host-negative is PASS or NOT_APPLICABLE with oracle evidence, apart, never a PASS, the same in both rounds', () => {
  const exp = [{ id: CONDITIONAL_ID }, { id: 'M1-41.common.c-selftest' }];
  const na = { id: CONDITIONAL_ID, status: 'NOT_APPLICABLE', oracle: { verdict: 'LOCK ENFORCED (B refused while A held)' } };
  const split = splitConditional(exp, [na, { id: 'M1-41.common.c-selftest', status: 'PASS' }]);
  assert.deepEqual(split.expected.map((r) => r.id), ['M1-41.common.c-selftest']);
  assert.equal(checkConditional(split.conditionalExpected, split.conditionalActual), 'NOT_APPLICABLE');
  assert.throws(() => checkConditional([{ id: CONDITIONAL_ID }], [{ id: CONDITIONAL_ID, status: 'NOT_APPLICABLE' }]), /oracle evidence/);
  assert.throws(() => checkConditional([{ id: CONDITIONAL_ID }], [{ id: CONDITIONAL_ID, status: 'PASS', oracle: { verdict: 'LOCK ENFORCED (B refused while A held)' } }]), /fault/);
  assert.throws(() => checkConditional([{ id: CONDITIONAL_ID }], [{ id: CONDITIONAL_ID, status: 'FAIL' }]), /PASS or NOT_APPLICABLE/);
  assert.equal(checkConditional([{ id: CONDITIONAL_ID }], [{ id: CONDITIONAL_ID, status: 'PASS', oracle: { verdict: 'LOCK NOT ENFORCED (B acquired while A held)' } }]), 'PASS');
  assert.equal(sameConditionalInBothRounds([na], [na]), 'NOT_APPLICABLE');
  assert.throws(() => sameConditionalInBothRounds([na], [{ id: CONDITIONAL_ID, status: 'PASS' }]), /same result in both rounds/);
  assert.deepEqual(countResults([na, { status: 'PASS' }]), { PASS: 1, NOT_APPLICABLE: 1, other: 0 }, 'NOT_APPLICABLE is never counted as PASS');
});
