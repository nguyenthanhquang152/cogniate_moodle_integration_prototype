import { randomId } from '@cogniate/shared';
import { syncDecision, type SyncStatus } from '@cogniate/tracking';
import type { Db } from '../../domain/db.ts';
import { legacyAgsPolicy } from './legacy-reporter.ts';
import { placementPartition } from './placements.ts';
import type { LearningRecordView } from './types.ts';

/** The caller's commit transaction owns the attempt, immutable fact, and dispatch writes. */
export function writeFinalRecord(db: Db, record: LearningRecordView, reporters: readonly string[], now: number): string | null {
  const recordId = randomId('rec_');
  db.prepare(`INSERT INTO learning_record (id, attempt_id, placement_id, learner_subject, course_version_id, kind,
    outcome, score_given, score_maximum, occurred_at, created_at)
    SELECT ?, id, ?, ?, course_version_id, 'final', ?, ?, ?, ?, ? FROM attempt WHERE id = ?`)
    .run(recordId, record.placementId, record.learnerSubject, record.outcome, record.scoreGiven, record.scoreMaximum, now, now, record.attemptId);
  const p = db.prepare('SELECT graded FROM placement WHERE id = ?').get(record.placementId)!;
  let syncId: string | null = null;
  // LA has one reporter. E4-03 moves this policy into its driver without changing the creation rule.
  for (const reporter of [legacyAgsPolicy]) {
    if (!reporters.includes(reporter.id) || !reporter.appliesTo({ id: record.placementId, graded: Number(p.graded) === 1 })) continue;
    const rows = db.prepare(`SELECT id, status, score_given, score_maximum FROM record_dispatch
      WHERE placement_id = ? AND learner_subject = ? AND reporter = ?`).all(record.placementId, record.learnerSubject, reporter.id)
      .map((r) => ({ id: String(r.id), status: r.status as SyncStatus, scoreGiven: Number(r.score_given), scoreMaximum: Number(r.score_maximum) }));
    const decision = syncDecision(record, rows);
    if (!decision.create) continue;
    for (const id of decision.supersede) db.prepare("UPDATE record_dispatch SET status = 'superseded', next_try_at = NULL, updated_at = ? WHERE id = ?").run(now, id);
    const id = randomId('sync_');
    db.prepare(`INSERT INTO record_dispatch (seq, id, record_id, reporter, placement_id, learner_subject, partition_key, payload,
      score_given, score_maximum, status, created_at, next_try_at, updated_at) VALUES ((SELECT COALESCE(MAX(seq), 0) + 1 FROM record_dispatch), ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`)
      .run(id, recordId, reporter.id, record.placementId, record.learnerSubject, placementPartition(db, record.placementId),
        JSON.stringify(reporter.prepare(record)), record.scoreGiven, record.scoreMaximum, now, now, now);
    syncId = id;
  }
  return syncId;
}
