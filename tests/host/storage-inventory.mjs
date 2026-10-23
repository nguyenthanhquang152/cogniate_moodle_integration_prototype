// AC-M1-41 inventory (ADR-012 revision 3.3 §13, §14). Host-only; no Docker.
// The 72 storage rows live in their own host manifest, so the 416 original
// manifest rows stay byte-identical. run-m1.mjs joins both lists.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// ADR-012 §13 table, copied by hand from the accepted contract (89be93c).
export const STORAGE_GROUPS = {
  a: ['a-fresh', 'a-second-start', 'a-restart', 'a-restart-refusal', 'a-serialize', 'a-first-start-resume',
    'a-lock-wait', 'a-lock-stale', 'a-lock-scope', 'a-lock-reentry'],
  b: ['b-oracle-lti', 'b-oracle-app', 'b-sequence'],
  c: ['c-selftest', 'c-host-negative'],
  d: ['d-clean', 'd-stale', 'd-unknown', 'd-symlink', 'd-owner', 'd-mountpoint', 'd-content-folder'],
  e: ['e-fresh-refusal', 'e-import', 'e-kept', 'e-changed-byte', 'e-added-wal', 'e-not-same-import',
    'e-import-nonfresh', 'e-content-missing', 'e-old-layout', 'e-hot-journal', 'e-old-schema',
    'e-import-recover', 'e-provenance-restore'],
  f: ['f-pairid', 'f-identity-missing', 'f-db-without-identity', 'f-project', 'f-half-pair', 'f-originals-back'],
  g: ['g-prepared-lti', 'g-prepared', 'g-staged', 'g-swap-lti-mid', 'g-swapped-lti', 'g-swap-app-mid', 'g-swapped',
    'g-identity-lti', 'g-identity-app', 'g-committed-lti', 'g-rollback-mid', 'g-recover-idempotent', 'g-tamper',
    'g-quarantine', 'g-damaged', 'g-fresh-target', 'g-orphan-refusal', 'g-orphan-complete', 'g-orphan-stopped',
    'g-quarantine-in-use'],
  h: ['h-nomanifest', 'h-volume-manifest', 'h-legacy-manifest', 'h-open-journal', 'h-pair-mismatch',
    'h-old-manifest', 'h-target-state'],
  i: ['i-enable-refusal', 'i-candidate-guard'],
  j: ['j-migration', 'j-snapshot'],
};
export const GROUP_COUNTS = { a: 10, b: 3, c: 2, d: 7, e: 13, f: 6, g: 20, h: 7, i: 2, j: 2 };
export const STORAGE_TOTAL = 72;
export const ORIGINAL_TOTAL = 416;
export const ROUND_TOTAL = 488;
// Per full round, after the join (ADR-012 §13).
export const PHASE_TOTALS = { sim: 394, 'snapshot-isolated': 6, 'snapshot-upgrade': 6, migration: 12, storage: 70 };
// The only row that may be NOT_APPLICABLE (ADR-012 §14).
export const CONDITIONAL_ID = 'M1-41.common.c-host-negative';
export const STORAGE_MANIFEST = 'host/m1-storage-manifest.json';

export const storageId = (short) => `M1-41.common.${short}`;
export const phaseOfStorage = (short) => short === 'j-migration' ? 'migration'
  : short === 'j-snapshot' ? 'snapshot-upgrade' : 'storage';
export const groupOf = (short) => Object.keys(STORAGE_GROUPS).find((g) => STORAGE_GROUPS[g].includes(short));

/** Reads and validates the storage manifest against the hand-copied ADR table. */
export function readStorageManifest(testsDir) {
  const file = path.join(testsDir, STORAGE_MANIFEST);
  assert.ok(fs.existsSync(file), 'Storage manifest is missing: ' + file);
  const entries = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(Array.isArray(entries), 'Storage manifest must be a list');
  const wanted = Object.values(STORAGE_GROUPS).flat();
  assert.equal(wanted.length, STORAGE_TOTAL, 'ADR table has 72 ids');
  assert.equal(new Set(wanted).size, STORAGE_TOTAL, 'ADR table has no duplicate id');
  for (const [group, ids] of Object.entries(STORAGE_GROUPS)) assert.equal(ids.length, GROUP_COUNTS[group], 'Group count ' + group);
  const seen = new Set();
  for (const entry of entries) {
    assert.match(entry.id, /^M1-41\.common\.[a-z0-9-]+$/, 'Storage id form');
    const short = entry.id.slice('M1-41.common.'.length);
    assert.ok(wanted.includes(short), 'Unknown storage row ' + entry.id);
    assert.ok(!seen.has(entry.id), 'Duplicate storage row ' + entry.id); seen.add(entry.id);
    assert.equal(entry.ac, 'AC-M1-41', 'AC of ' + entry.id);
    assert.equal(entry.environment, 'SIM', 'Label of ' + entry.id);
    assert.equal(entry.kind, 'host', 'Kind of ' + entry.id);
    assert.equal(entry.phase, phaseOfStorage(short), 'Phase of ' + entry.id);
    assert.equal(entry.group, groupOf(short), 'Group of ' + entry.id);
    assert.equal(entry.conditional === true, entry.id === CONDITIONAL_ID, 'Only c-host-negative is conditional');
    assert.ok(typeof entry.title === 'string' && entry.title.trim().length > 10, 'Title of ' + entry.id);
    assert.ok(typeof entry.file === 'string' && !path.isAbsolute(entry.file) && !entry.file.split(/[\\/]/).includes('..'),
      'Unsafe file of ' + entry.id);
    assert.ok(fs.existsSync(path.join(testsDir, entry.file)), 'Row file missing: ' + entry.id);
  }
  for (const short of wanted) assert.ok(seen.has(storageId(short)), 'Missing storage row ' + short);
  assert.equal(entries.length, STORAGE_TOTAL);
  return entries;
}

/** Joins the 416 original rows and the 72 storage rows, and checks the round totals. */
export function joinInventory(original, storage, { full = true } = {}) {
  const ids = new Set(original.map((row) => row.id));
  for (const row of storage) assert.ok(!ids.has(row.id), 'Storage row collides with an original row: ' + row.id);
  assert.ok(!original.some((row) => row.ac === 'AC-M1-41'), 'Original manifests must not hold AC-M1-41 rows');
  const joined = [...original, ...storage];
  if (full) {
    assert.equal(original.length, ORIGINAL_TOTAL, 'Original rows per round');
    assert.equal(storage.length, STORAGE_TOTAL, 'Storage rows per round');
    assert.equal(joined.length, ROUND_TOTAL, 'Mandatory rows per round');
    const count = {};
    for (const row of joined) {
      const phase = row.phase ?? (row.environment === 'MOODLE-LIVE' ? 'migration' : 'sim');
      count[phase] = (count[phase] ?? 0) + 1;
    }
    assert.deepEqual(count, PHASE_TOTALS, 'Phase totals per round');
  }
  return joined;
}

/**
 * The conditional rule of ADR-012 §14 on top of the existing verifyResults rule.
 * Every row except c-host-negative must be PASS. c-host-negative is PASS, or
 * NOT_APPLICABLE with oracle evidence; it is reported apart and never counted as PASS.
 */
export function splitConditional(expected, actual) {
  const conditionalExpected = expected.filter((row) => row.id === CONDITIONAL_ID);
  const conditionalActual = actual.filter((row) => row.id === CONDITIONAL_ID);
  return {
    expected: expected.filter((row) => row.id !== CONDITIONAL_ID),
    actual: actual.filter((row) => row.id !== CONDITIONAL_ID),
    conditionalExpected, conditionalActual,
  };
}
export function checkConditional(conditionalExpected, conditionalActual) {
  if (!conditionalExpected.length) { assert.equal(conditionalActual.length, 0, 'Unexpected conditional result'); return null; }
  assert.equal(conditionalActual.length, 1, 'Exactly one c-host-negative result');
  const row = conditionalActual[0];
  assert.ok(['PASS', 'NOT_APPLICABLE'].includes(row.status), `c-host-negative must be PASS or NOT_APPLICABLE (${row.status})`);
  if (row.status === 'NOT_APPLICABLE') {
    assert.ok(row.oracle && row.oracle.verdict === 'LOCK ENFORCED (B refused while A held)',
      'NOT_APPLICABLE needs the same-round oracle evidence that shows enforcement');
  } else {
    assert.ok(row.oracle && /LOCK NOT ENFORCED/.test(row.oracle.verdict ?? ''), 'PASS needs the oracle evidence of the fault');
  }
  return row.status;
}
/** Both full rounds must give the same c-host-negative result (ADR-012 §14 "Two rounds"). */
export function sameConditionalInBothRounds(round1, round2) {
  const pick = (rows) => rows.find((row) => row.id === CONDITIONAL_ID)?.status ?? 'MISSING';
  assert.equal(pick(round1), pick(round2), 'c-host-negative must have the same result in both rounds');
  return pick(round1);
}
/** Counts for the report: NOT_APPLICABLE is apart and never a PASS. */
export function countResults(rows) {
  const count = { PASS: 0, NOT_APPLICABLE: 0, other: 0 };
  for (const row of rows) {
    if (row.status === 'PASS') count.PASS++;
    else if (row.status === 'NOT_APPLICABLE') count.NOT_APPLICABLE++;
    else count.other++;
  }
  return count;
}
