import { randomId, type QueueJob } from '@cogniate/shared';
import { syncDecision, type SyncStatus } from '@cogniate/tracking';
import type { Db } from '../../domain/db.ts';
import { createDispatchQueue, type DispatchItem } from './outbox.ts';
import type { LearningRecordView, RecordReporter } from './types.ts';

const reportersByDb = new WeakMap<Db, readonly RecordReporter[]>();

/**
 * The one registration call of a service entry point: record creation, read-back and the outbox use the same
 * reporter instances. A policy other than `bestResult` is refused before anything is registered (AC-LA-E4-03-08).
 * Returns the outbox queue job for the job runner.
 */
export function registerRecordReporters(db: Db, reporters: readonly RecordReporter[]): QueueJob<DispatchItem> {
  const job = createDispatchQueue(db, reporters);
  reportersByDb.set(db, reporters);
  return job;
}

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
  const placement = { id: record.placementId, graded: Number(p.graded) === 1 };
  let dispatchId: string | null = null;
  for (const reporter of recordReporters(db)) {
    if (!reporters.includes(reporter.id) || !reporter.appliesTo(placement)) continue;
    const rows = db.prepare(`SELECT id, status, score_given, score_maximum FROM record_dispatch
      WHERE placement_id = ? AND learner_subject = ? AND reporter = ?`).all(record.placementId, record.learnerSubject, reporter.id)
      .map((r) => ({ id: String(r.id), status: r.status as SyncStatus, scoreGiven: Number(r.score_given), scoreMaximum: Number(r.score_maximum) }));
    const decision = syncDecision(record, rows);
    if (!decision.create) continue;
    // M1 contract value (AGS): dispatch ids keep the `sync_` prefix of the old score_sync ids (LA-ADR-03 D1, D4).
    const id = randomId('sync_');
    const payload = reporter.prepare(record) as Record<string, unknown>;
    const partition = reporter.partitionKey(placement);
    // Read the running 429 pause of the partition before the supersede step: the superseded row can be its only carrier.
    const pause = db.prepare(`SELECT MAX(not_before) AS until FROM record_dispatch
      WHERE status = 'pending' AND partition_key = ? AND not_before > ?`).get(partition, now)!.until;
    for (const old of decision.supersede) db.prepare("UPDATE record_dispatch SET status = 'superseded', next_try_at = NULL, updated_at = ? WHERE id = ?").run(now, old);
    db.prepare(`INSERT INTO record_dispatch (seq, id, record_id, reporter, placement_id, learner_subject, partition_key, payload,
      score_given, score_maximum, status, created_at, next_try_at, not_before, updated_at) VALUES ((SELECT COALESCE(MAX(seq), 0) + 1 FROM record_dispatch), ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`)
      .run(id, recordId, reporter.id, record.placementId, record.learnerSubject, partition,
        JSON.stringify(payload), record.scoreGiven, record.scoreMaximum, now, now, pause ?? null, now);
    dispatchId = id;
  }
  return dispatchId;
}
