import { randomId, type QueueJob } from '@cogniate/shared';
import { syncDecision, type AgsScore, type Outcome, type SyncStatus } from '@cogniate/tracking';
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

/** The attempt, placement and learner of a record. */
export type AttemptKey = Pick<LearningRecordView, 'attemptId' | 'placementId' | 'learnerSubject'>;

/** The start and submit times of an attempt, kept on each of its records (LA-ADR-03 D3, LA-E4-04). */
export interface AttemptTimes { startedAt: number; submittedAt: number | null }

/**
 * `startedAt`: the time of the attempt's `started` record (its first accepted commit). `submittedAt`: the time that
 * the attempt first reached a final outcome (its `submitted` record), else null. `startsNow` and `submitsNow`: this
 * commit is that point. An attempt that passed a point before progress records existed has no such record; then the
 * nearest known time counts: the creation time of the attempt (its first launch) for the start, and its first
 * `final` record (migration 014 copied one for each old score sync) for the submission.
 */
export function attemptTimes(db: Db, attempt: AttemptKey, startsNow: boolean, submitsNow: boolean, now: number): AttemptTimes {
  const known = db.prepare(`SELECT MIN(CASE WHEN r.kind = 'started' THEN r.occurred_at END) AS started,
      MIN(CASE WHEN r.kind IN ('submitted', 'final') THEN r.occurred_at END) AS submitted,
      (SELECT created_at FROM attempt WHERE id = ?) AS created
    FROM learning_record r WHERE r.placement_id = ? AND r.learner_subject = ? AND r.attempt_id = ?`)
    .get(attempt.attemptId, attempt.placementId, attempt.learnerSubject, attempt.attemptId)!;
  return {
    startedAt: startsNow ? now : Number(known.started ?? known.created),
    submittedAt: submitsNow ? now : known.submitted === null ? null : Number(known.submitted),
  };
}

type RecordKind = 'final' | 'started' | 'progressed' | 'submitted';
type RecordFacts = AttemptKey & { outcome: Outcome; scoreGiven: number | null; scoreMaximum: number | null };

/** One immutable fact. The course version comes from the attempt row. */
function insertRecord(db: Db, kind: RecordKind, record: RecordFacts, times: AttemptTimes, now: number): string {
  const id = randomId('rec_');
  db.prepare(`INSERT INTO learning_record (id, attempt_id, placement_id, learner_subject, course_version_id, kind,
    outcome, score_given, score_maximum, started_at, submitted_at, occurred_at, created_at)
    SELECT ?, id, ?, ?, course_version_id, ?, ?, ?, ?, ?, ?, ?, ? FROM attempt WHERE id = ?`)
    .run(id, record.placementId, record.learnerSubject, kind, record.outcome, record.scoreGiven, record.scoreMaximum,
      times.startedAt, times.submittedAt, now, now, record.attemptId);
  return id;
}

/**
 * The records of one accepted commit of a non-preview attempt (LA-ADR-03 D3), in the caller's commit transaction,
 * in this order: `started` (the first commit of the attempt), `progressed` (the stored progress changed),
 * `submitted` (the attempt first reached a final outcome), and `final` (a new best final result, with its dispatch
 * rows). The progress kinds (Should, for xAPI in LC) get no dispatch row: `bestResult` reporters take only `final`
 * records, so grade return does not change (ADR-010 rule 2). Returns the id of a new dispatch row, or null.
 */
export function writeCommitRecords(db: Db, commit: {
  attempt: AttemptKey;
  /** The attempt after the commit: its stored (best) outcome and score. */
  state: { outcome: Outcome; score: AgsScore | null };
  started: boolean;
  progressed: boolean;
  submitted: boolean;
  /** A new best final result of the attempt, else null. */
  final: { outcome: Outcome; score: AgsScore } | null;
  reporters: readonly string[];
}, now: number): string | null {
  if (!commit.started && !commit.progressed && !commit.submitted && !commit.final) return null;
  const times = attemptTimes(db, commit.attempt, commit.started, commit.submitted, now);
  const state = { ...commit.attempt, outcome: commit.state.outcome, scoreGiven: commit.state.score?.scoreGiven ?? null,
    scoreMaximum: commit.state.score?.scoreMaximum ?? null };
  for (const kind of ['started', 'progressed', 'submitted'] as const) if (commit[kind]) insertRecord(db, kind, state, times, now);
  return commit.final ? writeFinalRecord(db, { ...commit.attempt, outcome: commit.final.outcome, ...commit.final.score }, times, commit.reporters, now) : null;
}

/** A `final` record and its dispatch rows (LA-ADR-03 D3, D4). The caller's commit transaction owns every write. */
export function writeFinalRecord(db: Db, record: LearningRecordView, times: AttemptTimes, reporters: readonly string[], now: number): string | null {
  const recordId = insertRecord(db, 'final', record, times, now);
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
