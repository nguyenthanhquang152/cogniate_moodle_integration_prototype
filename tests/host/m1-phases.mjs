import assert from 'node:assert/strict';

// ADR-012 §13: the new host phase `storage` runs after `migration` in each full round (its own clone and lane).
export const FULL_PHASES = ['sim', 'snapshot-isolated', 'snapshot-upgrade', 'migration', 'storage'];
export const SNAPSHOT_OLD_SHA = '9f96f7b24cd0aed702e4dc40373bdda4307aad31';
export const SNAPSHOT_CONTRACT_SHA = 'ccdd9ef67cdd2be4c6af374136777fda4e081943';
export function phaseRows(rows, phase) {
  assert.ok(FULL_PHASES.includes(phase));
  return rows.filter((row) => (row.phase ?? (row.environment === 'MOODLE-LIVE' ? 'migration' : 'sim')) === phase);
}
export function casePattern(rows) {
  assert.ok(rows.length, 'No empty test selection');
  return '\\{case:(?:' + rows.map((row) => row.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\}';
}
export function snapshotStageRows(rows, stage) {
  assert.ok(['snapshot-seed', 'snapshot-upgrade'].includes(stage));
  // j-snapshot (AC-M1-41) is a host qualification row of this phase, not an in-container probe case.
  return phaseRows(rows, 'snapshot-upgrade').filter((row) => row.ac !== 'AC-M1-41').filter((row) => stage === 'snapshot-seed'
    ? row.id === 'M1-38.common.h1' : row.id !== 'M1-38.common.h1');
}
/** The in-container suite selection of a phase: never an AC-M1-41 host row. */
export const suiteRows = (rows) => rows.filter((row) => row.ac !== 'AC-M1-41');
export function assertSnapshotBoundary(names, stage) {
  assert.ok(['before', 'after'].includes(stage));
  assert.equal(names.filter((name) => name === '011_lms_types.sql').length, 1, '011 must be present once');
  assert.equal(names.filter((name) => name === '012_connection_provider_snapshot.sql').length,
    stage === 'before' ? 0 : 1, '012 boundary must match the stage');
  assert.equal(new Set(names).size, names.length, 'No duplicate migration entry');
}
