import test from 'node:test';
import assert from 'node:assert/strict';
import { FULL_PHASES, phaseRows, casePattern, snapshotStageRows, assertSnapshotBoundary } from './m1-phases.mjs';

test('HARNESS ONLY: every full round includes four disjoint phases and both snapshot stages', () => {
  const rows = [
    { id: 'M1-38.blackboard.i3', environment: 'SIM' },
    { id: 'M1-37.blackboard.y2', environment: 'SIM', phase: 'snapshot-isolated' },
    ...['h1', 'h2', 'h3', 'h4', 'h5'].map((v) =>
      ({ id: 'M1-38.common.' + v, environment: 'SIM', phase: 'snapshot-upgrade' })),
    { id: 'M1-23.common.upgrade', environment: 'MOODLE-LIVE' },
  ];
  assert.deepEqual(FULL_PHASES, ['sim', 'snapshot-isolated', 'snapshot-upgrade', 'migration']);
  const selected = FULL_PHASES.flatMap((phase) => phaseRows(rows, phase));
  assert.equal(selected.length, rows.length);
  assert.equal(new Set(selected.map((row) => row.id)).size, rows.length);
  assert.deepEqual(snapshotStageRows(rows, 'snapshot-seed').map((row) => row.id), ['M1-38.common.h1']);
  assert.equal(snapshotStageRows(rows, 'snapshot-upgrade').length, 4);
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
