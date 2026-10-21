import test from 'node:test';
import assert from 'node:assert/strict';
import { FULL_PHASES, phaseRows, casePattern, snapshotStageRows, assertSnapshotBoundary } from './m1-phases.mjs';

test('HARNESS ONLY: every full round includes five disjoint phases and both snapshot stages', () => {
  const rows = [
    { id: 'M1-38.blackboard.i3', environment: 'SIM' },
    { id: 'M1-37.blackboard.y2', environment: 'SIM', phase: 'snapshot-isolated' },
    ...['h1', 'h2', 'h3', 'h4', 'h5'].map((v) =>
      ({ id: 'M1-38.common.' + v, environment: 'SIM', phase: 'snapshot-upgrade' })),
    { id: 'M1-23.common.upgrade', environment: 'MOODLE-LIVE' },
    { id: 'M1-41.common.a-fresh', ac: 'AC-M1-41', environment: 'SIM', phase: 'storage' },
    { id: 'M1-41.common.j-migration', ac: 'AC-M1-41', environment: 'SIM', phase: 'migration' },
    { id: 'M1-41.common.j-snapshot', ac: 'AC-M1-41', environment: 'SIM', phase: 'snapshot-upgrade' },
  ];
  assert.deepEqual(FULL_PHASES, ['sim', 'snapshot-isolated', 'snapshot-upgrade', 'migration', 'storage']);
  const selected = FULL_PHASES.flatMap((phase) => phaseRows(rows, phase));
  assert.equal(selected.length, rows.length);
  assert.equal(new Set(selected.map((row) => row.id)).size, rows.length);
  assert.deepEqual(snapshotStageRows(rows, 'snapshot-seed').map((row) => row.id), ['M1-38.common.h1']);
  assert.equal(snapshotStageRows(rows, 'snapshot-upgrade').length, 4, 'j-snapshot is never an in-container probe case');
  assert.deepEqual(phaseRows(rows, 'storage').map((row) => row.id), ['M1-41.common.a-fresh']);
  assert.ok(phaseRows(rows, 'migration').some((row) => row.id === 'M1-41.common.j-migration'));
  const pattern = new RegExp(casePattern(phaseRows(rows, 'snapshot-isolated')));
  assert.ok(pattern.test('case title {case:M1-37.blackboard.y2}'));
  assert.equal(pattern.test('{case:M1-37.blackboard.y2-extra}'), false);
  assert.equal(pattern.test('{case:M1-38.blackboard.i3}'), false);
  assert.throws(() => casePattern([]));
});

test('HARNESS ONLY: populated migration refuses an already-012 or missing-011 baseline', () => {
  const before = ['001_old.sql', '011_lms_types.sql'], after = [...before, '012_connection_provider_snapshot.sql'];
  assertSnapshotBoundary(before, 'before'); assertSnapshotBoundary(after, 'after');
  assert.throws(() => assertSnapshotBoundary(after, 'before'));
  assert.throws(() => assertSnapshotBoundary(['001_old.sql'], 'before'));
  assert.throws(() => assertSnapshotBoundary(before, 'after'));
  assert.throws(() => assertSnapshotBoundary([...after, after.at(-1)], 'after'));
});
