import { randomId } from '@cogniate/shared';
import { syncDecision, type SyncStatus } from '@cogniate/tracking';
import type { Db } from '../../domain/db.ts';
import { placementPartition } from './placements.ts';
import type { LearningRecordView, RecordReporter } from './types.ts';

const reportersByDb = new WeakMap<Db, readonly RecordReporter[]>();

/** The service entry point gives record creation and delivery the same reporter instances. */
export function configureRecordReporters(db: Db, reporters: readonly RecordReporter[]): void {
  reportersByDb.set(db, reporters);
}

export function recordReporters(db: Db): readonly RecordReporter[] {
  const reporters = reportersByDb.get(db);
  if (!reporters) throw new Error('Record reporters are not configured');
  return reporters;
}

/** Read-back addresses only non-preview learner and placement pairs. */
export function readBackTargets(db: Db, connectionId: string, courseId: string) {
  return db.prepare(`SELECT DISTINCT p.id, p.graded, a.user_sub FROM attempt a
    JOIN course_version v ON v.id = a.course_version_id JOIN placement p ON p.id = a.resource_link_id
    WHERE p.connection_id = ? AND v.course_id = ? AND a.preview = 0`).all(connectionId, courseId)
    .map((r) => ({ placement: { id: String(r.id), graded: r.graded === 1 }, learnerSubject: String(r.user_sub) }));
}

/** The caller's commit transaction owns the attempt, immutable fact, and dispatch writes. */
export function writeFinalRecord(db: Db, record: LearningRecordView, reporters: readonly string[], now: number): string | null {
  const recordId = randomId('rec_');
  db.prepare(`INSERT INTO learning_record (id, attempt_id, placement_id, learner_subject, course_version_id, kind,
    outcome, score_given, score_maximum, occurred_at, created_at)
    SELECT ?, id, ?, ?, course_version_id, 'final', ?, ?, ?, ?, ? FROM attempt WHERE id = ?`)
    .run(recordId, record.placementId, record.learnerSubject, record.outcome, record.scoreGiven, record.scoreMaximum, now, now, record.attemptId);
  const p = db.prepare('SELECT graded FROM placement WHERE id = ?').get(record.placementId)!;
  let syncId: string | null = null;
  for (const reporter of recordReporters(db)) {
    if (!reporters.includes(reporter.id) || !reporter.appliesTo({ id: record.placementId, graded: Number(p.graded) === 1 })) continue;
    const rows = db.prepare(`SELECT id, status, score_given, score_maximum FROM record_dispatch
      WHERE placement_id = ? AND learner_subject = ? AND reporter = ?`).all(record.placementId, record.learnerSubject, reporter.id)
      .map((r) => ({ id: String(r.id), status: r.status as SyncStatus, scoreGiven: Number(r.score_given), scoreMaximum: Number(r.score_maximum) }));
    const decision = syncDecision(record, rows);
    if (!decision.create) continue;
    for (const id of decision.supersede) db.prepare("UPDATE record_dispatch SET status = 'superseded', next_try_at = NULL, updated_at = ? WHERE id = ?").run(now, id);
    const id = randomId('sync_');
    const payload = reporter.prepare(record) as Record<string, unknown>;
    const partition = reporter.partitionKey({ id, reporter: reporter.id, placementId: record.placementId,
      learnerSubject: record.learnerSubject, payload, tries: 0, createdAt: now, retryFrom: now, confirmationAfter: null,
      partitionKey: placementPartition(db, record.placementId) });
    db.prepare(`INSERT INTO record_dispatch (seq, id, record_id, reporter, placement_id, learner_subject, partition_key, payload,
      score_given, score_maximum, status, created_at, next_try_at, updated_at) VALUES ((SELECT COALESCE(MAX(seq), 0) + 1 FROM record_dispatch), ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`)
      .run(id, recordId, reporter.id, record.placementId, record.learnerSubject, partition,
        JSON.stringify(payload), record.scoreGiven, record.scoreMaximum, now, now, now);
    syncId = id;
  }
  return syncId;
}
